"""Tests du mode serveur MCP (protocole stdio JSON-RPC)."""
import io
import json

from checkmcp import mcp_server


def _rpc(lines):
    out = io.StringIO()
    mcp_server.serve(inp=io.StringIO("\n".join(json.dumps(m) for m in lines) + "\n"), out=out)
    return [json.loads(l) for l in out.getvalue().splitlines() if l.strip()]


def test_initialize_and_list():
    rs = _rpc([
        {"jsonrpc": "2.0", "id": 1, "method": "initialize",
         "params": {"protocolVersion": "2025-03-26", "capabilities": {}}},
        {"jsonrpc": "2.0", "method": "notifications/initialized"},
        {"jsonrpc": "2.0", "id": 2, "method": "tools/list"},
    ])
    assert rs[0]["result"]["protocolVersion"] == "2025-03-26"  # echoes a supported version
    assert rs[0]["result"]["serverInfo"]["name"] == "checkmcp"
    tools = rs[1]["result"]["tools"]
    assert len(tools) == 1 and tools[0]["name"] == "audit_mcp_server"
    assert tools[0]["inputSchema"]["additionalProperties"] is False
    assert tools[0]["annotations"]["readOnlyHint"] is True


def test_unknown_method_and_unknown_tool():
    rs = _rpc([
        {"jsonrpc": "2.0", "id": 1, "method": "nope/nope"},
        {"jsonrpc": "2.0", "id": 2, "method": "tools/call", "params": {"name": "bad", "arguments": {}}},
    ])
    assert rs[0]["error"]["code"] == -32601
    assert rs[1]["error"]["code"] == -32602


def test_call_missing_url_is_tool_error_not_crash():
    rs = _rpc([{"jsonrpc": "2.0", "id": 1, "method": "tools/call",
                "params": {"name": "audit_mcp_server", "arguments": {}}}])
    assert rs[0]["result"]["isError"] is True
    assert "url" in rs[0]["result"]["content"][0]["text"]


def test_call_happy_path_with_stubbed_engine(monkeypatch):
    monkeypatch.setattr(mcp_server, "_run_audit",
                        lambda url, token=None: (f"# MCP Score: 91/100 (grade A) — {url}", False))
    rs = _rpc([{"jsonrpc": "2.0", "id": 7, "method": "tools/call",
                "params": {"name": "audit_mcp_server", "arguments": {"url": "https://x.example/mcp"}}}])
    r = rs[0]["result"]
    assert r["isError"] is False
    assert "91/100" in r["content"][0]["text"]


def test_probe_error_surfaces_as_is_error(monkeypatch):
    import checkmcp.probe
    monkeypatch.setattr(checkmcp.probe, "probe", lambda url, token=None, discover=True: {"error": "handshake failed"})
    rs = _rpc([{"jsonrpc": "2.0", "id": 8, "method": "tools/call",
                "params": {"name": "audit_mcp_server", "arguments": {"url": "https://dead.example/mcp"}}}])
    assert rs[0]["result"]["isError"] is True
    assert "handshake failed" in rs[0]["result"]["content"][0]["text"]


def test_run_audit_assembles_markdown_from_score(monkeypatch):
    """Exercise the real _run_audit success path (score() + markdown assembly), not a stub.

    Guards against regressions in the pillar loop, the Δ-embedding findings line and the
    facts/floor lines — the code path the stubbed happy-path test never touches."""
    import checkmcp.probe
    import checkmcp.score
    monkeypatch.setattr(checkmcp.probe, "probe", lambda url, token=None, discover=True: {"ok": True})
    fake = {
        "score": 73, "grade": "C", "floor": "secret in schema",
        "facts": {"proto": "2025-06-18", "tools": 5, "resources": 0, "prompts": 0, "tools_list_tokens": 420},
        "pillars": {"security": 40, "tool_design": 90, "desc_schema": 66, "reliability": 80,
                    "token": 95, "compliance": 50, "use_case": 50},
        "findings": [{"severity": "HIGH", "delta": 5.4, "measured": "0% typed params",
                      "mechanism": "schema is the contract", "effect": "malformed calls"}],
    }
    monkeypatch.setattr(checkmcp.score, "score", lambda p: fake)
    text, is_err = mcp_server._run_audit("https://x.example/mcp")
    assert is_err is False
    assert "# MCP Score: 73/100 (grade C)" in text
    assert "FLOOR applied: secret in schema" in text
    assert "Protocol 2025-06-18 · 5 tools" in text
    assert "- Security: 40/100" in text and "- Coverage: 50/100" in text
    assert "Δ5.4" in text and "0% typed params" in text and "→ malformed calls" in text


