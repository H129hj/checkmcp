"""Causal weight validation — construct validity for the MCP Score (CheckMCP T4, part 2).

The 7-pillar weights (score.W) are expert priors. This harness asks the empirical question the
roadmap endgame needs answered: *do the pillars actually predict agent success?* Given a labeled
sample of servers — each with its pillar sub-scores and an observed outcome (agent task-success rate
in [0,1]) — it computes:

  • per-pillar Pearson correlation with the outcome (which pillars carry signal);
  • a multivariate ordinary-least-squares fit (stdlib normal-equations) → data-driven weight
    suggestions, normalized to sum to 1, with the model R² (how much outcome variance the pillars
    explain — the construct-validity number);
  • a side-by-side of suggested vs current weights so weight changes are evidence-driven, not vibes.

Honest by design: it does NOT invent outcomes. You supply a labeled sample (collected from a real
agent benchmark). With no labels there is nothing to validate — that's the point. stdlib only.

Sample format (JSON list), either self-contained or url-joined against live audits:
  [{"pillars": {"security": 90, "tool_design": 70, ...}, "outcome": 0.82}, ...]
  [{"url": "https://…/mcp", "outcome": 0.82}, ...]   # pillars pulled from stored audits
"""
import json
import sys

PILLARS = ["security", "tool_design", "desc_schema", "token", "compliance", "use_case", "reliability"]


def _mean(xs):
    return sum(xs) / len(xs) if xs else 0.0


def _norm_weights(w):
    if not w:
        return None
    tot = sum(w.get(p, 0) for p in PILLARS) or 1
    return {p: round(w.get(p, 0) / tot, 3) for p in PILLARS}


def pearson(xs, ys):
    n = len(xs)
    if n < 2:
        return 0.0
    mx, my = _mean(xs), _mean(ys)
    num = sum((x - mx) * (y - my) for x, y in zip(xs, ys))
    dx = sum((x - mx) ** 2 for x in xs) ** 0.5
    dy = sum((y - my) ** 2 for y in ys) ** 0.5
    return num / (dx * dy) if dx and dy else 0.0


def _solve(A, b):
    """Résout A·x = b par élimination de Gauss avec pivot partiel. A: n×n, b: n. None si singulier."""
    n = len(b)
    M = [row[:] + [b[i]] for i, row in enumerate(A)]
    for col in range(n):
        piv = max(range(col, n), key=lambda r: abs(M[r][col]))
        if abs(M[piv][col]) < 1e-12:
            return None
        M[col], M[piv] = M[piv], M[col]
        pv = M[col][col]
        M[col] = [v / pv for v in M[col]]
        for r in range(n):
            if r != col and abs(M[r][col]) > 1e-12:
                f = M[r][col]
                M[r] = [a - f * b_ for a, b_ in zip(M[r], M[col])]
    return [M[i][n] for i in range(n)]


def ols(X, y):
    """OLS avec intercept via équations normales (XᵀX)β = Xᵀy. Renvoie (coeffs[len cols], intercept, r2)."""
    n = len(y)
    k = len(X[0]) if X else 0
    Xa = [[1.0] + row for row in X]            # colonne d'intercept
    cols = k + 1
    XtX = [[sum(Xa[r][i] * Xa[r][j] for r in range(n)) for j in range(cols)] for i in range(cols)]
    Xty = [sum(Xa[r][i] * y[r] for r in range(n)) for i in range(cols)]
    beta = _solve(XtX, Xty)
    if beta is None:
        return None, None, None
    yhat = [sum(beta[i] * Xa[r][i] for i in range(cols)) for r in range(n)]
    my = _mean(y)
    ss_tot = sum((v - my) ** 2 for v in y)
    ss_res = sum((y[r] - yhat[r]) ** 2 for r in range(n))
    r2 = 1 - ss_res / ss_tot if ss_tot else 0.0
    return beta[1:], beta[0], r2


