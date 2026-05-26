"""Scoring CheckMCP — piliers (bandes percentile-calibrées) + attribution causale L1.
Chaque finding porte : facteur → mécanisme → effet → Δ-impact (pour tri Lighthouse)."""
import json, re, difflib

# --- tokenizer (exact si tiktoken, sinon approx) ---
try:
    import tiktoken
    _enc = tiktoken.get_encoding("cl100k_base")
    def toklen(s): return len(_enc.encode(s))
    TOKMODE = "cl100k_base"
except Exception:
    def toklen(s): return len(s) // 4
    TOKMODE = "approx(chars/4)"

LATEST = "2025-11-25"
PROTO = ["2024-11-05", "2025-03-26", "2025-06-18", "2025-11-25", "2026-07-28"]
CRUD = re.compile(r"^(get|list|create|update|delete|read|write|search|fetch|find|count|set)(_|$)", re.I)
DESTRUCTIVE = re.compile(r"(delete|remove|drop|destroy|purge|overwrite|reset|revoke|terminate|kill|truncate|wipe)", re.I)
CONFIRM = re.compile(r"(confirm|dry.?run|force|approve|acknowledge)", re.I)
SECRET = re.compile(r"(secret|password|passwd|private[_-]?key|api[_-]?key|apikey|access[_-]?token|bearer|credential)", re.I)
INJECT = re.compile(r"(ignore (previous|prior|above)|you must (call|use|now)|disregard|system prompt|override (the )?instruction)", re.I)

W = {"security": 20, "tool_design": 18, "desc_schema": 16, "reliability": 14, "token": 12, "compliance": 12, "use_case": 8}

def _band(x, pairs):
    for thr, sc in pairs:
        if x <= thr:
            return sc
    return pairs[-1][1]

def _grade(s):
    return "A" if s >= 90 else "B" if s >= 80 else "C" if s >= 70 else "D" if s >= 55 else "F"

def _noun(name):
    m = re.match(r"^[a-z]+[_-](.+)$", name, re.I)
    return (m.group(1).lower() if m else name.lower())

