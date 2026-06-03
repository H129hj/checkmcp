#!/usr/bin/env python3
"""API CheckMCP — service HTTP stdlib (zéro dépendance).
Routes: /health · /api/score?url= · /badge/<slug>.svg(?url=) · /mcp/<slug>(?url=) · /audit?url=
Cache TTL + catalogue slug->url persistant."""
import json, time, re, os, sys, hashlib, threading, secrets, socket, ipaddress
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs


def public_url(url):
    """True seulement si l'URL est un endpoint http(s) PUBLIC. Bloque localhost/IP privées/link-local
    (169.254.169.254 = métadonnées cloud) → anti-SSRF sur les endpoints qui sondent une URL arbitraire."""
    try:
        u = urlparse(url)
        if u.scheme not in ("http", "https") or not u.hostname:
            return False
        for info in socket.getaddrinfo(u.hostname, None):
            ip = ipaddress.ip_address(info[4][0])
            if (ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved
                    or ip.is_multicast or ip.is_unspecified):
                return False
        return True
    except Exception:
        return False


def _json(obj):
    """Sérialise en gérant datetime (default=str) — les rows PG portent des timestamptz."""
    return json.dumps(obj, ensure_ascii=False, default=str)

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from checkmcp import __version__
from checkmcp.probe import probe, call_tools, call_one
from checkmcp.score import score
from checkmcp.optimize import optimize
from checkmcp.badge import badge_svg
from checkmcp.page import render as render_page
from checkmcp.repo import fetch as repo_fetch, score_repo
from checkmcp.monitor import fingerprint, diff, summarize
from checkmcp import store
from checkmcp.plans import plan_of

TTL = 6 * 3600
INTERNAL_SECRET = os.environ.get("CHECKMCP_INTERNAL_SECRET")   # partagé avec le front pour les audits privés
CALLBACK_BASE = os.environ.get("CHECKMCP_CALLBACK_BASE", "https://checkmcp.dev/cx")   # canary-callback evals
_canary_hits = {}     # token -> True (en mémoire ; les evals tournent dans ce même process)

# jobs d'evals asynchrones (en mémoire, mono-instance ; #16 = Postgres/Redis pour le multi-instance)
_jobs = {}
_jobs_lock = threading.Lock()


def _run_eval_job(job_id, url, token):
    """Worker en thread : probe + behavioral_eval, met à jour le job. Borné en wall-clock."""
    try:
        from checkmcp.evals import behavioral_eval
        p2 = probe(url, token=token, discover=False)
        if p2.get("error"):
            res = {"ran": False, "reason": p2["error"]}
        else:
            p2["url"] = url
            res = behavioral_eval(p2, token=token, max_tools=4, timeout=6,
                                  callback_base=CALLBACK_BASE, hit_check=lambda t: _canary_hits.pop(t, False))
        with _jobs_lock:
            if job_id in _jobs:
                _jobs[job_id].update(status="done", evals=res)
    except Exception as e:
        with _jobs_lock:
            if job_id in _jobs:
                _jobs[job_id].update(status="error", error=str(e)[:160])


def _new_eval_job(url, token):
    with _jobs_lock:                                  # purge des jobs >15 min
        cutoff = time.time() - 900
        for k in [k for k, v in _jobs.items() if v.get("created", 0) < cutoff]:
            _jobs.pop(k, None)
    jid = secrets.token_hex(8)
    with _jobs_lock:
        _jobs[jid] = {"status": "running", "created": time.time()}
    threading.Thread(target=_run_eval_job, args=(jid, url, token), daemon=True).start()
    return jid
BASELINES = os.environ.get("CHECKMCP_BASELINES", os.path.join(os.path.dirname(os.path.abspath(__file__)), "baselines.json"))
_baselines = {}


def _load_baselines():
    global _baselines
    try:
        _baselines = json.load(open(BASELINES))
    except Exception:
        _baselines = {}


