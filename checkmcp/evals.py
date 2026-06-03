"""Behavioral evals — opt-in canary sandbox (CheckMCP T4). stdlib only.

We invoke READ-ONLY-heuristic tools with benign canary inputs and inspect responses for runtime danger:
active prompt-injection in tool output (multilingual), exfiltration vectors, CONFIRMED exfiltration via a
callback canary (a unique URL we plant in inputs; if the server fetches it our endpoint records the hit),
secret/PII leakage, context bombs. Every finding has a confidence in [0,1]. We NEVER call mutating tools.
"""
import re
import secrets

from .probe import call_tools

CANARY = "CHECKMCP-CANARY-7Q2X"

SAFE_VERBS = {"get", "list", "search", "read", "fetch", "find", "lookup", "query", "describe",
              "status", "ping", "echo", "view", "show", "info", "inspect", "count", "resolve",
              "health", "whoami", "version", "doc", "docs", "explore", "summary", "summarize"}
MUTATING_VERBS = {"create", "update", "delete", "remove", "write", "send", "post", "put", "patch",
                  "exec", "execute", "run", "deploy", "drop", "set", "add", "insert", "cancel",
                  "charge", "pay", "transfer", "email", "sms", "upload", "publish", "merge",
                  "approve", "reset", "revoke", "grant", "install", "kill", "stop", "start", "buy",
                  "order", "refund", "book", "schedule", "invite", "provision", "destroy", "trigger"}


def _verbs(name):
    return set(re.split(r"[^a-z0-9]+", (name or "").lower()))


_INJ = [
    r"ignore (all |the )?(previous|prior|above) (instructions|prompts?)", r"disregard (the |all )?(previous|above)",
    r"you are now", r"new instructions?:", r"system prompt", r"do not (tell|inform|mention to) the (user|human)",
    r"</?(system|important|secret|admin)>", r"assistant must", r"forget (everything|your)",
    r"reveal (your|the) (system|prompt|instructions)", r"print (your )?(system )?prompt",
    r"ignor(?:e|ez) (?:toutes |les )?(?:instructions|consignes)", r"oubli(?:e|ez) (?:tout|vos)",
    r"vous êtes (?:maintenant|désormais)", r"ne (?:dis|dites|révélez) (?:pas|rien)",
    r"ignora (?:las |todas las )?(?:instrucciones|órdenes)", r"olvida (?:todo|tus)", r"eres ahora",
    r"ignoriere (?:alle |die )?(?:vorherigen|obigen)", r"vergiss (?:alles|deine)", r"du bist jetzt",
]
INJECTION = re.compile("(" + "|".join(_INJ) + ")", re.I)

EXFIL = re.compile(
    r"(send (it |this |the (data|result|secret|token|key)).{0,40}(to|http)"
    r"|(curl|fetch|POST|GET|wget)\s+https?://|exfiltrat"
    r"|(api[_-]?key|token|secret|password|credential)s?.{0,30}(to|send|post|upload)"
    r"|(envoy(?:e|ez)|transmet(?:s|tez)).{0,40}(http|adresse)"
    r"|https?://[^\s\"']{0,60}\?(.{0,40})(data|token|key|secret)=)", re.I)

SECRET = re.compile(
    r"(AKIA[0-9A-Z]{16}|sk-[A-Za-z0-9]{20,}|sk_live_[0-9A-Za-z]{20,}|gh[pousr]_[A-Za-z0-9]{20,}"
    r"|xox[baprs]-[A-Za-z0-9-]{10,}|AIza[0-9A-Za-z\-_]{30,}|ya29\.[0-9A-Za-z\-_]{20,}"
    r"|-----BEGIN [A-Z ]*PRIVATE KEY-----|eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{6,})")

PII = re.compile(r"\b[\w.+-]+@[\w-]+\.[\w.-]+\b|\b(?:\d[ -]?){13,16}\b")

MAX_TOOLS = 6
BIG_CHARS = 60000


