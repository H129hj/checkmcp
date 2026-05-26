"""MCP probe — handshake + tools/resources/prompts + JSON-RPC conformance + latence.
Transport: streamable-HTTP (POST <url>). stdlib uniquement (urllib)."""
import json, time, urllib.request, urllib.error


def _post(url, body, sid=None, token=None, timeout=40):
    h = {"Content-Type": "application/json", "Accept": "application/json, text/event-stream"}
    if token:
        h["Authorization"] = "Bearer " + token
    if sid:
        h["Mcp-Session-Id"] = sid
    req = urllib.request.Request(url, data=json.dumps(body).encode(), headers=h, method="POST")
    t0 = time.time()
    try:
        r = urllib.request.urlopen(req, timeout=timeout)
        return r.status, r.headers.get("mcp-session-id"), r.read().decode(), (time.time() - t0) * 1000
    except urllib.error.HTTPError as e:
        return e.code, None, e.read().decode(), (time.time() - t0) * 1000


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


def _list(url, sid, token, method, key):
    items, cursor, pages = [], None, 0
    while True:
        params = {"cursor": cursor} if cursor else {}
        st, _, raw, _ = _post(url, {"jsonrpc": "2.0", "id": 50 + pages, "method": method, "params": params}, sid=sid, token=token)
        o = _parse(raw) or {}
        res = o.get("result", {})
        items += res.get(key, [])
        cursor = res.get("nextCursor")
        pages += 1
        if not cursor or pages > 20:
            break
    return items, pages, (pages > 1)


def probe(url, token=None):
    """Retourne le Probe artifact (dict) ou {error:...}."""
    st, sid, raw, init_ms = _post(url, {"jsonrpc": "2.0", "id": 1, "method": "initialize",
        "params": {"protocolVersion": "2024-11-05", "capabilities": {}, "clientInfo": {"name": "checkmcp", "version": "0.1.0"}}}, token=token)
    if st != 200:
        return {"error": f"handshake HTTP {st}", "http": st}
    init = _parse(raw) or {}
    result = init.get("result", {})
    try:
        _post(url, {"jsonrpc": "2.0", "method": "notifications/initialized", "params": {}}, sid=sid, token=token)
    except Exception:
        pass
    caps = result.get("capabilities", {})
    tools, _, tools_paginated = _list(url, sid, token, "tools/list", "tools")
    # latency: re-time tools/list
    _, _, _, tools_ms = _post(url, {"jsonrpc": "2.0", "id": 9, "method": "tools/list", "params": {}}, sid=sid, token=token)
    resources, prompts = [], []
    if "resources" in caps:
        resources, _, _ = _list(url, sid, token, "resources/list", "resources")
    if "prompts" in caps:
        prompts, _, _ = _list(url, sid, token, "prompts/list", "prompts")
    # JSON-RPC conformance battery
    _, _, r1, _ = _post(url, {"jsonrpc": "2.0", "id": 91, "method": "nope/unknown", "params": {}}, sid=sid, token=token)
    _, _, r2, _ = _post(url, {"jsonrpc": "2.0", "id": 92, "method": "tools/call", "params": {"name": "__checkmcp_nonexistent__", "arguments": {}}}, sid=sid, token=token)
    o1, o2 = _parse(r1) or {}, _parse(r2) or {}
    jsonrpc = [
        bool(isinstance(o1.get("error"), dict) and "code" in o1.get("error", {}) and o1.get("id") == 91),
        bool(isinstance(o2.get("error"), dict) or (o2.get("result", {}) or {}).get("isError") is True),
    ]
    return {
        "server": result.get("serverInfo", {}),
        "protocolVersion": result.get("protocolVersion", "?"),
        "capabilities": caps,
        "tools": tools, "resources": resources, "prompts": prompts,
        "tools_paginated": tools_paginated,
        "jsonrpc_conformance": jsonrpc,
        "latency": {"initialize_ms": round(init_ms), "tools_list_ms": round(tools_ms)},
    }
