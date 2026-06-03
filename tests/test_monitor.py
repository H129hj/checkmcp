from checkmcp.monitor import fingerprint, diff, summarize


def _probe(tools):
    return {"tools": tools, "protocolVersion": "2025-11-25"}


def test_fingerprint_is_deterministic_and_order_insensitive():
    a = _probe([{"name": "x", "inputSchema": {"a": 1}, "description": "d"},
                {"name": "y", "inputSchema": {}, "description": ""}])
    b = _probe([{"name": "y", "inputSchema": {}, "description": ""},
                {"name": "x", "inputSchema": {"a": 1}, "description": "d"}])
    assert fingerprint(a)["set_hash"] == fingerprint(b)["set_hash"]
    assert fingerprint(a)["count"] == 2


def test_diff_detects_tool_removed_as_breaking():
    base = fingerprint(_probe([{"name": "a"}, {"name": "b"}]))
    cur = fingerprint(_probe([{"name": "a"}]))
    ev = diff(base, cur)
    types = {(e["type"], e["severity"]) for e in ev}
    assert ("tool_removed", "BREAKING") in types
    assert summarize(ev)["drift"] is True
    assert summarize(ev)["verdict"] == "BREAKING"


def test_diff_detects_schema_and_description_mutation_as_critical():
    base = fingerprint(_probe([{"name": "a", "inputSchema": {"x": 1}, "description": "orig"}]))
    cur = fingerprint(_probe([{"name": "a", "inputSchema": {"x": 2}, "description": "changed"}]))
    ev = diff(base, cur)
    sevs = {e["severity"] for e in ev}
    assert "CRITICAL" in sevs
    assert summarize(ev)["verdict"] == "RUG-PULL/POISONING"


def test_diff_new_tool_is_info_only():
    base = fingerprint(_probe([{"name": "a"}]))
    cur = fingerprint(_probe([{"name": "a"}, {"name": "b"}]))
    ev = diff(base, cur)
    assert [e for e in ev if e["type"] == "tool_added"][0]["severity"] == "INFO"


def test_no_change_is_stable():
    base = fingerprint(_probe([{"name": "a", "inputSchema": {"x": 1}, "description": "d"}]))
    assert summarize(diff(base, base)) == {"drift": False, "events": [], "verdict": "stable"}
