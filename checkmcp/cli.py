"""CLI CheckMCP — `checkmcp <url>` : audit + MCP Score + rapport causal Lighthouse-style."""
import argparse, json, sys
from . import __version__
import os, re
from .probe import probe
from .score import score, W
from .optimize import optimize
from .badge import badge_svg, embed_snippets
from .page import render as render_page


def _slug(url):
    h = re.sub(r"^https?://", "", url).split("/")[0]
    return re.sub(r"[^a-z0-9]+", "-", h.lower()).strip("-")

BAR = lambda s: ("█" * round(s / 10)).ljust(10, "░")
PILL = {"security": "Sécurité", "tool_design": "Tool Design", "desc_schema": "Desc/Schema",
        "reliability": "Fiabilité", "token": "Token/Context", "compliance": "Compliance", "use_case": "Use-Case"}


def human(url, res):
    g = res["grade"]; s = res["score"]
    out = []
    out.append("")
    out.append("┌" + "─" * 54 + "┐")
    out.append(f"│  MCP SCORE  {s:>3} / 100   ·   Grade {g}".ljust(55) + "│")
    fa = res["facts"]
    srv = fa.get("proto", "?")
    out.append(f"│  {url[:50]}".ljust(55) + "│")
    out.append(f"│  proto {fa['proto']} · {fa['tools']} tools · {fa['resources']} res · {fa['prompts']} prompts".ljust(55) + "│")
    if res.get("floor"):
        out.append(f"│  ⚠️  FLOOR: {res['floor']}".ljust(55) + "│")
    out.append("└" + "─" * 54 + "┘")
    out.append(f"  token: {res['tokmode']} · fiabilité: {res['reliability_confidence']}")
    out.append("")
    P = res["pillars"]
    for k in ["security", "tool_design", "desc_schema", "token", "compliance", "use_case", "reliability"]:
        note = "  (non crédité T1)" if k == "reliability" else f"  (×{W[k]})"
        out.append(f"  {PILL[k]:<14} {BAR(P[k])} {P[k]:>3}{note}")
    out.append("")
    out.append("  OPPORTUNITÉS (triées par impact causal)")
    out.append("  " + "─" * 52)
    if not res["findings"]:
        out.append("  ✅ RAS")
    for f in res["findings"]:
        out.append(f"  [{f['severity']:<8} Δ{f['delta']:>4}] {f['measured']}")
        out.append(f"     ↳ {f['mechanism']} → {f['effect']}")
    mt = res.get("maintenance")
    if mt and not mt.get("error"):
        lic = mt.get("license") or "aucune licence"
        age = f"{mt['pushed_days']}j" if mt.get("pushed_days") is not None else "?"
        out.append("")
        out.append(f"  MAINTENANCE ({mt.get('repo','?')}) — dernier push {age} · {lic} · ⭐{mt.get('stars',0)}" + (" · ⚠️ ARCHIVÉ" if mt.get("archived") else ""))
    opt = res.get("optimize")
    if opt and opt["suggestions"]:
        out.append("")
        out.append(f"  OPTIMISATIONS COMPOSITE  ({opt['current_tools']} → ~{opt['projected_tools']} outils · ~{opt['est_tokens_saved']//1000 or opt['est_tokens_saved']}{'k' if opt['est_tokens_saved']>=1000 else ''} tok économisés)")
        out.append("  " + "─" * 52)
        for s in opt["suggestions"][:6]:
            head = ", ".join(s["tools"][:4]) + ("…" if len(s["tools"]) > 4 else "")
            out.append(f"  [{s['severity']:<6}] {head}")
            out.append(f"     → {s['proposed']}")
            out.append(f"       {s['why']}")
    out.append("")
    return "\n".join(out)


