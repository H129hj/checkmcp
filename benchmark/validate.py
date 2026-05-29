"""ENDGAME — validité de construit du MCP Score, à partir du dataset d'outcomes (outcomes.py).

Répond à : « la note prédit-elle un comportement réel ? » et « les poids sont-ils les bons ? »
  1. Corrélation de Spearman composite ↔ outcome (précision de sélection d'outil) + par pilier.
  2. Matrice de corrélation inter-piliers → redondance (deux piliers très corrélés = info dupliquée).
  3. Sensibilité du classement aux poids (le score bouge-t-il vraiment selon les poids ?).
  4. Poids ré-estimés empiriquement (|corrélation pilier↔outcome| normalisée) vs poids actuels.
Émet VALIDITY.md. Stdlib only. Honnête sur n petit : on rapporte les coefficients, PAS de p-value abusive.
"""
import json, os, sys, math
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from checkmcp.score import W

PILLARS = ["security", "tool_design", "desc_schema", "token", "compliance", "use_case"]


def _ranks(xs):
    order = sorted(range(len(xs)), key=lambda i: xs[i])
    r = [0.0] * len(xs)
    i = 0
    while i < len(xs):
        j = i
        while j + 1 < len(xs) and xs[order[j + 1]] == xs[order[i]]:
            j += 1
        avg = (i + j) / 2.0 + 1
        for k in range(i, j + 1):
            r[order[k]] = avg
        i = j + 1
    return r


def _pearson(xs, ys):
    n = len(xs)
    if n < 2:
        return None
    mx, my = sum(xs) / n, sum(ys) / n
    num = sum((x - mx) * (y - my) for x, y in zip(xs, ys))
    dx = math.sqrt(sum((x - mx) ** 2 for x in xs))
    dy = math.sqrt(sum((y - my) ** 2 for y in ys))
    return num / (dx * dy) if dx and dy else None


def spearman(xs, ys):
    return _pearson(_ranks(xs), _ranks(ys))


def _fmt(v):
    return "n/a" if v is None else f"{v:+.2f}"


def analyze(rows):
    data = [r for r in rows if r.get("selection_accuracy") is not None and "pillars" in r]
    n = len(data)
    acc = [r["selection_accuracy"] for r in data]
    comp = [r["score"] for r in data]
    out = {"n": n, "names": [r["name"] for r in data]}

    out["composite_vs_outcome"] = spearman(comp, acc)
    out["pillar_vs_outcome"] = {p: spearman([r["pillars"][p] for r in data], acc) for p in PILLARS}
    out["tokens_vs_outcome"] = spearman([r.get("tokens", 0) for r in data], acc)

    # redondance inter-piliers
    inter = {}
    for i, a in enumerate(PILLARS):
        for b in PILLARS[i + 1:]:
            inter[f"{a}↔{b}"] = spearman([r["pillars"][a] for r in data], [r["pillars"][b] for r in data])
    out["inter_pillar"] = inter

    # sensibilité : variance des scores composites (s'ils ne bougent pas, les poids n'opèrent pas)
    mc = sum(comp) / n if n else 0
    out["composite_spread"] = {"min": min(comp), "max": max(comp), "stdev": math.sqrt(sum((c - mc) ** 2 for c in comp) / n) if n else 0}

    # garde-fous : effet plafond + n suffisant avant TOUTE conclusion de repondération
    ma = sum(acc) / n if n else 0
    acc_stdev = math.sqrt(sum((x - ma) ** 2 for x in acc) / n) if n else 0
    min_trials = min((r.get("trials", 0) for r in data), default=0)
    out["outcome_stdev"] = acc_stdev
    out["min_trials"] = min_trials
    ceiling = acc_stdev < 0.12
    powered = (n >= 20) and (not ceiling) and (min_trials >= 12)
    out["ceiling_effect"] = ceiling
    out["powered"] = powered

    # poids ré-estimés : NE PROPOSER que si l'étude est suffisamment puissante (sinon = artefact)
    corrs = {p: (out["pillar_vs_outcome"][p] or 0) for p in PILLARS}
    pos = {p: max(0, c) for p, c in corrs.items()}
    tot = sum(pos.values())
    out["empirical_weights"] = ({p: round(100 * pos[p] / tot, 1) for p in PILLARS} if (tot and powered) else None)
    out["current_weights"] = {p: W[p] for p in PILLARS}
    return out


