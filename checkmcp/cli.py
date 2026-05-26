"""CLI CheckMCP — `checkmcp <url>` : audit + MCP Score + rapport causal Lighthouse-style."""
import argparse, json, sys
from . import __version__
from .probe import probe
from .score import score, W
from .optimize import optimize

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
    ap.add_argument("--json", action="store_true", help="Sortie JSON (report.json) au lieu du rapport humain")
    ap.add_argument("--version", action="version", version=f"checkmcp {__version__}")
    a = ap.parse_args(argv)

    p = probe(a.url, token=a.token)
    if p.get("error"):
        err = {"url": a.url, "error": p["error"]}
        print(json.dumps(err) if a.json else f"❌ {a.url} — {p['error']}", file=sys.stderr)
        return 2
    res = score(p)
    res["optimize"] = optimize(p)
    res["url"] = a.url
    res["server"] = p.get("server", {})
    if a.json:
        print(json.dumps(res, indent=2, ensure_ascii=False))
    else:
        print(human(a.url, res))
    return 0 if res["grade"] not in ("F",) else 1


if __name__ == "__main__":
    sys.exit(main())