def test_batch_array_and_scalar_do_not_kill_session():
    """A JSON-RPC batch array or a bare scalar is valid JSON but not an object.

    Regression for the crash where _handle(msg) ran msg.get() on a list/int and the
    uncaught AttributeError terminated the whole stdio session."""
    out = io.StringIO()
    inp = io.StringIO(
        json.dumps([{"jsonrpc": "2.0", "id": 1, "method": "ping"}]) + "\n"  # batch array
        + "123\n"                                                            # bare scalar
        + json.dumps({"jsonrpc": "2.0", "id": 2, "method": "ping"}) + "\n"   # must still be served
    )
    mcp_server.serve(inp=inp, out=out)
    rs = [json.loads(l) for l in out.getvalue().splitlines() if l.strip()]
    assert rs[0]["error"]["code"] == -32600  # Invalid Request, not a crash
    assert rs[1]["error"]["code"] == -32600
    assert rs[2]["id"] == 2 and rs[2]["result"] == {}  # session survived the two bad lines


def test_non_dict_arguments_is_tool_error_not_crash():
    """arguments sent as a string (not an object) must degrade to missing-url, not crash."""
    rs = _rpc([{"jsonrpc": "2.0", "id": 1, "method": "tools/call",
                "params": {"name": "audit_mcp_server", "arguments": "https://x/mcp"}}])
    assert rs[0]["result"]["isError"] is True
    assert "url" in rs[0]["result"]["content"][0]["text"]


def test_params_as_array_is_error_not_crash():
    """params sent as an array must not crash the params.get() access."""
    rs = _rpc([{"jsonrpc": "2.0", "id": 1, "method": "tools/call", "params": ["x"]}])
    assert rs[0]["error"]["code"] == -32602  # name is None → unknown tool


def test_handler_exception_becomes_internal_error_and_session_survives(monkeypatch):
    def boom(msg):
        raise RuntimeError("kaboom")
    monkeypatch.setattr(mcp_server, "_handle", boom)
    out = io.StringIO()
    inp = io.StringIO(json.dumps({"jsonrpc": "2.0", "id": 5, "method": "ping"}) + "\n"
                      + json.dumps({"jsonrpc": "2.0", "id": 6, "method": "ping"}) + "\n")
    mcp_server.serve(inp=inp, out=out)
    rs = [json.loads(l) for l in out.getvalue().splitlines() if l.strip()]
    assert rs[0]["error"]["code"] == -32603 and rs[0]["id"] == 5
    assert rs[1]["error"]["code"] == -32603 and rs[1]["id"] == 6  # second message still handled


def test_write_falls_back_when_stream_cannot_encode_utf8():
    """_write must not raise on a cp1252 stdout (Windows): it falls back to ASCII escapes."""
    class Cp1252Out:
        def __init__(self):
            self.buf = []
        def write(self, s):
            s.encode("cp1252")  # raises UnicodeEncodeError on Δ / → before appending
            self.buf.append(s)
        def flush(self):
            pass
    out = Cp1252Out()
    mcp_server._write(out, {"jsonrpc": "2.0", "id": 1, "result": {"text": "Δ → —"}})
    written = "".join(out.buf)
    assert "\\u0394" in written  # fell back to ensure_ascii, encodable in cp1252