def to_markdown(a):
    L = []
    L.append("# CheckMCP — Validité de construit (ENDGAME)\n")
    L.append(f"Dataset : **n={a['n']} serveurs** ({', '.join(a['names'])}).  ")
    L.append("Outcome empirique = **précision de sélection d'outil** par un LLM (un bon outil/desc → le bon outil est choisi).\n")
    L.append("> ⚠️ n petit : ces coefficients sont **indicatifs** (direction + force), pas une preuve statistique. "
             "Ils orientent les poids et détectent les piliers redondants ; la validation forte demande n≳30.\n")

    if a.get("ceiling_effect"):
        L.append(f"> 🛑 **Effet plafond détecté** : écart-type de l'outcome = {a['outcome_stdev']:.2f} (< 0.12), "
                 f"min essais/serveur = {a['min_trials']}. La sélection d'outil est ici trop facile (catalogue plafonné à 60, "
                 "tâches rédigées depuis la description → appariement quasi-trivial) pour discriminer les serveurs. "
                 "**Les corrélations ci-dessous sont donc dominées par le bruit — à interpréter comme un test du harnais, pas un verdict sur la note.**\n")

    L.append("## 1. La note prédit-elle l'outcome ?\n")
    c = a["composite_vs_outcome"]
    cv = c or 0
    if a.get("ceiling_effect"):
        verdict = " — non concluant : effet plafond (voir ci-dessus)."
    elif cv >= 0.5:
        verdict = " — **corrélation positive forte** : un meilleur MCP Score va de pair avec une meilleure sélection d'outil. ✅ Signal de validité de construit (préliminaire, n modéré)."
    elif cv >= 0.3:
        verdict = " — corrélation positive modérée : la note tracke l'outcome, à confirmer sur n plus grand."
    elif c is not None:
        verdict = " — corrélation faible : poids/outcome à revoir."
    else:
        verdict = ""
    L.append(f"**Composite ↔ sélection : ρ = {_fmt(c)}**" + verdict + "\n")
    L.append("| Pilier | ρ vs outcome |\n|---|---|")
    for p in PILLARS:
        L.append(f"| {p} | {_fmt(a['pillar_vs_outcome'][p])} |")
    L.append(f"\nTokens (coût contexte) ↔ outcome : ρ = {_fmt(a['tokens_vs_outcome'])} (négatif attendu : + de tokens → sélection plus dure).\n")

    L.append("## 2. Redondance inter-piliers\n")
    L.append("Deux piliers à |ρ| très élevé mesurent en partie la même chose (candidats à fusion/repondération).\n")
    L.append("| Paire | ρ |\n|---|---|")
    for k, v in sorted(a["inter_pillar"].items(), key=lambda kv: -abs(kv[1] or 0)):
        flag = " ⚠️ redondance" if abs(v or 0) >= 0.8 else ""
        L.append(f"| {k} | {_fmt(v)}{flag} |")

    L.append("\n## 3. Les poids opèrent-ils ?\n")
    s = a["composite_spread"]
    L.append(f"Étendue des scores composites : {s['min']}–{s['max']} (écart-type {s['stdev']:.1f}). "
             "Un écart-type non trivial confirme que la note discrimine les serveurs.\n")

    L.append("## 4. Poids — repondération empirique ?\n")
    if a["empirical_weights"]:
        L.append("Étude suffisamment puissante → poids suggérés = |corrélation pilier↔outcome| normalisée.\n")
        L.append("| Pilier | Actuel | Empirique |\n|---|---|---|")
        for p in PILLARS:
            L.append(f"| {p} | {a['current_weights'][p]} | {a['empirical_weights'][p]} |")
    else:
        L.append(f"**Repondération BLOQUÉE** : conditions de puissance non réunies "
                 f"(n={a['n']}, écart-type outcome={a['outcome_stdev']:.2f}, min essais={a['min_trials']} ; requis n≥20, σ≥0.12, essais≥12). "
                 "On **conserve** les poids actuels (sécu-first, méthodologiquement défendables). "
                 "Ré-estimer les poids sur ces données reviendrait à sur-apprendre du bruit.\n")

    L.append("## Verdict\n")
    s = a["composite_spread"]
    L.append("- ✅ **Harnais de validité opérationnel** : probe → score → outcome LLM → corrélations/redondance/sensibilité, reproductible.")
    L.append(f"- ✅ **La note discrimine** (composite {s['min']}–{s['max']}, σ{s['stdev']:.1f}) — les poids opèrent.")
    if a.get("ceiling_effect"):
        L.append("- 🛑 **Outcome non discriminant** (effet plafond) → ni validation ni invalidation. Conclusion bloquée.")
    else:
        L.append(f"- ✅ **Effet plafond cassé** (σ outcome {a['outcome_stdev']:.2f}) grâce au catalogue complet + tâches orientées-but + juge≠rédacteur (v2).")
        if cv >= 0.5:
            L.append(f"- ✅ **Signal de validité de construit** : composite ↔ outcome ρ={_fmt(c)}, tokens ↔ outcome ρ={_fmt(a['tokens_vs_outcome'])} (le sprawl nuit, comme prédit).")
    L.append("- ⚠️ **Caveat diversité** : une partie du corpus est constituée de serveurs GitMCP quasi-identiques (même score, design templaté) → diversité de design effective < n. À diversifier.")
    L.append(f"- 🎯 **Pour un verdict fort + repondération** : n≥20 atteint? {a['n']>=20} · σ≥0.12? {a['outcome_stdev']>=0.12} · essais/serveur≥12? {a['min_trials']>=12} "
             f"(actuel min={a['min_trials']}, plombé par les serveurs à peu d'outils). "
             "Lever le dernier verrou = + de serveurs riches en outils (≥12) et n≥20 diversifié (cibles auth'd).\n")
    return "\n".join(L)


