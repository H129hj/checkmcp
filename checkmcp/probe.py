"""MCP probe — handshake + tools/resources/prompts + JSON-RPC conformance + latence.
Transports : Streamable-HTTP (POST <url>) ET HTTP+SSE legacy (GET <url> → event endpoint → POST).
Détecte les serveurs protégés par OAuth (401 / .well-known) et renvoie auth_required.
stdlib uniquement (urllib + threading pour le flux SSE)."""
import json, time, re, threading, urllib.request, urllib.error
from urllib.parse import urljoin

# urllib envoie par défaut "Python-urllib/x" → bloqué (403) par les edges Cloudflare/WAF. UA explicite.
UA = "CheckMCP/0.1 (+https://checkmcp.com)"


def _parse(raw):
    for ln in raw.splitlines():
        if ln.startswith("data:"):
            try:
                return json.loads(ln[5:].strip())
            except Exception:
                pass
    try:
        return json.loads(raw)
    except Exception:
        return None


def _post(url, body, sid=None, token=None, timeout=25):
    """Streamable-HTTP : un POST par message. Renvoie (status, session-id, raw, ms, www-authenticate)."""
    h = {"Content-Type": "application/json", "Accept": "application/json, text/event-stream", "User-Agent": UA}
    if token:
        h["Authorization"] = "Bearer " + token
    if sid:
        h["Mcp-Session-Id"] = sid
    req = urllib.request.Request(url, data=json.dumps(body).encode(), headers=h, method="POST")
    t0 = time.time()
    try:
        r = urllib.request.urlopen(req, timeout=timeout)
        ctype = r.headers.get("Content-Type", "")
        if "text/event-stream" in ctype:
            chunks, deadline = [], time.time() + min(timeout, 15)
            while time.time() < deadline:
                try:
                    line = r.readline()
                except Exception:
                    break
                if not line:
                    break
                s = line.decode("utf-8", errors="replace")
                chunks.append(s)
                if s.startswith("data:"):
                    try:
                        json.loads(s[5:].strip()); break
                    except Exception:
                        pass
            try:
                r.close()
            except Exception:
                pass
            raw = "".join(chunks)
        else:
            raw = r.read().decode()
        return r.status, r.headers.get("mcp-session-id"), raw, (time.time() - t0) * 1000, None
    except urllib.error.HTTPError as e:
        return e.code, None, e.read().decode(errors="replace"), (time.time() - t0) * 1000, e.headers.get("WWW-Authenticate")
    except Exception:
        return 0, None, "", (time.time() - t0) * 1000, None


class SSESession:
    """Transport HTTP+SSE legacy : GET le flux, récupère l'URL de session (event 'endpoint'),
    puis POST les messages dessus ; les réponses arrivent sur le flux (corrélées par id)."""
    def __init__(self, url, token=None, timeout=25):
        self.url, self.token, self.timeout = url, token, timeout
        self.endpoint = None
        self.status = None
        self.www_authenticate = None
        self._resp = None
        self._msgs = {}
        self._lock = threading.Lock()
        self._evt = threading.Event()
        self._stop = False

    def open(self):
        h = {"Accept": "text/event-stream", "User-Agent": UA}
        if self.token:
            h["Authorization"] = "Bearer " + self.token
        try:
            self._resp = urllib.request.urlopen(urllib.request.Request(self.url, headers=h), timeout=self.timeout)
            self.status = self._resp.status
        except urllib.error.HTTPError as e:
            self.status = e.code
            self.www_authenticate = e.headers.get("WWW-Authenticate")
            return False
        except Exception:
            self.status = 0
            return False
        # lecture jusqu'à l'event 'endpoint' (donne l'URL de POST)
        ev, data, deadline = None, [], time.time() + 8
        while time.time() < deadline:
            try:
                line = self._resp.readline()
            except Exception:
                break
            if not line:
                break
            s = line.decode("utf-8", errors="replace").rstrip("\r\n")
            if s == "":
                if ev == "endpoint" and data:
                    self.endpoint = urljoin(self.url, data[0])
                    break
                ev, data = None, []
                continue
            if s.startswith("event:"):
                ev = s[6:].strip()
            elif s.startswith("data:"):
                data.append(s[5:].strip())
        if not self.endpoint:
            return False
        threading.Thread(target=self._reader, daemon=True).start()
        return True

    def _reader(self):
        data = []
        while not self._stop:
            try:
                line = self._resp.readline()
            except Exception:
                break
            if not line:
                break
            s = line.decode("utf-8", errors="replace").rstrip("\r\n")
            if s == "":
                if data:
                    obj = _parse("\n".join("data:" + d for d in data))
                    if isinstance(obj, dict) and "id" in obj:
                        with self._lock:
                            self._msgs[obj["id"]] = obj
                        self._evt.set()
                data = []
            elif s.startswith("data:"):
                data.append(s[5:].strip())

    def call(self, body, timeout=15):
        h = {"Content-Type": "application/json", "User-Agent": UA}
        if self.token:
            h["Authorization"] = "Bearer " + self.token
        t0 = time.time()
        try:
            urllib.request.urlopen(urllib.request.Request(self.endpoint, data=json.dumps(body).encode(), headers=h, method="POST"), timeout=timeout).read()
        except Exception:
            pass
        rid = body.get("id")
        if rid is None:
            return None, (time.time() - t0) * 1000
        deadline = time.time() + timeout
        while time.time() < deadline:
            with self._lock:
                if rid in self._msgs:
                    return self._msgs.pop(rid), (time.time() - t0) * 1000
            self._evt.wait(0.2)
            self._evt.clear()
        return None, (time.time() - t0) * 1000

    def close(self):
        self._stop = True
        try:
            self._resp.close()
        except Exception:
            pass


