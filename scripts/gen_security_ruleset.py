#!/usr/bin/env python3
"""Generate checkmcp/security_ruleset.json FROM the live engine patterns.

The Python engine (evals.py / security.py) is the single source of truth for the
security patterns; this projects them into the language-agnostic ruleset JSON that
the mcpizy JS proxy compiles. Re-run after changing any shared pattern:

    python scripts/gen_security_ruleset.py

`tests/test_security_conformance.py::test_ruleset_matches_python_patterns` fails if
the committed ruleset ever drifts from the engine.
"""
import json
import os

from checkmcp import evals, security

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(HERE, "checkmcp", "security_ruleset.json")

ruleset = {
    "version": "1",
    "note": "Canonical MCP security ruleset — GENERATED from the CheckMCP Python engine "
            "(scripts/gen_security_ruleset.py); compiled by both Python and the MCPizy JS "
            "proxy. Do not hand-edit; change evals.py/security.py then regenerate.",
    "big_chars": evals.BIG_CHARS,
    "output_rules": [
        {"id": "injection", "type": "active_prompt_injection", "severity": "HIGH", "flags": "i",
         "alts": evals._INJ,
         "detail": "Tool output contains agent-directed instructions (tool-response poisoning)."},
        {"id": "exfil", "type": "exfiltration_vector", "severity": "HIGH", "flags": "i", "confidence": 0.8,
         "pattern": evals.EXFIL.pattern,
         "detail": "Tool output pushes the agent to send data to an external destination."},
        {"id": "secret", "type": "secret_in_output", "severity": "HIGH", "flags": "", "confidence": 0.9,
         "pattern": evals.SECRET.pattern,
         "detail": "A credential-shaped string was returned in the tool output."},
        {"id": "pii", "type": "pii_in_output", "severity": "LOW", "flags": "", "confidence": 0.4,
         "pattern": evals.PII.pattern,
         "detail": "Output contains email/number patterns resembling PII."},
    ],
    "descriptor_rules": [
        {"id": "inject_static", "owasp": "MCP03", "severity": "CRITICAL", "flags": "i",
         "pattern": security.INJECT.pattern,
         "issue": "injected instruction (tool poisoning) in the description/schema"},
        {"id": "secret_val", "owasp": "MCP01", "severity": "CRITICAL", "flags": "",
         "pattern": security.SECRET_VAL.pattern,
         "issue": "hardcoded secret/key in the tool schema or an example"},
    ],
}

with open(OUT, "w") as f:
    json.dump(ruleset, f, indent=2, ensure_ascii=False)
    f.write("\n")
print(f"wrote {OUT}")