def monitor_for(url, pin=False, label=None, min_score=None):
    p = probe(url)
    if p.get("error"):
        return {"url": url, "error": p["error"]}
    fp = fingerprint(p)
    sc = score(p)
    if store.enabled():
        base = store.get_baseline(url)
        if base is None or pin:
            store.upsert_baseline(url, fp, label=label, min_score=min_score)
            store.insert_run(url, score=sc.get("score"), grade=sc.get("grade"), drift=False, pillars=sc.get("pillars"))
            return {"url": url, "pinned": True, "set_hash": fp["set_hash"], "count": fp["count"],
                    "score": sc.get("score"), "grade": sc.get("grade"), "drift": False, "backend": "postgres"}
        res = summarize(diff(base.get("fingerprint", {}), fp))
        res.update({"url": url, "baseline_hash": base.get("set_hash"), "current_hash": fp["set_hash"], "count": fp["count"],
                    "score": sc.get("score"), "grade": sc.get("grade"), "backend": "postgres"})
        store.insert_run(url, score=sc.get("score"), grade=sc.get("grade"), drift=res["drift"],
                         verdict=res.get("verdict"), pillars=sc.get("pillars"), events=res.get("events"))
        return res
    # fallback JSON local
    base = _baselines.get(url)
    if base is None or pin:
        _baselines[url] = fp
        try:
            json.dump(_baselines, open(BASELINES, "w"))
        except Exception:
            pass
        return {"url": url, "pinned": True, "set_hash": fp["set_hash"], "count": fp["count"], "drift": False, "backend": "json"}
    s = summarize(diff(base, fp))
    s.update({"url": url, "baseline_hash": base["set_hash"], "current_hash": fp["set_hash"], "count": fp["count"], "backend": "json"})
    return s
GH_TOKEN = os.environ.get("GITHUB_TOKEN")
_repo_cache = {}


def repo_for(repo):
    now = time.time()
    if repo in _repo_cache and now - _repo_cache[repo][0] < TTL:
        return _repo_cache[repo][1]
    m = repo_fetch(repo, GH_TOKEN)
    r = m if m.get("error") else score_repo(m)
    if not r.get("error") and store.enabled():
        store.save_repo_audit(r)
    _repo_cache[repo] = (now, r)
    return r
PORT = int(os.environ.get("CHECKMCP_PORT", "8799"))
CATALOG = os.environ.get("CHECKMCP_CATALOG", os.path.join(os.path.dirname(os.path.abspath(__file__)), "catalog.json"))
_cache = {}            # url -> (ts, result)
_catalog = {}          # slug -> url


def _slug(url):
    # host + segments de chemin significatifs (pour distinguer p.ex. gitmcp.io/<repo>),
    # en éliminant les suffixes de transport (/mcp, /sse, /api).
    s = re.sub(r"^https?://", "", url.rstrip("/"))
    parts = [p for p in s.split("/") if p]
    host = parts[0] if parts else s
    path = [p for p in parts[1:] if p.lower() not in ("mcp", "sse", "api")]
    return re.sub(r"[^a-z0-9]+", "-", "-".join([host] + path).lower()).strip("-")


def _load():
    global _catalog
    try:
        _catalog = json.load(open(CATALOG))
    except Exception:
        _catalog = {}
    if store.enabled():            # seed depuis Postgres (survit aux redémarrages)
        try:
            _catalog.update(store.catalog())
        except Exception:
            pass


def _save():
    try:
        json.dump(_catalog, open(CATALOG, "w"))
    except Exception:
        pass


def result_for(url, force=False):
    now = time.time()
    if not force and url in _cache and now - _cache[url][0] < TTL:
        return _cache[url][1]
    if not force and store.enabled():          # read-through Postgres (cache partagé/persistant)
        cached = store.get_audit(url, max_age_s=TTL)
        if cached:
            _cache[url] = (now, cached)
            return cached
    p = probe(url)
    if p.get("error"):
        return {**p, "url": url}          # préserve auth_required / well_known pour le front
    r = score(p); r["optimize"] = optimize(p); r["url"] = url; r["server"] = p.get("server", {})
    _cache[url] = (now, r)
    slug = _slug(url)
    _catalog[slug] = url
    if store.enabled():
        store.save_audit(url, slug, r)
    else:
        _save()
    return r