def _get(url, timeout=4):
    try:
        r = urllib.request.urlopen(urllib.request.Request(url, headers={"Accept": "application/json", "User-Agent": UA}), timeout=timeout)
        return r.status, r.read().decode()
    except urllib.error.HTTPError as e:
        return e.code, ""
    except Exception:
        return 0, ""


def _well_known(url):
    base = re.sub(r"/(mcp|sse)(/(mcp|sse))?/?$", "", url) or url
    base = base.rstrip("/")
    pr, _ = _get(base + "/.well-known/oauth-protected-resource")
    as_, _ = _get(base + "/.well-known/oauth-authorization-server")
    return {"oauth_protected_resource": pr == 200, "oauth_authorization_server": as_ == 200}


try:
    from . import __version__ as _CKVER
except Exception:
    _CKVER = "0.4.0"

INIT = {"jsonrpc": "2.0", "id": 1, "method": "initialize",
        "params": {"protocolVersion": "2024-11-05", "capabilities": {}, "clientInfo": {"name": "checkmcp", "version": _CKVER}}}


def call_tools(url, calls, token=None, timeout=12):
    """Ouvre un transport (Streamable-HTTP ou SSE legacy), exécute une liste d'appels d'outils
    [(name, arguments), …] et renvoie [{name, ok, result, text, error, ms}, …] aligné.
    Réservé aux evals comportementaux (opt-in) — n'appelle QUE ce que le caller a sélectionné."""
    st, sid, raw, _, wa = _post(url, INIT, token=token)
    kind, sse = None, None
    if st == 200:
        kind = "streamable"
    elif st in (404, 405, 406, 400, 415) or url.rstrip("/").endswith("sse"):
        sse = SSESession(url, token=token)
        if sse.open():
            resp, _ = sse.call(INIT)
            if resp is not None:
                kind = "sse"
            else:
                sse.close(); sse = None
    if kind is None:
        return {"error": "handshake failed", "http": st}

    def _call(method, params=None, idn=None):
        body = {"jsonrpc": "2.0", "method": method, "params": params or {}}
        if idn is not None:
            body["id"] = idn
        if kind == "streamable":
            _, _, r, ms, _ = _post(url, body, sid=sid, token=token, timeout=timeout)
            return _parse(r), ms
        return sse.call(body, timeout=timeout)

    out = []
    try:
        _call("notifications/initialized")
        for i, (name, args) in enumerate(calls):
            t0 = time.time()
            o, ms = _call("tools/call", {"name": name, "arguments": args or {}}, idn=300 + i)
            o = o or {}
            err = o.get("error")
            res = o.get("result") or {}
            # texte concaténé des content blocks (là où vit le poisoning de sortie)
            text = ""
            for c in (res.get("content") or []):
                if isinstance(c, dict):
                    text += (c.get("text") or "") + "\n"
            out.append({
                "name": name,
                "ok": err is None,
                "is_error": bool(res.get("isError")),
                "result": res,
                "text": text,
                "error": err,
                "ms": round(ms),
            })
    finally:
        if sse:
            sse.close()
    return {"calls": out}


def _shape(name, o, ms, sid):
    o = o or {}
    err = o.get("error"); res = o.get("result") or {}
    text = "".join((c.get("text") or "") for c in (res.get("content") or []) if isinstance(c, dict))
    return {"name": name, "ok": err is None, "is_error": bool(res.get("isError")),
            "result": res, "text": text, "error": err, "ms": ms, "_session": sid}


