"""Tool Pinning / rug-pull detection — empreinte stable des définitions d'outils + diff vs baseline.
Détecte la MUTATION post-approbation (schéma/description d'un outil change) = vecteur tool-poisoning,
et les ruptures (outil retiré/renommé). C'est le cœur du monitoring CheckMCP (réutilise l'infra Contabo)."""
import hashlib, json


def _h(obj):
    return hashlib.sha256(json.dumps(obj, sort_keys=True, ensure_ascii=False).encode()).hexdigest()[:12]


def fingerprint(probe):
    """Empreinte déterministe du jeu d'outils (insensible à l'ordre)."""
    tools = {}
    for t in probe.get("tools", []):
        n = t.get("name", "")
        tools[n] = {
            "schema": _h(t.get("inputSchema", {}) or {}),
            "desc": _h((t.get("description") or "")),
            "annot": bool(t.get("annotations")),
        }
    return {
        "set_hash": _h(tools),
        "count": len(tools),
        "proto": probe.get("protocolVersion"),
        "tools": tools,
    }


def diff(base, cur):
    """Événements de drift entre baseline (épinglée) et état courant, avec sévérité."""
    bt, ct = base.get("tools", {}), cur.get("tools", {})
    ev = []
    for n in ct:
        if n not in bt:
            ev.append({"type": "tool_added", "tool": n, "severity": "INFO",
                       "note": "new tool - widened surface"})
        else:
            if ct[n]["schema"] != bt[n]["schema"]:
                ev.append({"type": "schema_mutated", "tool": n, "severity": "CRITICAL",
                           "note": "schema of an APPROVED tool changed -> rug-pull / contract change"})
            if ct[n]["desc"] != bt[n]["desc"]:
                ev.append({"type": "description_mutated", "tool": n, "severity": "CRITICAL",
                           "note": "description (= prompt read by the agent) changed -> tool-poisoning vector"})
    for n in bt:
        if n not in ct:
            ev.append({"type": "tool_removed", "tool": n, "severity": "BREAKING",
                       "note": "tool removed/renamed without version bump -> breaks clients"})
    order = {"CRITICAL": 0, "BREAKING": 1, "INFO": 2}
    ev.sort(key=lambda e: order.get(e["severity"], 9))
    return ev


def summarize(events):
    if not events:
        return {"drift": False, "events": [], "verdict": "stable"}
    sev = {e["severity"] for e in events}
    verdict = "RUG-PULL/POISONING" if "CRITICAL" in sev else ("BREAKING" if "BREAKING" in sev else "drift")
    return {"drift": True, "events": events, "verdict": verdict,
            "counts": {s: sum(1 for e in events if e["severity"] == s) for s in sev}}