def calibrate(samples, current_weights=None):
    """samples: [{"pillars": {pillar: 0..100}, "outcome": 0..1}, …]. Renvoie un rapport de validité."""
    rows = [s for s in samples if isinstance(s.get("pillars"), dict) and s.get("outcome") is not None]
    n = len(rows)
    if n < max(8, len(PILLARS) + 1):
        return {"ok": False, "n": n,
                "reason": f"need ≥{max(8, len(PILLARS)+1)} labeled samples for a stable {len(PILLARS)}-pillar fit; got {n}.",
                "advice": "Collect agent-success outcomes for more servers (a real benchmark run), then re-run."}
    y = [float(r["outcome"]) for r in rows]
    X = [[float(r["pillars"].get(p, 0)) for p in PILLARS] for r in rows]

    # garde-fou : sans variance d'outcome (p.ex. presque tous réussissent), aucune corrélation n'est fiable
    distinct = len(set(round(v, 2) for v in y))
    ystd = (sum((v - _mean(y)) ** 2 for v in y) / len(y)) ** 0.5
    if distinct < 3 or ystd < 0.15:
        return {"ok": False, "n": n, "distinct_outcomes": distinct, "outcome_std": round(ystd, 3),
                "reason": "outcome variance too low to validate weights (most servers score the same).",
                "advice": "Add servers that genuinely differ in agent success — including weaker ones — and use "
                          "harder, discriminating tasks (and --runs>1 for fractional rates). A corpus where every "
                          "good server passes every easy task carries no signal about which pillars matter."}

    corr = {p: round(pearson([row[i] for row in X], y), 3) for i, p in enumerate(PILLARS)}

    # garde-fou sur-ajustement : k prédicteurs + intercept = k+1 paramètres. Sous ~3×(k+1) échantillons,
    # l'OLS interpole le bruit → R² gonflé et poids instables. On rend les corrélations univariées (fiables)
    # mais on refuse de présenter un fit multivarié trompeur.
    k = len(PILLARS)
    if n < 3 * (k + 1):
        return {"ok": True, "n": n, "predictors": k, "fit": "univariate_only",
                "construct_validity_r2": None,
                "pillar_correlation": dict(sorted(corr.items(), key=lambda kv: -abs(kv[1]))),
                "suggested_weights": None,
                "current_weights": _norm_weights(current_weights),
                "interpretation": [
                    f"n={n} is far below the ~{3*(k+1)} samples needed to fit {k} pillar weights — the multivariate "
                    f"R² would be an overfit mirage, so it is suppressed.",
                    "Only univariate per-pillar correlations are shown, and at this n they are noisy "
                    "(treat |r|<0.4 as no signal). Collect more, more-diverse servers before trusting weights."]}

    coefs, intercept, r2 = ols(X, y)

    suggested = None
    if coefs is not None:
        pos = [max(0.0, c) for c in coefs]      # poids négatifs → 0 (un pilier ne doit pas pénaliser)
        tot = sum(pos)
        if tot > 0:
            suggested = {p: round(pos[i] / tot, 3) for i, p in enumerate(PILLARS)}

    cur = None
    if current_weights:
        ctot = sum(current_weights.get(p, 0) for p in PILLARS) or 1
        cur = {p: round(current_weights.get(p, 0) / ctot, 3) for p in PILLARS}

    return {
        "ok": True, "n": n,
        "construct_validity_r2": round(r2, 3) if r2 is not None else None,
        "pillar_correlation": dict(sorted(corr.items(), key=lambda kv: -abs(kv[1]))),
        "suggested_weights": suggested,
        "current_weights": cur,
        "interpretation": _interpret(r2, corr),
    }


def _interpret(r2, corr):
    notes = []
    if r2 is None:
        return ["Model could not be fit (collinear pillars)."]
    if r2 >= 0.5:
        notes.append(f"Pillars explain {round(r2*100)}% of agent-success variance — strong construct validity.")
    elif r2 >= 0.25:
        notes.append(f"Pillars explain {round(r2*100)}% of variance — moderate; weights are defensible but improvable.")
    else:
        notes.append(f"Pillars explain only {round(r2*100)}% of variance — weak; the score may not yet track real success.")
    strong = [p for p, c in corr.items() if abs(c) >= 0.3]
    weak = [p for p, c in corr.items() if abs(c) < 0.1]
    if strong:
        notes.append("Carries signal: " + ", ".join(strong) + ".")
    if weak:
        notes.append("Near-zero signal (candidate to down-weight): " + ", ".join(weak) + ".")
    return notes


def main(argv=None):
    argv = argv if argv is not None else sys.argv[1:]
    if not argv:
        print("usage: python -m checkmcp.calibrate <samples.json>  "
              "([{pillars:{…},outcome:0..1}] or [{url,outcome}] joined to stored audits)", file=sys.stderr)
        return 2
    samples = json.load(open(argv[0]))

    # join url-only samples to stored audits (live pillar sub-scores)
    if samples and "pillars" not in samples[0] and samples[0].get("url"):
        try:
            from . import store
            by_url = {a["url"]: a for a in store.list_audits(limit=5000)}
            for s in samples:
                a = by_url.get(s["url"])
                if a and a.get("pillars"):
                    s["pillars"] = a["pillars"] if isinstance(a["pillars"], dict) else json.loads(a["pillars"])
        except Exception as e:
            print("store join failed:", e, file=sys.stderr)

    try:
        from .score import W
    except Exception:
        W = None
    rep = calibrate(samples, current_weights=W)
    print(json.dumps(rep, indent=2, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    sys.exit(main())
