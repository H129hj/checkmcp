"""Profondeur sécurité native CheckMCP, mappée OWASP MCP Top 10 (MCP01–MCP10).
Sans Snyk : classification de capacités → lethal-trifecta, command-injection, tool-poisoning,
secrets, permissions. Statique (T1) — la profondeur runtime (résultats d'outils) reste à Snyk/proxy."""
import re

UNTRUSTED = re.compile(r"(fetch|scrape|browse|crawl|http|_url|web.?search|read.?page|get.?page|download|wiki|search.?web|rss|feed)", re.I)
SENSITIVE = re.compile(r"(secret|credential|token|api.?key|password|vault|email|inbox|read.?file|cat_|database|db.?query|\bsql\b|financial|payment|invoice|wallet|private.?key|env_)", re.I)
EXFIL = re.compile(r"(send|post_|publish|upload|email|notify|webhook|export|sync|push|transfer|message|tweet|sms)", re.I)
DESTRUCT = re.compile(r"(delete|remove|drop|destroy|purge|reset|truncate|revoke|kill|terminate|overwrite|wipe)", re.I)
# Exécution réelle de commande/shell/code/SQL (≠ "run_<métier>" type run_model/run_benchmark/run_pipeline).
EXEC = re.compile(
    r"(shell|bash|terminal|subprocess|\bspawn\b"
    r"|(^|[_-])exec([_-]|$)|(^|[_-])execute([_-]|$)|(^|[_-])eval([_-]|$)"
    r"|(^|[_-])run[_-](cmd|command|shell|script|code|sql|query|bash|exec)"
    r"|(^|[_-])(cmd|command)([_-]|$)"
    r"|(sql|db)[_-](exec|execute|query))", re.I)
# Poisoning = instruction cachée qui détourne l'agent (≠ consigne de séquençage légitime "you must call X first").
INJECT = re.compile(
    r"(ignore (the )?(previous|prior|above)|disregard (the )?(previous|prior)"
    r"|<\|im_start\|>|</?system>|\[/?INST\]|override (the )?(previous |prior )?instruction"
    r"|do ?n['o]?t (tell|mention|reveal|disclose|inform|notify|warn) (the )?(user|human|operator)"
    r"|(without|never) (telling|informing|notifying|alerting) (the )?(user|human)"
    r"|you (must|should|need to) (always |secretly |silently )?(send|forward|copy|cc|email|post|upload|exfiltrat|leak|transmit|include your)"
    r"|secretly|exfiltrat|\bsystem prompt\b)", re.I)
SECRET_VAL = re.compile(r"(sk-[A-Za-z0-9]{12,}|ghp_[A-Za-z0-9]{12,}|AKIA[0-9A-Z]{12,}|-----BEGIN [A-Z ]*PRIVATE KEY|xox[baprs]-[0-9A-Za-z-]{10,})")
FREE_STR = lambda spec: (spec or {}).get("type") == "string" and not (spec or {}).get("enum")


def _txt(t):
    parts = [t.get("description") or ""]
    props = (t.get("inputSchema", {}) or {}).get("properties", {}) or {}
    for p, s in props.items():
        parts.append(p + " " + str((s or {}).get("description", "")) + " " + str((s or {}).get("default", "")) + " " + str((s or {}).get("examples", "")))
    out = t.get("outputSchema")
    if out:
        parts.append(str(out))
    return " \n ".join(parts)


def audit(probe):
    tools = probe.get("tools", [])
    findings = []
    buckets = {"untrusted_content": [], "sensitive_data": [], "exfil": [], "destructive": []}
    for t in tools:
        nm = t.get("name", ""); blob = _txt(t); props = (t.get("inputSchema", {}) or {}).get("properties", {}) or {}
        ann = t.get("annotations") or {}
        if UNTRUSTED.search(nm): buckets["untrusted_content"].append(nm)
        if SENSITIVE.search(nm + " " + blob): buckets["sensitive_data"].append(nm)
        if EXFIL.search(nm): buckets["exfil"].append(nm)
        if DESTRUCT.search(nm): buckets["destructive"].append(nm)
        # MCP03/06 — injection/poisoning dans desc + schémas + output
        if INJECT.search(blob):
            findings.append({"owasp": "MCP03", "severity": "CRITICAL", "tool": nm,
                             "issue": "instruction injectée (poisoning) dans description/schéma/output"})
        # MCP01 — secret en dur (valeur, pas juste nom de param)
        if SECRET_VAL.search(blob):
            findings.append({"owasp": "MCP01", "severity": "CRITICAL", "tool": nm,
                             "issue": "secret/clé en dur dans le schéma ou un exemple"})
        # MCP05 — command/shell injection : outil exec + param string libre
        if EXEC.search(nm) and any(FREE_STR(s) for s in props.values()):
            findings.append({"owasp": "MCP05", "severity": "HIGH", "tool": nm,
                             "issue": "exécution + param string libre non contraint → injection commande/shell"})
        # MCP02 — destructif sans confirm/hint
        if DESTRUCT.search(nm) and not (ann.get("destructiveHint") or any(re.search(r"confirm|dry.?run|force", p, re.I) for p in props)):
            findings.append({"owasp": "MCP02", "severity": "HIGH", "tool": nm,
                             "issue": "outil destructif sans confirmation ni destructiveHint"})

    # MCP06 — lethal trifecta : contenu non-fiable + données sensibles + (exfil|destructif) sur le MÊME serveur
    has = {k: bool(v) for k, v in buckets.items()}
    trifecta = has["untrusted_content"] and has["sensitive_data"] and (has["exfil"] or has["destructive"])
    if trifecta:
        findings.append({"owasp": "MCP06", "severity": "CRITICAL", "tool": "(serveur)",
                         "issue": "lethal trifecta : ingestion contenu non-fiable + accès données sensibles + exfil/destruction → une injection peut exfiltrer"})
    elif sum(has.values()) >= 3:
        findings.append({"owasp": "MCP06", "severity": "HIGH", "tool": "(serveur)",
                         "issue": "surface toxique : 3 classes de capacités à risque combinées"})

    # score sécurité [0..100] dérivé des findings (CRITICAL -25, HIGH -12)
    pen = sum(25 if f["severity"] == "CRITICAL" else 12 for f in findings)
    score = max(0, 100 - pen)
    hard_floor = any(f["owasp"] in ("MCP01", "MCP03") for f in findings) or trifecta
    order = {"CRITICAL": 0, "HIGH": 1, "MEDIUM": 2}
    findings.sort(key=lambda f: order.get(f["severity"], 9))
    return {"score": score, "findings": findings, "hard_floor": hard_floor,
            "capabilities": {k: len(v) for k, v in buckets.items()}, "trifecta": trifecta}
