"""Self-hosted CheckMCP Gateway — a single-backend MCP proxy you run in YOUR own infra.

Your agent connects to this gateway instead of the raw MCP server; the gateway proxies every call,
inspects tool outputs for injection/exfiltration/secrets, checks a score/policy and (in active mode)
blocks/strips danger before it reaches the agent. Tool traffic never leaves your network. stdlib only.

Config (env):
  GATEWAY_BACKEND_URL    (required)  the real MCP server to proxy, e.g. https://mcp.example.com/mcp
  GATEWAY_BACKEND_TOKEN  (optional)  OAuth Bearer for the backend (stays in your env)
  GATEWAY_SECRET         (optional)  if set, the agent must send Authorization: Bearer <secret>
  GATEWAY_MODE           passive|active   (default passive: observe+log; active: block/strip)
  GATEWAY_MIN_SCORE      int (default 0=off)  active: block calls if backend MCP Score < this
  GATEWAY_BLOCK_INJECTION 1|0 (default 1)     active: strip tool outputs with HIGH findings
  GATEWAY_PORT           (default 8080)
Logs one JSON object per line to stdout (pipe to your logging stack).
Run: python -m checkmcp.gateway   (or the Docker image)
"""
import json
import os
import sys
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from . import __version__
from .probe import probe, call_one, call_tools
from .score import score as score_fn
from .evals import _analyze
from .monitor import fingerprint, diff, summarize

BACKEND = os.environ.get("GATEWAY_BACKEND_URL", "")
TOKEN = os.environ.get("GATEWAY_BACKEND_TOKEN") or None
SECRET = os.environ.get("GATEWAY_SECRET") or None
MODE = os.environ.get("GATEWAY_MODE", "passive")
PORT = int(os.environ.get("GATEWAY_PORT", "8080"))
MIN_SCORE = int(os.environ.get("GATEWAY_MIN_SCORE", "0") or "0")
BLOCK_INJECTION = os.environ.get("GATEWAY_BLOCK_INJECTION", "1") != "0"

_state = {"session": None, "baseline": None, "score": None, "grade": None}


def log(**kw):
    kw["ts"] = round(time.time())
    print(json.dumps(kw), flush=True)


def _score_once():
    if _state["score"] is None:
        p = probe(BACKEND, token=TOKEN, discover=False)
        if not p.get("error"):
            r = score_fn(p)
            _state["score"], _state["grade"] = r.get("score"), r.get("grade")
            _state["baseline"] = fingerprint(p)
    return _state["score"]


def handle(msg):
    method, mid = msg.get("method"), msg.get("id")
    if method == "initialize":
        log(event="initialize")
        return {"jsonrpc": "2.0", "id": mid, "result": {"protocolVersion": "2024-11-05",
                "capabilities": {"tools": {}}, "serverInfo": {"name": "CheckMCP Gateway (self-hosted)", "version": __version__}}}
    if method == "notifications/initialized":
        return None
    if method == "tools/list":
        p = probe(BACKEND, token=TOKEN, discover=False)
        if p.get("error"):
            log(event="backend_error", detail=p["error"][:120])
            return {"jsonrpc": "2.0", "id": mid, "error": {"code": -32011, "message": "backend unreachable: " + p["error"][:80]}}
        tools = p.get("tools", [])
        fp = fingerprint(p)
        if _state["baseline"]:
            s = summarize(diff(_state["baseline"], fp))
            if s["drift"]:
                log(event="drift", verdict=s["verdict"], events=s["events"][:6])
        else:
            _state["baseline"] = fp
        r = score_fn(p)
        _state["score"], _state["grade"] = r.get("score"), r.get("grade")
        log(event="tools/list", tools=len(tools), score=r.get("score"), grade=r.get("grade"))
        return {"jsonrpc": "2.0", "id": mid, "result": {"tools": tools}}
    if method == "tools/call":
        params = msg.get("params") or {}
        name, args = params.get("name"), params.get("arguments") or {}
        active = MODE == "active"
        if active and MIN_SCORE:
            sc = _score_once()
            if sc is not None and sc < MIN_SCORE:
                log(event="policy_blocked", tool=name, score=sc, min_score=MIN_SCORE)
                return {"jsonrpc": "2.0", "id": mid, "result": {"isError": True, "content": [{"type": "text",
                        "text": "⛔ CheckMCP policy: backend MCP Score %s is below the required %s" % (sc, MIN_SCORE)}]}}
        c = call_one(BACKEND, name, args, token=TOKEN, session_id=_state["session"])
        if c is None:
            res = call_tools(BACKEND, [(name, args)], token=TOKEN)
            if isinstance(res, dict) and res.get("error"):
                log(event="backend_error", tool=name)
                return {"jsonrpc": "2.0", "id": mid, "error": {"code": -32011, "message": "backend error"}}
            c = (res.get("calls") or [{}])[0]
        elif c.get("_session"):
            _state["session"] = c["_session"]
        findings = _analyze(name, c.get("text", ""), c.get("result")) if c.get("ok") else []
        high = [f for f in findings if f.get("severity") == "HIGH"]
        if active and BLOCK_INJECTION and high:
            kinds = ", ".join(sorted({f["type"] for f in high}))
            log(event="output_blocked", tool=name, kinds=kinds)
            return {"jsonrpc": "2.0", "id": mid, "result": {"isError": True, "content": [{"type": "text",
                    "text": "⚠️ CheckMCP blocked this tool response (%s). The original output was withheld." % kinds}]}}
        log(event="tools/call", tool=name, findings=[f["type"] for f in findings], ms=c.get("ms"))
        return {"jsonrpc": "2.0", "id": mid, "result": c.get("result") or {"content": [{"type": "text", "text": ""}]}}
    return {"jsonrpc": "2.0", "id": mid, "error": {"code": -32601, "message": "unsupported method: " + str(method)}}


class H(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def _send(self, code, obj):
        b = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(b)))
        self.end_headers()
        self.wfile.write(b)

    def do_GET(self):
        if self.path == "/health":
            return self._send(200, {"status": "ok", "version": __version__, "backend": BACKEND, "mode": MODE})
        self._send(404, {"error": "POST your MCP messages to /mcp"})

    def do_POST(self):
        if SECRET:
            auth = self.headers.get("Authorization", "")
            provided = auth[7:].strip() if auth.lower().startswith("bearer ") else ""
            if provided != SECRET:
                return self._send(401, {"error": "gateway auth required (Authorization: Bearer <GATEWAY_SECRET>)"})
        try:
            ln = int(self.headers.get("Content-Length", "0") or "0")
            msg = json.loads(self.rfile.read(ln) or "{}")
        except Exception:
            return self._send(400, {"error": "bad json"})
        try:
            resp = handle(msg)
        except Exception as e:
            return self._send(200, {"jsonrpc": "2.0", "id": msg.get("id"), "error": {"code": -32000, "message": "gateway error: " + str(e)[:80]}})
        if resp is None:
            self.send_response(202); self.end_headers(); return
        self._send(200, resp)


def main():
    if not BACKEND:
        print("FATAL: set GATEWAY_BACKEND_URL", file=sys.stderr)
        return 2
    log(event="start", backend=BACKEND, mode=MODE, min_score=MIN_SCORE, auth=bool(SECRET), version=__version__)
    ThreadingHTTPServer(("0.0.0.0", PORT), H).serve_forever()
    return 0


if __name__ == "__main__":
    sys.exit(main())