def private_result(url, token):
    """Audit authentifié (token Bearer) — pour les MCP OAuth-gated. Jamais caché ni persisté."""
    p = probe(url, token=token)
    if p.get("error"):
        return {**p, "url": url}
    r = score(p); r["optimize"] = optimize(p); r["url"] = url; r["server"] = p.get("server", {}); r["private"] = True
    return r


def quota_check(headers):
    """Garde de quota pour l'API métrée (clé `X-CheckMCP-Key`).
    Sans clé → (None, None) : accès public best-effort, non métré.
    Avec clé valide → ({user_id, plan}, None) après incrément du compteur du jour.
    Sur clé invalide / quota dépassé → (None, (code, payload))."""
    key = headers.get("X-CheckMCP-Key", "").strip()
    if not key:
        return None, None
    if not store.enabled():
        return None, None
    kh = hashlib.sha256(key.encode()).hexdigest()
    owner = store.api_key_owner(kh)
    if not owner:
        return None, (401, {"error": "invalid API key"})
    limit = plan_of(owner.get("plan")).get("api_per_day", 50)
    used = store.bump_api_usage(kh)
    used = used if isinstance(used, int) else 0       # fail-open si la base bronche
    if used > limit:
        return None, (429, {"error": "daily API quota exceeded", "plan": owner.get("plan"),
                            "limit": limit, "used": used, "upgrade": "https://checkmcp.dev/pricing"})
    return owner, None


def maybe_evals(url, r, allowed, requested, token=None):
    """Lance les evals comportementaux si demandés (?evals=1) ET autorisés (clé Pro/Team OU secret interne front).
    Renvoie (error_response|None) ; attache r['evals'] en place. Marche pour l'audit public ET privé OAuth."""
    if not requested or r.get("error"):
        return None
    if not allowed:
        return (402, {"error": "behavioral evals require a Pro plan",
                      "upgrade": "https://checkmcp.dev/pricing"})
    try:
        from checkmcp.evals import behavioral_eval
        p2 = probe(url, token=token, discover=False)       # token transmis → marche sur les MCP OAuth
        if not p2.get("error"):
            p2["url"] = url
            ev = behavioral_eval(p2, token=token, max_tools=3, timeout=5,   # enveloppe wall-clock courte
                                 callback_base=CALLBACK_BASE,
                                 hit_check=lambda t: _canary_hits.pop(t, False))
            r["evals"] = ev
            # un serveur malicious confirmé au runtime → floor + grade F (cohérent avec la CLI)
            if ev.get("verdict") == "malicious":
                r["floor"] = r.get("floor") or "behavioral: active injection/exfiltration confirmed at runtime"
                r["grade"] = "F"
                for f in ev.get("findings", []):
                    if f.get("severity") == "HIGH":
                        r.setdefault("findings", []).insert(0, {
                            "pillar": "security", "severity": "CRITICAL",
                            "measured": f"[behavioral] {f['type']} — {f['tool']}",
                            "mechanism": f.get("detail", ""), "effect": f.get("evidence") or "confirmed at runtime", "delta": 0})
    except Exception as e:
        r["evals"] = {"ran": False, "reason": str(e)[:120]}
    return None


_SEV = {"LOW": 0, "MEDIUM": 1, "HIGH": 2, "CRITICAL": 3}


