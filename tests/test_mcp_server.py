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