def score(p):
    tools = p.get("tools", [])
    n = len(tools)
    F = []  # findings (attribution causale)
    def add(pillar, sev, measured, mechanism, effect, delta):
        F.append({"pillar": pillar, "severity": sev, "measured": measured,
                  "mechanism": mechanism, "effect": effect, "delta": round(delta, 1)})

    if n == 0:
        return {"score": 0, "grade": "F", "error": "0 tools", "findings": [], "tokmode": TOKMODE}

    proto = p.get("protocolVersion", "?")
    names = [t.get("name", "") for t in tools]
    toks = toklen(json.dumps(tools))
    mean_tok = toks // n
    annot_cov = sum(1 for t in tools if t.get("annotations")) / n

    # ---------- P1 Tool Design (percentile bands: p50=7,p75=13,p90=27,p95=42) ----------
    p1 = _band(n, [(7, 100), (13, 85), (27, 62), (42, 38), (10**9, 12)])
    nouns = {}
    for nm in names:
        nouns.setdefault(_noun(nm), []).append(nm)
    consolidation = sum(1 for nn, lst in nouns.items()
                        if len({re.match(r'^([a-z]+)', x, re.I).group(1).lower() for x in lst if re.match(r'^([a-z]+)', x, re.I)}) >= 3)
    if n > 42:
        add("tool_design", "HIGH", f"{n} outils (≥p95)",
            "trop d'outils sature l'espace de sélection de l'agent",
            "↑ taux d'appel au mauvais outil", W["tool_design"] * (100 - p1) / 100)
    if consolidation:
        p1 = max(0, p1 - min(15, 3 * consolidation))
        add("tool_design", "MEDIUM", f"{consolidation} clusters consolidables",
            "list/get/search/... répétés sur un même objet",
            "candidats à fusionner en outils composites", 3 * consolidation * W["tool_design"] / 100)
    p1 = max(0, min(100, p1))

    # ---------- P2 Desc/Schema ----------
    desc_ok = sum(1 for t in tools if len((t.get("description") or "").strip()) >= 20)
    total_params = typed = 0
    for t in tools:
        props = (t.get("inputSchema", {}) or {}).get("properties", {}) or {}
        for _, sp in props.items():
            total_params += 1
            if (sp or {}).get("type") and (sp or {}).get("description"):
                typed += 1
    isc = (typed / total_params) if total_params else 1.0
    out_cov = sum(1 for t in tools if t.get("outputSchema")) / n
    m21 = 100 if desc_ok / n >= 1 else 80 if desc_ok / n >= 0.9 else 55 if desc_ok / n >= 0.75 else 20
    m23 = 100 if isc >= 0.95 else 75 if isc >= 0.8 else 45 if isc >= 0.5 else 15
    m24 = 100 if out_cov >= 0.75 else 70 if out_cov >= 0.4 else 40 if out_cov >= 0.1 else 20
    p2 = round(0.35 * m21 + 0.40 * m23 + 0.25 * m24)
    if isc < 0.8:
        add("desc_schema", "HIGH", f"{round(100*isc)}% params typés+décrits",
            "schéma = contrat que l'agent remplit",
            "↑ appels malformés", W["desc_schema"] * (100 - m23) / 100 * 0.4)

    # ---------- P3 Token (percentile bands: p95=13k) ----------
    b31 = _band(toks, [(1500, 100), (3600, 85), (6500, 60), (13000, 35), (10**9, 12)])
    b32 = _band(mean_tok, [(120, 100), (250, 80), (400, 55), (10**9, 25)])
    b34 = 100 if p.get("tools_paginated") else (20 if any(re.match(r"^(list|search)", x, re.I) for x in names) else 100)
    p3 = round(0.55 * b31 + 0.25 * b32 + 0.20 * b34)
    if toks > 13000:
        add("token", "HIGH", f"~{toks//1000}k tokens (≥p95)",
            "les defs d'outils sont payées à CHAQUE requête",
            "épuise la fenêtre + coût continu", W["token"] * (100 - b31) / 100)

    # ---------- P4 Security ----------
    p4 = 100
    destructive = unconfirmed = secrets = inject = 0
    for t in tools:
        nm = t.get("name", ""); desc = (t.get("description") or "")
        props = (t.get("inputSchema", {}) or {}).get("properties", {}) or {}
        ann = t.get("annotations") or {}
        if DESTRUCTIVE.search(nm):
            destructive += 1
            if not (any(CONFIRM.search(x) for x in props) or ann.get("destructiveHint")):
                unconfirmed += 1
        if INJECT.search(desc):
            inject += 1
        for pn, sp in props.items():
            if SECRET.search(pn + " " + str((sp or {}).get("description", ""))) and (sp or {}).get("default") not in (None, ""):
                secrets += 1
    p4 -= min(60, 15 * unconfirmed)
    p4 -= 40 * secrets
    p4 -= min(60, 20 * inject)
    if annot_cov == 0 and destructive:
        p4 -= 15
    p4 = max(0, min(100, p4))
    if unconfirmed:
        add("security", "HIGH", f"{unconfirmed}/{destructive} outils destructifs sans confirm/hint",
            "l'agent peut déclencher une action irréversible sans garde-fou",
            "perte/corruption de données possible", 15 * unconfirmed * W["security"] / 100)
    if secrets:
        add("security", "CRITICAL", f"{secrets} secret(s) en clair dans un schéma",
            "secret exposé en input/exemple", "fuite de credential", 40 * W["security"] / 100)
    if inject:
        add("security", "CRITICAL", f"{inject} surface(s) d'injection dans une description",
            "instruction injectée lisible par l'agent", "détournement de l'agent", 20 * inject * W["security"] / 100)

    # ---------- P5 Compliance ----------
    gap = (len(PROTO) - 1 - PROTO.index(proto)) if proto in PROTO else 4
    m51 = max(0, (100 if proto in PROTO else 0) - min(60, 15 * max(0, gap - 1)))
    jc = p.get("jsonrpc_conformance", [False, False])
    jr = sum(1 for x in jc if x) / max(1, len(jc))
    m52 = 100 if jr == 1 else 60 if jr >= 0.5 else 20
    m53 = 100 if annot_cov >= 0.9 else 70 if annot_cov >= 0.6 else 40 if annot_cov >= 0.3 else 15
    p5 = round(0.30 * m51 + 0.35 * m52 + 0.35 * m53)
    if gap > 1:
        add("compliance", "MEDIUM", f"proto {proto} ({gap} rév. derrière {LATEST})",
            "version protocole obsolète", "fonctionnalités récentes indispo, clients récents fragilisés", W["compliance"] * (100 - m51) / 100 * 0.3)
    if annot_cov == 0:
        add("compliance", "MEDIUM", "0 annotation déclarée",
            "destructiveHint/openWorldHint absents → défauts pire-cas",
            "l'outil est traité comme destructif & open-world par les clients", W["compliance"] * (100 - m53) / 100 * 0.35)
    if jr < 1:
        add("compliance", "MEDIUM", f"erreurs JSON-RPC conformes {sum(jc)}/{len(jc)}",
            "erreurs non conformes à la spec JSON-RPC", "clients cassent de façon imprévisible", W["compliance"] * (100 - m52) / 100 * 0.35)

    # ---------- P6 Reliability (T1 single-shot → NON crédité au composite) ----------
    lat = max(p.get("latency", {}).get("initialize_ms", 0), p.get("latency", {}).get("tools_list_ms", 0))
    p6 = _band(lat, [(300, 100), (1000, 80), (3000, 50), (10**9, 20)])

    # ---------- P7 Use-case (+ couverture primitives) ----------
    prims = sum([bool(tools), bool(p.get("resources")), bool(p.get("prompts"))])
    p7 = 60 + (10 if 8 <= n <= 60 else -10) + (10 if prims >= 2 else 0)
    p7 = max(0, min(100, p7))

    P = {"tool_design": p1, "desc_schema": p2, "token": p3, "security": p4,
         "compliance": p5, "reliability": p6, "use_case": p7}
    # T1: la fiabilité n'est pas mesurée de façon fiable → exclue + renormalisation
    measured = ["security", "tool_design", "desc_schema", "token", "compliance", "use_case"]
    raw = sum(W[k] * P[k] for k in measured) / sum(W[k] for k in measured)
    floor = None
    if secrets or inject:
        raw = min(raw, 69); floor = "SECURITY_RISK"
    sc = round(raw)
    F.sort(key=lambda x: x["delta"], reverse=True)
    return {
        "score": sc, "grade": _grade(sc), "floor": floor, "pillars": {k: round(v) for k, v in P.items()},
        "reliability_confidence": "LOW (T1 single-shot, non crédité — requiert T3 ≥24h)",
        "findings": F, "tokmode": TOKMODE,
        "facts": {"tools": n, "resources": len(p.get("resources", [])), "prompts": len(p.get("prompts", [])),
                   "proto": proto, "tools_list_tokens": toks, "annotations_pct": round(100 * annot_cov),
                   "destructive": destructive, "unconfirmed_destructive": unconfirmed,
                   "latency_ms": p.get("latency", {})},
    }
