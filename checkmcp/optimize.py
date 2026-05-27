"""Conseil d'optimisation tool-design ("SonarQube du MCP") — consolidations composites concrètes.
Ne note pas seulement le sprawl : propose QUELS outils fusionner, en quoi, et le gain estimé."""
import json, re, difflib
from collections import Counter
from .score import toklen

READ = {"list", "get", "read", "search", "find", "fetch", "count", "query", "describe", "show", "view"}
WRITE = {"create", "add", "update", "patch", "edit", "set", "delete", "remove", "insert", "upsert"}

def _split(name):
    return re.split(r"[_\-]", name)

def _namespace(names):
    """Préfixe de namespace partagé (ex: 'symphony') si ≥60% des outils le portent."""
    firsts = Counter(_split(n)[0].lower() for n in names if len(_split(n)) > 1)
    if firsts:
        top, cnt = firsts.most_common(1)[0]
        if cnt >= 0.6 * len(names):
            return top
    return None

def _strip(name, ns):
    segs = _split(name)
    if ns and segs and segs[0].lower() == ns:
        segs = segs[1:]
    return segs

def _verb(name, ns):
    segs = _strip(name, ns)
    return segs[0].lower() if segs else ""

def _noun(name, ns):
    segs = _strip(name, ns)
    return "_".join(segs[1:]).lower() if len(segs) > 1 else (segs[0].lower() if segs else name.lower())

def _toks(tool):
    return toklen(json.dumps(tool))

def optimize(probe):
    tools = probe.get("tools", [])
    n = len(tools)
    names_all = [t.get("name", "") for t in tools]
    ns = _namespace(names_all)
    by_noun = {}
    for t in tools:
        by_noun.setdefault(_noun(t.get("name", ""), ns), []).append(t)

    suggestions = []
    removable = 0  # nb d'outils qu'on pourrait retirer par consolidation

    # 0) anti-trifecta : si les 3 classes toxiques coexistent, proposer de scinder le serveur
    from . import security as _sec
    sec = _sec.audit(probe)
    if sec["trifecta"]:
        b = sec["buckets"]
        priv = sorted(set(b["sensitive_data"]) | set(b["exfil"]) | set(b["destructive"]))
        untr = sorted(set(b["untrusted_content"]))
        ex = lambda lst: ", ".join(lst[:4]) + (f" +{len(lst)-4}" if len(lst) > 4 else "")
        suggestions.append({
            "type": "split-trifecta", "severity": "CRITICAL", "resource": None,
            "tools": [f"non-fiable: {ex(untr)}", f"privilégié: {ex(priv)}"],
            "proposed": "scinder en 2 serveurs : un MCP « lecture/contenu non-fiable » (read-only, openWorldHint) "
                        "isolé du MCP « privilégié » (données sensibles + exfil/destruction)",
            "est_tokens_saved": 0,
            "why": "lethal trifecta : ingestion de contenu non-fiable + accès données sensibles + exfil/destruction sur le MÊME serveur → "
                   "une prompt-injection dans le contenu ingéré peut lire un secret et l'exfiltrer. Séparer les capacités casse la chaîne ; "
                   "à défaut, mettre les outils sensibles derrière confirmation + destructiveHint et restreindre les sorties exfil.",
        })

    for nn, group in by_noun.items():
        if len(group) < 2:
            continue
        verbs = {_verb(t.get("name", ""), ns): t for t in group}
        read_v = set(verbs) & READ
        write_v = set(verbs) & WRITE
        members = [t.get("name", "") for t in group]

        # 1) variantes de lecture sur la même ressource → 1 query paramétrique
        if len(read_v) >= 2:
            merged = [verbs[v].get("name", "") for v in read_v]
            saved_toks = sum(_toks(verbs[v]) for v in read_v) - _toks(verbs[next(iter(read_v))])
            removable += len(merged) - 1
            suggestions.append({
                "type": "merge-read", "severity": "HIGH", "resource": nn,
                "tools": merged, "proposed": f"query_{nn}(filter, fields, limit)",
                "est_tokens_saved": max(0, saved_toks),
                "why": f"{len(merged)} variantes de lecture sur « {nn} » → une seule lecture paramétrique réduit l'ambiguïté de sélection et le coût contexte",
            })
        # 2) ressource à forte surface (≥4 ops) → module/sous-serveur ou outil-action
        if len(verbs) >= 4:
            removable += max(0, len(verbs) - 2)
            suggestions.append({
                "type": "resource-module", "severity": "MEDIUM", "resource": nn,
                "tools": members, "proposed": f"{nn} (outil unique avec param `action`, ou sous-serveur namespacé)",
                "est_tokens_saved": max(0, sum(_toks(t) for t in group) - 2 * (sum(_toks(t) for t in group) // max(1, len(group)))),
                "why": f"{len(verbs)} opérations sur « {nn} » → regrouper en un outil-action ou un sous-serveur dédié (namespacing) allège l'espace de sélection",
            })

    # 3) collisions de noms (confusabilité)
    names = [t.get("name", "") for t in tools]
    collisions = []
    if n <= 250:
        for i in range(n):
            for j in range(i + 1, n):
                if 1 - difflib.SequenceMatcher(None, names[i], names[j]).ratio() < 0.15:
                    collisions.append((names[i], names[j]))
    if collisions:
        suggestions.append({
            "type": "naming-collision", "severity": "MEDIUM", "resource": None,
            "tools": [f"{a} ↔ {b}" for a, b in collisions[:8]], "proposed": "renommer pour distinguer",
            "est_tokens_saved": 0,
            "why": f"{len(collisions)} paire(s) de noms quasi-identiques → l'agent confond les outils",
        })

    _sev = {"CRITICAL": 3, "HIGH": 2, "MEDIUM": 1, "LOW": 0}
    suggestions.sort(key=lambda s: (_sev.get(s.get("severity"), 0), s.get("est_tokens_saved", 0)), reverse=True)
    projected = max(1, n - removable)
    total_saved = sum(s.get("est_tokens_saved", 0) for s in suggestions)
    return {
        "current_tools": n, "projected_tools": projected,
        "tools_removable": removable, "est_tokens_saved": total_saved,
        "suggestions": suggestions,
    }
