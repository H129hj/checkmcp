"""Cross-language anti-drift guard for the shared MCP security ruleset.

The mcpizy JS proxy compiles security_ruleset.json; this test pins that ruleset to
the live CheckMCP Python patterns (parity) AND runs the real engine against the shared
security_conformance.json fixture (behavior). The JS side runs the SAME fixture. If
either the Python patterns, the ruleset, or the JS scanner drift, a test fails.
"""
import json
import os

from checkmcp import evals, security

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RULESET = json.load(open(os.path.join(HERE, "checkmcp", "security_ruleset.json")))
FIXTURE = json.load(open(os.path.join(HERE, "checkmcp", "security_conformance.json")))


def _rule(rules, rid):
    return next(r for r in rules if r["id"] == rid)


def test_ruleset_matches_python_patterns():
    """The shared ruleset must be a byte-exact projection of the live engine patterns."""
    inj = _rule(RULESET["output_rules"], "injection")
    assert inj["alts"] == evals._INJ, "injection alts drifted from evals._INJ"
    assert _rule(RULESET["output_rules"], "exfil")["pattern"] == evals.EXFIL.pattern
    assert _rule(RULESET["output_rules"], "secret")["pattern"] == evals.SECRET.pattern
    assert _rule(RULESET["output_rules"], "pii")["pattern"] == evals.PII.pattern
    assert RULESET["big_chars"] == evals.BIG_CHARS
    assert _rule(RULESET["descriptor_rules"], "inject_static")["pattern"] == security.INJECT.pattern
    assert _rule(RULESET["descriptor_rules"], "secret_val")["pattern"] == security.SECRET_VAL.pattern


def test_output_conformance():
    for case in FIXTURE["output"]:
        if "repeat" in case:
            text = case["repeat"]["s"] * case["repeat"]["n"]
        else:
            text = case["input"]
        findings = evals._analyze(case["name"], text, None)
        got = sorted({f["type"] for f in findings})
        assert got == sorted(case["expect_types"]), f"output case {case.get('input', '<big>')[:40]!r}: {got} != {case['expect_types']}"


def test_descriptor_conformance():
    for case in FIXTURE["descriptor"]:
        res = security.audit({"tools": [case["tool"]]})
        # isolate the descriptor-level findings (MCP01 secret, MCP03 poisoning)
        got = sorted({f["owasp"] for f in res["findings"] if f["owasp"] in ("MCP01", "MCP03")})
        assert got == sorted(case["expect_owasp"]), f"descriptor case {case['tool']['name']}: {got} != {case['expect_owasp']}"