def evaluate_policy(url, policy, require_public=True):
    """Évalue une URL MCP contre la policy d'gouvernance → verdict {allowed, grade, score, reasons[]}.
    C'est le control-plane : un agent/CI/gateway l'appelle AVANT de se connecter à un serveur.
    require_public=False pour le gateway (backend configuré, possiblement interne/self-hosted)."""
    host = (urlparse(url).hostname or "").lower()
    reasons = []
    if require_public and not public_url(url):
        return {"allowed": False, "url": url, "score": None, "grade": None,
                "reasons": ["url is not a public http(s) MCP endpoint"], "policy": policy}
    allow = [h.lower() for h in (policy.get("allowlist_hosts") or [])]
    deny = [h.lower() for h in (policy.get("denylist_hosts") or [])]
    if deny and host in deny:
        reasons.append(f"host '{host}' is on the denylist")
    if allow and host not in allow:
        reasons.append(f"host '{host}' is not on the allowlist")

    r = result_for(url)
    if r.get("error"):
        return {"allowed": False, "url": url, "score": None, "grade": None,
                "reasons": [f"audit failed: {r['error']}"], "policy": policy}
    score, grade, facts = r.get("score"), r.get("grade"), r.get("facts", {})
    ms = policy.get("min_score")
    if isinstance(ms, int) and isinstance(score, int) and score < ms:
        reasons.append(f"MCP Score {score} below minimum {ms}")
    if policy.get("block_floor", True) and r.get("floor"):
        reasons.append(f"security hard-floor: {r.get('floor')}")
    if policy.get("block_lethal_trifecta", True) and facts.get("lethal_trifecta"):
        reasons.append("lethal trifecta present (untrusted + sensitive + exfil/destructive)")
    cap = _SEV.get(policy.get("max_severity", "MEDIUM"), 1)
    over = [o for o in (facts.get("owasp") or []) if _SEV.get(o.get("sev"), 0) > cap]
    if over:
        reasons.append(f"{len(over)} security finding(s) above {policy.get('max_severity','MEDIUM')} "
                       f"({', '.join(sorted({o['id'] for o in over}))})")
    if policy.get("require_monitored") and not store.get_baseline(url):
        reasons.append("server is not pinned/monitored (no baseline)")
    if policy.get("block_malicious_eval", True) and store.last_eval(url) == "malicious":
        reasons.append("behavioral eval flagged this server as malicious at runtime")

    return {"allowed": len(reasons) == 0, "url": url, "score": score, "grade": grade,
            "reasons": reasons or ["passes all policy checks"], "policy": policy}


GW_ALLOW_PRIVATE = os.environ.get("CHECKMCP_GW_ALLOW_PRIVATE") == "1"   # self-hosted : autoriser backends internes
_gw_sessions = {}     # gid -> session_id backend (réutilisation streamable-http → évite un INIT par appel)