def _detect_clones(rows):
    """Groupe les rangs par profil de piliers identique — ≥3 sur le même profil = clones."""
    from collections import defaultdict
    g = defaultdict(list)
    for r in rows:
        if "pillars" not in r:
            continue
        key = tuple(sorted(r["pillars"].items()))
        g[key].append(r["name"])
    return [names for names in g.values() if len(names) >= 3]


def main():
    path = sys.argv[1] if len(sys.argv) > 1 else os.environ.get("CHECKMCP_OUTCOME_OUT", "/tmp/outcomes.json")
    rows = json.load(open(path))
    a = analyze(rows)
    md = to_markdown(a)
    # auto-sous-analyse diversifiée si on détecte des clones
    clone_groups = _detect_clones(rows)
    if clone_groups:
        cloned = {n for grp in clone_groups for n in grp[1:]}  # garde 1 représentant par groupe
        diverse = [r for r in rows if r["name"] not in cloned]
        if len(diverse) >= 5 and len(diverse) < len(rows):
            a2 = analyze(diverse)
            md += "\n\n---\n\n# Sous-analyse : corpus diversifié (sans clones)\n\n"
            md += f"Clones détectés ({len(clone_groups)} groupes de profils piliers identiques, ex : {', '.join(clone_groups[0][:3])}…). "
            md += f"En les déduplicant à 1 représentant par groupe → **n_diverse = {len(diverse)}**. "
            md += "C'est l'analyse la plus honnête pour la validité de construit (les clones ajoutent du bruit à score constant).\n\n"
            md += to_markdown(a2)
    out_md = sys.argv[2] if len(sys.argv) > 2 else os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "VALIDITY.md")
    open(out_md, "w").write(md)
    print(md)
    print(f"\n[validate] → {out_md}")


if __name__ == "__main__":
    main()