def main(argv=None):
    ap = argparse.ArgumentParser(prog="checkmcp", description="Audit & score qualité/sécurité/context-cost d'un serveur MCP.")
    ap.add_argument("url", help="URL de l'endpoint MCP (streamable-http), ex: https://mcp.deepwiki.com/mcp")
    ap.add_argument("--token", help="Bearer token si le serveur exige l'auth", default=None)
    ap.add_argument("--json", action="store_true", help="Sortie JSON (report.json)")
    ap.add_argument("--badge", action="store_true", help="Émet le badge SVG + les snippets d'embed")
    ap.add_argument("--html", action="store_true", help="Émet la page SEO/GEO (JSON-LD) du serveur")
    ap.add_argument("--repo", help="owner/name ou URL GitHub → maintenance/liveness/licence (largeur)", default=None)
    ap.add_argument("--min-score", type=int, default=None, help="CI: échoue (exit 1) si le MCP Score < N")
    ap.add_argument("--baseline", default=None, help="CI: fichier d'empreinte ; régression (mutation/retrait d'outil) → échoue. Créé s'il n'existe pas.")
    ap.add_argument("--gh-summary", action="store_true", help="CI: écrit un résumé Markdown dans $GITHUB_STEP_SUMMARY")
    ap.add_argument("--version", action="version", version=f"checkmcp {__version__}")
    a = ap.parse_args(argv)

    p = probe(a.url, token=a.token)
    if p.get("error"):
        err = {"url": a.url, "error": p["error"]}
        print(json.dumps(err) if a.json else f"❌ {a.url} — {p['error']}", file=sys.stderr)
        return 2
    res = score(p)
    res["optimize"] = optimize(p)
    if a.repo:
        from .repo import fetch as repo_fetch, findings as repo_findings
        meta = repo_fetch(a.repo)
        res["maintenance"] = meta
        res["findings"] += repo_findings(meta)
        res["findings"].sort(key=lambda x: x["delta"], reverse=True)
    res["url"] = a.url
    res["server"] = p.get("server", {})
    slug = _slug(a.url)

    # ---- CI: régression vs baseline (rug-pull/retrait d'outil) ----
    regression = None
    if a.baseline:
        from .monitor import fingerprint, diff, summarize
        fp = fingerprint(p)
        if os.path.exists(a.baseline):
            base = json.load(open(a.baseline))
            regression = summarize(diff(base, fp))
            res["regression"] = regression
        else:
            json.dump(fp, open(a.baseline, "w"))
            print(f"[checkmcp] baseline épinglée → {a.baseline}", file=sys.stderr)

    # ---- CI: décision d'échec ----
    fail = False
    if a.min_score is not None and res["score"] < a.min_score:
        fail = True
        print(f"[checkmcp] FAIL: score {res['score']} < min {a.min_score}", file=sys.stderr)
    if regression and regression["drift"] and any(e["severity"] in ("CRITICAL", "BREAKING") for e in regression["events"]):
        fail = True
        print(f"[checkmcp] FAIL: régression {regression['verdict']}", file=sys.stderr)

    # ---- CI: GitHub Step Summary ----
    if a.gh_summary and os.environ.get("GITHUB_STEP_SUMMARY"):
        with open(os.environ["GITHUB_STEP_SUMMARY"], "a") as fh:
            fh.write(f"## CheckMCP — `{a.url}`\n\n**MCP Score: {res['score']}/100 ({res['grade']})**"
                     + (f" · ⚠️ {res['floor']}" if res.get("floor") else "") + "\n\n")
            fh.write("| Pilier | Score |\n|---|---|\n" + "".join(f"| {k} | {v} |\n" for k, v in res["pillars"].items()))
            if res["findings"]:
                fh.write("\n**Top opportunités:**\n" + "".join(f"- [{x['severity']}] {x['measured']}\n" for x in res["findings"][:5]))
            if regression and regression["drift"]:
                fh.write(f"\n**⚠️ Régression: {regression['verdict']}**\n" + "".join(f"- [{e['severity']}] {e['type']} `{e['tool']}`\n" for e in regression["events"][:6]))
    if a.badge:
        print(badge_svg(res["score"], res["grade"]))
        for k, v in embed_snippets(slug, res["score"], res["grade"]).items():
            print(f"<!-- {k}: {v} -->", file=sys.stderr)
    elif a.html:
        print(render_page(a.url, slug, res))
    elif a.json:
        print(json.dumps(res, indent=2, ensure_ascii=False))
    else:
        print(human(a.url, res))
    # exit code: en mode CI (min-score/baseline), gouverné par fail ; sinon défaut grade F
    if a.min_score is not None or a.baseline:
        return 1 if fail else 0
    return 0 if res["grade"] not in ("F",) else 1


if __name__ == "__main__":
    sys.exit(main())