def gateway_proxy(gw, msg):
    """Proxy MCP PASSIF : forward au backend, inspecte (policy + sortie), logue — NE BLOQUE PAS.
    Renvoie l'objet JSON-RPC réponse (ou None pour une notification)."""
    method, mid, gid, backend = msg.get("method"), msg.get("id"), gw["id"], gw["backend_url"]
    # anti-SSRF : sur le gateway HÉBERGÉ, le backend doit être public (un flag relâche pour le self-hosted)
    if not GW_ALLOW_PRIVATE and not public_url(backend):
        store.log_gateway_call(gid, method or "?", flagged=True, verdict="blocked_ssrf")
        return {"jsonrpc": "2.0", "id": mid, "error": {"code": -32010, "message": "gateway backend must be a public MCP endpoint"}}
    if method == "initialize":
        store.log_gateway_call(gid, "initialize")
        return {"jsonrpc": "2.0", "id": mid, "result": {
            "protocolVersion": "2024-11-05", "capabilities": {"tools": {}},
            "serverInfo": {"name": "CheckMCP Gateway", "version": __version__}}}
    if method == "notifications/initialized":
        return None
    if method == "tools/list":
        t0 = time.time()
        p = probe(backend, discover=False)
        ms = round((time.time() - t0) * 1000)
        if p.get("error"):
            store.log_gateway_call(gid, "tools/list", flagged=True, verdict="backend_error",
                                   findings=[{"detail": p["error"][:120]}], ms=ms)
            return {"jsonrpc": "2.0", "id": mid, "error": {"code": -32011, "message": "backend unreachable: " + p["error"][:80]}}
        tools = p.get("tools", [])
        # passif : on évalue la policy de l'org et on LOGUE la violation éventuelle, sans bloquer
        try:
            verdict = evaluate_policy(backend, store.get_policy(gw["user_id"]), require_public=False)
            if not verdict.get("allowed"):
                store.log_gateway_call(gid, "policy", tool="(backend)", flagged=True, verdict="policy_violation",
                                       findings=[{"reasons": verdict.get("reasons")}])
        except Exception:
            pass
        store.log_gateway_call(gid, "tools/list", tool=f"{len(tools)} tools", ms=ms)
        return {"jsonrpc": "2.0", "id": mid, "result": {"tools": tools}}
    if method == "tools/call":
        params = msg.get("params") or {}
        name, args = params.get("name"), params.get("arguments") or {}
        active = gw.get("mode") == "active"
        # mode ACTIF : gate policy AVANT d'appeler le backend
        if active:
            try:
                pv = evaluate_policy(backend, store.get_policy(gw["user_id"]), require_public=False)
            except Exception:
                pv = {"allowed": True}
            if not pv.get("allowed"):
                store.log_gateway_call(gid, "tools/call", tool=name, flagged=True, verdict="policy_blocked",
                                       findings=[{"reasons": pv.get("reasons")}])
                return {"jsonrpc": "2.0", "id": mid, "result": {"isError": True, "content": [{"type": "text",
                        "text": "⛔ CheckMCP policy blocked this server: " + "; ".join(pv.get("reasons", []))}]}}
        # fast-path : réutilise la session backend (1 round-trip) ; fallback transport complet si besoin
        c = call_one(backend, name, args, session_id=_gw_sessions.get(gid), timeout=20)
        if c is None:
            res = call_tools(backend, [(name, args)], timeout=20)
            if isinstance(res, dict) and res.get("error"):
                store.log_gateway_call(gid, "tools/call", tool=name, flagged=True, verdict="backend_error", ms=None)
                return {"jsonrpc": "2.0", "id": mid, "error": {"code": -32011, "message": "backend error"}}
            c = (res.get("calls") or [{}])[0]
        elif c.get("_session"):
            if len(_gw_sessions) > 5000:
                _gw_sessions.clear()
            _gw_sessions[gid] = c["_session"]
        ms = c.get("ms")
        from checkmcp.evals import _analyze
        findings = _analyze(name, c.get("text", ""), c.get("result")) if c.get("ok") else []
        high = [f for f in findings if f.get("severity") == "HIGH"]
        # mode ACTIF : une sortie d'outil dangereuse (injection/exfil/secret) est STRIPPÉE avant l'agent
        if active and high:
            store.log_gateway_call(gid, "tools/call", tool=name, flagged=True, verdict="output_blocked", findings=findings, ms=ms)
            kinds = ", ".join(sorted({f["type"] for f in high}))
            return {"jsonrpc": "2.0", "id": mid, "result": {"isError": True, "content": [{"type": "text",
                    "text": f"⚠️ CheckMCP blocked this tool response ({kinds}). The original output was withheld to protect the agent."}]}}
        store.log_gateway_call(gid, "tools/call", tool=name, flagged=bool(findings),
                               verdict="flagged" if findings else "clean", findings=findings, ms=ms)
        # PASSIF : réponse du backend telle quelle ; ACTIF clean : idem
        return {"jsonrpc": "2.0", "id": mid, "result": c.get("result") or {"content": [{"type": "text", "text": ""}]}}
    return {"jsonrpc": "2.0", "id": mid, "error": {"code": -32601, "message": "method not supported by the CheckMCP gateway: " + str(method)}}


def resolve(path_slug, qs):
    if "url" in qs:
        return qs["url"][0]
    return _catalog.get(path_slug)