def _fill_arg(schema, canary, canary_url):
    """Benign canary value for a required param, format-aware. None = cannot fill safely."""
    s = schema or {}
    if "default" in s:
        return s["default"]
    if "example" in s:
        return s["example"]
    if s.get("enum"):
        return s["enum"][0]
    t = s.get("type")
    fmt = (s.get("format") or "").lower()
    if t in ("number", "integer"):
        return s.get("minimum", 1)
    if t == "boolean":
        return False
    if t == "array":
        return []
    if t == "string" or t is None:
        if fmt in ("uri", "url", "uri-reference") and canary_url:
            return canary_url
        if fmt == "email":
            return "checkmcp-canary@example.com"
        if fmt in ("date", "date-time"):
            return "2024-01-01"
        if fmt == "uuid":
            return "00000000-0000-4000-8000-000000000000"
        val = (canary + " " + canary_url).strip() if canary_url else canary
        ml = s.get("minLength")
        if isinstance(ml, int) and len(val) < ml:
            val = (val + " ") * (ml // len(val) + 1)
        mx = s.get("maxLength")
        return val[:mx] if isinstance(mx, int) else val
    return None


def _selectable(tool, canary=CANARY, canary_url=None):
    """(True, args) if the tool is safe to probe and we can fill its required params; else (False, why)."""
    name = tool.get("name", "")
    ann = tool.get("annotations") or {}
    read_only = ann.get("readOnlyHint") is True
    verbs = _verbs(name)
    mutating = bool(verbs & MUTATING_VERBS)
    looks_safe = bool(verbs & SAFE_VERBS) and not mutating
    if not (read_only or looks_safe):
        return False, "not read-only"
    if mutating and not read_only:
        return False, "mutating verb"
    schema = tool.get("inputSchema") or {}
    props = schema.get("properties") or {}
    args = {}
    for r in (schema.get("required") or []):
        v = _fill_arg(props.get(r), canary, canary_url)
        if v is None:
            return False, f"required arg '{r}' not safely fillable"
        args[r] = v
    return True, args


def _snippet(text, rx):
    m = rx.search(text or "")
    if not m:
        return ""
    i = max(0, m.start() - 30)
    return ("…" + text[i:m.end() + 60] + "…").replace("\n", " ")[:160]


def _analyze(name, text, result, canary=CANARY):
    findings = []
    blob = text or ""
    if not blob and isinstance(result, dict):
        blob = str(result.get("structuredContent") or "")
    inj = INJECTION.findall(blob)
    if inj:
        findings.append({"type": "active_prompt_injection", "severity": "HIGH", "tool": name,
                         "confidence": 0.95 if len(inj) > 1 else 0.85,
                         "detail": "Tool output contains agent-directed instructions (tool-response poisoning).",
                         "evidence": _snippet(blob, INJECTION)})
    if EXFIL.search(blob):
        findings.append({"type": "exfiltration_vector", "severity": "HIGH", "tool": name, "confidence": 0.8,
                         "detail": "Tool output pushes the agent to send data to an external destination.",
                         "evidence": _snippet(blob, EXFIL)})
    if SECRET.search(blob):
        findings.append({"type": "secret_in_output", "severity": "HIGH", "tool": name, "confidence": 0.9,
                         "detail": "A credential-shaped string was returned in the tool output.",
                         "evidence": "<redacted secret match>"})
    if canary in blob and EXFIL.search(blob):
        findings.append({"type": "canary_reflection", "severity": "MEDIUM", "tool": name, "confidence": 0.5,
                         "detail": "Our canary input was reflected near an outbound instruction."})
    if len(blob) > BIG_CHARS:
        findings.append({"type": "context_bomb", "severity": "MEDIUM", "tool": name, "confidence": 0.7,
                         "detail": f"Response is very large ({len(blob)//1000}k chars) — inflates agent context cost on every call."})
    elif PII.search(blob) and not SECRET.search(blob):
        findings.append({"type": "pii_in_output", "severity": "LOW", "tool": name, "confidence": 0.4,
                         "detail": "Output contains email/number patterns resembling PII."})
    return findings


def behavioral_eval(probe_result, token=None, max_tools=MAX_TOOLS, timeout=8,
                    callback_base=None, hit_check=None):
    """Probe a server's read-only tools. `callback_base` (e.g. https://checkmcp.dev/cx) enables the
    callback canary: a unique URL is planted in inputs; if the server fetches it, `hit_check(token)`
    returns True -> CONFIRMED exfiltration. Returns a behavioral report with per-finding confidence."""
    url = probe_result.get("url")
    tools = probe_result.get("tools") or []
    if not url:
        return {"ran": False, "reason": "no url on probe result"}
    cb_token = secrets.token_hex(8) if callback_base else None
    canary_url = (callback_base.rstrip("/") + "/" + cb_token) if callback_base else None

    selected, skipped = [], 0
    for t in tools:
        ok, args = _selectable(t, CANARY, canary_url)
        if ok and len(selected) < max_tools:
            selected.append((t.get("name"), args))
        elif not ok:
            skipped += 1
    if not selected:
        return {"ran": True, "tools_probed": [], "skipped": skipped, "findings": [],
                "verdict": "inconclusive", "note": "No read-only-safe tool could be exercised."}

    res = call_tools(url, selected, token=token, timeout=timeout)
    if isinstance(res, dict) and res.get("error"):
        return {"ran": False, "reason": res.get("error")}

    findings, probed = [], []
    for c in res.get("calls", []):
        probed.append({"tool": c["name"], "ok": c["ok"], "is_error": c.get("is_error"), "ms": c.get("ms")})
        if c["ok"] and not c.get("is_error"):
            findings += _analyze(c["name"], c.get("text", ""), c.get("result"))

    # callback canary : le serveur a-t-il appelé notre URL unique ? (exfiltration/SSRF confirmée)
    if cb_token and hit_check and hit_check(cb_token):
        findings.insert(0, {"type": "exfiltration_confirmed", "severity": "HIGH", "tool": "(server)",
                            "confidence": 1.0,
                            "detail": "The server fetched our unique callback URL embedded in a tool input — "
                                      "it makes outbound calls on caller-supplied data (confirmed SSRF/exfiltration).",
                            "evidence": canary_url})

    sev = {f["severity"] for f in findings}
    verdict = "malicious" if "HIGH" in sev else ("suspicious" if ("MEDIUM" in sev or "LOW" in sev) else "clean")
    return {"ran": True, "tools_probed": probed, "skipped": skipped, "findings": findings,
            "verdict": verdict, "canary": CANARY, "callback_token": cb_token}