def call_one(url, name, args, token=None, session_id=None, timeout=20):
    """Un seul tools/call sur un backend STREAMABLE-HTTP, RÉUTILISANT `session_id` si fourni (sinon INIT).
    Renvoie un dict (forme call_tools) avec `_session`, ou None si non-streamable/échec → le caller retombe sur call_tools."""
    body = {"jsonrpc": "2.0", "id": 70, "method": "tools/call", "params": {"name": name, "arguments": args or {}}}

    def _do(sid):
        import time as _t
        t0 = _t.time()
        st, _, raw, _, _ = _post(url, body, sid=sid, token=token, timeout=timeout)
        return st, _parse(raw), round((_t.time() - t0) * 1000)

    if session_id:
        st, o, ms = _do(session_id)
        if st == 200 and isinstance(o, dict) and ("result" in o or "error" in o):
            return _shape(name, o, ms, session_id)        # session réutilisée → 1 seul round-trip
    st, sid, raw, _, _ = _post(url, INIT, token=token)    # sinon INIT complet (streamable uniquement)
    if st != 200 or not sid:
        return None
    _post(url, {"jsonrpc": "2.0", "method": "notifications/initialized", "params": {}}, sid=sid, token=token)
    st, o, ms = _do(sid)
    if st != 200:
        return None
    return _shape(name, o, ms, sid)


def probe(url, token=None, discover=True):
    """Retourne le Probe artifact (dict) ou {error:..., auth_required?:bool}.
    discover=False saute la découverte OAuth `.well-known` (4 GET × 4s) — utile pour le re-probe rapide des evals."""
    transport = None          # ("streamable", sid) | ("sse", SSESession)
    init = {}
    init_ms = 0

    # 1) tentative Streamable-HTTP
    st, sid, raw, init_ms, wa = _post(url, INIT, token=token)
    if st == 200:
        transport = ("streamable", sid)
        init = _parse(raw) or {}

    # 2) sinon, tentative SSE legacy (405 = POST refusé, ou URL en /sse)
    elif st in (404, 405, 406, 400, 415) or url.rstrip("/").endswith("sse"):
        sse = SSESession(url, token=token)
        if sse.open():
            resp, init_ms = sse.call(INIT)
            if resp is not None:
                transport = ("sse", sse)
                init = resp
            else:
                sse.close()
        elif sse.status == 401:
            wa = wa or sse.www_authenticate or "Bearer"
            st = 401

    # 3) échec : message clair (OAuth ? sinon handshake)
    if transport is None:
        wk = _well_known(url)
        if st == 401 or (wa and "bearer" in (wa or "").lower()) or wk.get("oauth_protected_resource"):
            return {"error": "MCP protégé par OAuth — un token (Bearer) est requis pour l'auditer",
                    "auth_required": True, "http": st or 401, "well_known": wk}
        return {"error": f"handshake HTTP {st}", "http": st, "well_known": wk}

    kind = transport[0]

    def call(method, params=None, idn=None):
        body = {"jsonrpc": "2.0", "method": method, "params": params or {}}
        if idn is not None:
            body["id"] = idn
        if kind == "streamable":
            _, _, r, ms, _ = _post(url, body, sid=transport[1], token=token)
            return _parse(r), ms
        return transport[1].call(body)

    def list_items(method, key):
        items, cursor, pages = [], None, 0
        while True:
            o, _ = call(method, {"cursor": cursor} if cursor else {}, idn=50 + pages)
            o = o or {}
            res = o.get("result", {})
            items += res.get(key, [])
            cursor = res.get("nextCursor")
            pages += 1
            if not cursor or pages > 20:
                break
        return items, pages, (pages > 1)

    try:
        result = init.get("result", {})
        call("notifications/initialized")             # notification (sans id)
        caps = result.get("capabilities", {})
        tools, _, tools_paginated = list_items("tools/list", "tools")
        _, tools_ms = call("tools/list", {}, idn=9)
        resources, prompts = [], []
        if "resources" in caps:
            resources, _, _ = list_items("resources/list", "resources")
        if "prompts" in caps:
            prompts, _, _ = list_items("prompts/list", "prompts")
        # JSON-RPC conformance battery
        o1, _ = call("nope/unknown", {}, idn=91)
        o2, _ = call("tools/call", {"name": "__checkmcp_nonexistent__", "arguments": {}}, idn=92)
        o1, o2 = o1 or {}, o2 or {}
        jsonrpc = [
            bool(isinstance(o1.get("error"), dict) and "code" in o1.get("error", {}) and o1.get("id") == 91),
            bool(isinstance(o2.get("error"), dict) or (o2.get("result", {}) or {}).get("isError") is True),
        ]
        return {
            "server": result.get("serverInfo", {}),
            "protocolVersion": result.get("protocolVersion", "?"),
            "transport": "sse-legacy" if kind == "sse" else "streamable-http",
            "auth": "oauth" if (token or (discover and _well_known(url).get("oauth_protected_resource"))) else "none",
            "capabilities": caps,
            "tools": tools, "resources": resources, "prompts": prompts,
            "tools_paginated": tools_paginated,
            "jsonrpc_conformance": jsonrpc,
            "well_known": _well_known(url) if discover else {},
            "capabilities_coherence": {
                "declares_resources": "resources" in caps, "has_resources": bool(resources),
                "declares_prompts": "prompts" in caps, "has_prompts": bool(prompts),
            },
            "latency": {"initialize_ms": round(init_ms), "tools_list_ms": round(tools_ms)},
        }
    finally:
        if kind == "sse":
            transport[1].close()