class H(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def _send(self, code, body, ctype, cache=21600):
        b = body.encode() if isinstance(body, str) else body
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(b)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Cache-Control", f"public, max-age={cache}" if cache else "no-store")
        self.end_headers()
        self.wfile.write(b)

    def do_POST(self):
        # côté serveur MCP du Gateway : l'agent POST sur /gw/<id>/mcp → on proxy (passif) vers le backend
        u = urlparse(self.path)
        parts = [p for p in u.path.split("/") if p]
        if len(parts) == 3 and parts[0] == "gw" and parts[2] == "mcp":
            gw = store.get_gateway(parts[1])
            if not gw:
                return self._send(404, _json({"error": "unknown gateway"}), "application/json", cache=0)
            # auth : l'agent doit présenter le secret du gateway (Authorization: Bearer <secret>)
            secret = gw.get("secret")
            auth = self.headers.get("Authorization", "")
            provided = auth[7:].strip() if auth.lower().startswith("bearer ") else ""
            if secret and not secrets.compare_digest(provided, secret):
                return self._send(401, _json({"error": "gateway auth required (Authorization: Bearer <gateway secret>)"}),
                                  "application/json", cache=0)
            try:
                ln = int(self.headers.get("Content-Length", "0") or "0")
                msg = json.loads(self.rfile.read(ln) or "{}")
            except Exception:
                return self._send(400, _json({"error": "bad json"}), "application/json", cache=0)
            try:
                resp = gateway_proxy(gw, msg)
            except Exception as e:
                return self._send(200, _json({"jsonrpc": "2.0", "id": msg.get("id"),
                                              "error": {"code": -32000, "message": "gateway error: " + str(e)[:80]}}),
                                  "application/json", cache=0)
            if resp is None:                       # notification → 202 sans corps
                self.send_response(202); self.end_headers(); return
            return self._send(200, _json(resp), "application/json", cache=0)
        return self._send(404, _json({"error": "not found"}), "application/json", cache=0)

    def do_GET(self):
        u = urlparse(self.path)
        qs = parse_qs(u.query)
        parts = [p for p in u.path.split("/") if p]

        if u.path == "/health":
            return self._send(200, json.dumps({"status": "ok", "version": __version__, "cached": len(_cache), "catalog": len(_catalog)}), "application/json")

        # canary-callback : un serveur cible qui fetch notre URL unique (plantée dans un input d'eval) = exfiltration confirmée
        if len(parts) == 2 and parts[0] == "cx":
            if len(_canary_hits) > 10000:      # borne anti-fuite mémoire (tokens aléatoires jamais consommés)
                _canary_hits.clear()
            _canary_hits[parts[1]] = True
            return self._send(200, "ok", "text/plain", cache=0)

        # control-plane gouvernance : "ce serveur est-il autorisé sous ma policy ?" (clé API requise, métrée)
        if u.path == "/policy/check":
            owner, qerr = quota_check(self.headers)
            if qerr:
                return self._send(qerr[0], _json(qerr[1]), "application/json", cache=0)
            if not owner:
                return self._send(401, _json({"error": "API key required (header X-CheckMCP-Key)"}), "application/json", cache=0)
            url = qs.get("url", [None])[0]
            if not url:
                return self._send(400, json.dumps({"error": "param ?url= requis"}), "application/json")
            verdict = evaluate_policy(url, store.get_policy(owner["user_id"]))
            return self._send(200, _json(verdict), "application/json", cache=0)

        if u.path == "/api/monitor":
            url = qs.get("url", [None])[0]
            if not url:
                return self._send(400, json.dumps({"error": "param ?url= requis"}), "application/json")
            if not public_url(url):
                return self._send(400, _json({"error": "url must be a public http(s) MCP endpoint"}), "application/json", cache=0)
            m = monitor_for(url, pin=qs.get("pin", ["0"])[0] in ("1", "true"),
                            label=qs.get("label", [None])[0], min_score=qs.get("min_score", [None])[0])
            return self._send(200 if not m.get("error") else 422, _json(m), "application/json", cache=0)

        if u.path == "/api/monitors":
            return self._send(200, _json({"monitors": store.list_monitors()}), "application/json", cache=0)

        if u.path == "/api/runs":
            url = qs.get("url", [None])[0]
            if not url:
                return self._send(400, json.dumps({"error": "param ?url= requis"}), "application/json")
            return self._send(200, _json({"url": url, "runs": store.list_runs(url, int(qs.get("limit", ["100"])[0]))}), "application/json", cache=0)

        if u.path == "/api/directory":
            order = qs.get("order", ["score"])[0]
            limit = min(int(qs.get("limit", ["200"])[0]), 500)
            return self._send(200, _json({"servers": store.list_audits(limit=limit, order=order)}), "application/json", cache=60)

        if u.path == "/api/repo":
            slug = qs.get("slug", [None])[0]
            if slug:                                   # lecture d'un audit repo persistant
                r = store.get_repo_audit(slug)
                return self._send(200 if r else 404, _json(r or {"error": "repo inconnu"}), "application/json")
            repo = qs.get("repo", [None])[0]
            if not repo:
                return self._send(400, json.dumps({"error": "param ?repo= ou ?slug= requis"}), "application/json")
            m = repo_for(repo)
            return self._send(200 if not m.get("error") else 422, _json(m), "application/json")

        if u.path == "/api/repos":
            order = qs.get("order", ["score"])[0]
            limit = min(int(qs.get("limit", ["300"])[0]), 500)
            src = qs.get("source", [None])[0]
            return self._send(200, _json({"repos": store.list_repo_audits(limit=limit, order=order, source=src)}), "application/json", cache=60)

        if u.path == "/api/score" or u.path == "/audit":
            url = qs.get("url", [None])[0]
            if not url:
                return self._send(400, json.dumps({"error": "param ?url= requis"}), "application/json")
            if not public_url(url):
                return self._send(400, _json({"error": "url must be a public http(s) MCP endpoint"}), "application/json", cache=0)
            _owner, qerr = quota_check(self.headers)        # API métrée si clé X-CheckMCP-Key fournie
            if qerr:
                return self._send(qerr[0], _json(qerr[1]), "application/json", cache=0)
            auth = self.headers.get("Authorization", "")
            token = auth[7:].strip() if auth.lower().startswith("bearer ") else None
            want_evals = qs.get("evals", ["0"])[0] in ("1", "true")
            # autorisation Pro : clé API Pro/Team valide OU appel front via secret interne (jamais exposé au navigateur)
            internal_ok = bool(INTERNAL_SECRET and self.headers.get("X-CheckMCP-Internal", "") == INTERNAL_SECRET)
            plan_ok = bool(_owner and _owner.get("plan") in ("pro", "team"))
            pro_allowed = internal_ok or plan_ok
            if token:                                  # audit privé authentifié — jamais caché/persisté
                if not pro_allowed:
                    return self._send(402, _json({"error": "private OAuth audits require a Pro plan",
                                                  "upgrade": "https://checkmcp.dev/pricing"}), "application/json", cache=0)
                r = private_result(url, token)
                ev_err = maybe_evals(url, r, pro_allowed, want_evals, token=token)
                if ev_err:
                    return self._send(ev_err[0], _json(ev_err[1]), "application/json", cache=0)
                return self._send(200 if not r.get("error") else 422, _json(r), "application/json", cache=0)
            r = result_for(url, force=qs.get("refresh", ["0"])[0] in ("1", "true"))
            ev_err = maybe_evals(url, r, pro_allowed, want_evals)   # opt-in, réservé Pro/Team
            if ev_err:
                return self._send(ev_err[0], _json(ev_err[1]), "application/json", cache=0)
            if u.path == "/audit" and r.get("error") is None:
                return self._send(200, render_page(url, _slug(url), r), "text/html; charset=utf-8")
            err = bool(r.get("error"))
            return self._send(422 if err else 200, _json(r), "application/json", cache=0 if err else 21600)

        # ----- evals asynchrones : ?url= crée un job (renvoie un id), ?id= sonde son statut -----
        if u.path == "/api/eval-job":
            owner, _qe = quota_check(self.headers)
            internal_ok = bool(INTERNAL_SECRET and self.headers.get("X-CheckMCP-Internal", "") == INTERNAL_SECRET)
            if not (internal_ok or (owner and owner.get("plan") in ("pro", "team"))):
                return self._send(402, _json({"error": "behavioral evals require a Pro plan",
                                              "upgrade": "https://checkmcp.dev/pricing"}), "application/json", cache=0)
            jid = qs.get("id", [None])[0]
            if jid:
                with _jobs_lock:
                    j = _jobs.get(jid)
                if not j:
                    return self._send(404, _json({"error": "unknown or expired job"}), "application/json", cache=0)
                out = {"id": jid, "status": j["status"]}
                if j["status"] == "done":
                    out["evals"] = j.get("evals")
                elif j["status"] == "error":
                    out["error"] = j.get("error")
                return self._send(200, _json(out), "application/json", cache=0)
            url = qs.get("url", [None])[0]
            if not url:
                return self._send(400, json.dumps({"error": "param ?url= ou ?id= requis"}), "application/json")
            if not public_url(url):
                return self._send(400, _json({"error": "url must be a public http(s) MCP endpoint"}), "application/json", cache=0)
            auth = self.headers.get("Authorization", "")
            tok = auth[7:].strip() if auth.lower().startswith("bearer ") else None
            jid = _new_eval_job(url, tok)
            return self._send(202, _json({"id": jid, "status": "running"}), "application/json", cache=0)

        # badge repo : /badge/repo/<slug>.svg  (Repo-Quality Score, p.ex. fiches mcpizy)
        if len(parts) == 3 and parts[0] == "badge" and parts[1] == "repo" and parts[2].endswith(".svg"):
            slug = parts[2][:-4]
            repo = qs.get("repo", [None])[0]
            r = repo_for(repo) if repo else store.get_repo_audit(slug)
            if not r or r.get("error"):
                return self._send(404, badge_svg(0, "F", "Repo Score"), "image/svg+xml")
            return self._send(200, badge_svg(r["score"], r["grade"], "Repo Score"), "image/svg+xml")

        if len(parts) == 2 and parts[0] == "badge" and parts[1].endswith(".svg"):
            slug = parts[1][:-4]
            url = resolve(slug, qs)
            if not url:
                return self._send(404, badge_svg(0, "F", "MCP Score"), "image/svg+xml")
            r = result_for(url)
            sc, gr = (0, "F") if r.get("error") else (r["score"], r["grade"])
            return self._send(200, badge_svg(sc, gr), "image/svg+xml")

        if len(parts) == 2 and parts[0] == "mcp":
            slug = parts[1]
            url = resolve(slug, qs)
            if not url:
                return self._send(404, "<h1>404 — serveur inconnu. Auditez-le via /audit?url=</h1>", "text/html; charset=utf-8")
            r = result_for(url)
            if r.get("error"):
                return self._send(422, f"<h1>Audit impossible: {r['error']}</h1>", "text/html; charset=utf-8")
            return self._send(200, render_page(url, slug, r), "text/html; charset=utf-8")

        self._send(404, json.dumps({"error": "not found", "routes": ["/health", "/api/score?url=", "/audit?url=", "/badge/<slug>.svg", "/mcp/<slug>"]}), "application/json")


if __name__ == "__main__":
    _load()
    _load_baselines()
    print(f"CheckMCP API v{__version__} on :{PORT} (catalog={len(_catalog)}, baselines={len(_baselines)})", flush=True)
    ThreadingHTTPServer(("0.0.0.0", PORT), H).serve_forever()
