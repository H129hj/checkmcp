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
PILL = {"security": "Security", "tool_design": "Tool Design", "desc_schema": "Desc/Schema",
        "reliability": "Reliability", "token": "Token/Context", "compliance": "Compliance", "use_case": "Use-Case"}


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
    out.append(f"  token: {res['tokmode']} · reliability: {res['reliability_confidence']}")
    out.append("")
    P = res["pillars"]
    for k in ["security", "tool_design", "desc_schema", "token", "compliance", "use_case", "reliability"]:
        note = "  (not credited, T1)" if k == "reliability" else f"  (×{W[k]})"
        out.append(f"  {PILL[k]:<14} {BAR(P[k])} {P[k]:>3}{note}")
    out.append("")
    out.append("  OPPORTUNITIES (sorted by causal impact)")
    out.append("  " + "─" * 52)
    if not res["findings"]:
        out.append("  ✅ none")
    for f in res["findings"]:
        out.append(f"  [{f['severity']:<8} Δ{f['delta']:>4}] {f['measured']}")
        out.append(f"     ↳ {f['mechanism']} → {f['effect']}")
    mt = res.get("maintenance")
    if mt and not mt.get("error"):
        lic = mt.get("license") or "no license"
        age = f"{mt['pushed_days']}d" if mt.get("pushed_days") is not None else "?"
        out.append("")
        out.append(f"  MAINTENANCE ({mt.get('repo','?')}) — last push {age} · {lic} · ⭐{mt.get('stars',0)}" + (" · ⚠️ ARCHIVED" if mt.get("archived") else ""))
    opt = res.get("optimize")
    if opt and opt["suggestions"]:
        out.append("")
        out.append(f"  COMPOSITE OPTIMIZATIONS  ({opt['current_tools']} → ~{opt['projected_tools']} tools · ~{opt['est_tokens_saved']//1000 or opt['est_tokens_saved']}{'k' if opt['est_tokens_saved']>=1000 else ''} tok saved)")
        out.append("  " + "─" * 52)
        for s in opt["suggestions"][:6]:
            head = ", ".join(s["tools"][:4]) + ("…" if len(s["tools"]) > 4 else "")
            out.append(f"  [{s['severity']:<6}] {head}")
            out.append(f"     → {s['proposed']}")
            out.append(f"       {s['why']}")
    ev = res.get("evals")
    if ev and ev.get("ran"):
        out.append("")
        n = len(ev.get("tools_probed", []))
        out.append(f"  BEHAVIORAL EVAL — verdict: {ev.get('verdict','?').upper()} · {n} read-only tool(s) probed · {ev.get('skipped',0)} skipped")
        out.append("  " + "─" * 52)
        if not ev.get("findings"):
            out.append("  ✅ no runtime injection / exfiltration / leakage observed")
        for f in ev.get("findings", []):
            out.append(f"  [{f['severity']:<6}] {f['type']} — {f['tool']}")
            out.append(f"     ↳ {f['detail']}")
            if f.get("evidence"):
                out.append(f"       evidence: {f['evidence']}")
    elif ev and not ev.get("ran"):
        out.append("")
        out.append(f"  BEHAVIORAL EVAL — not run ({ev.get('reason','?')})")

    rt = res.get("runtime")
    if rt:
        out.append("")
        if rt.get("backend"):
            rf = rt.get("findings", [])
            out.append(f"  RUNTIME ({rt['backend']}) — {len(rf)} finding(s)" + (f" · {rt['error']}" if rt.get("error") else ""))
            for fnd in rf[:6]:
                out.append(f"  [{fnd['severity']:<6}] {fnd['owasp']} — {fnd['issue']} ({fnd['tool']})")
        else:
            out.append(f"  RUNTIME — {rt.get('note','')}")
    out.append("")
    return "\n".join(out)


def main(argv=None):
    if argv is None:
        argv = sys.argv[1:]
    if argv and argv[0] == "mcp":
        # `audit-mcp mcp` : démarre le mode serveur MCP (stdio) — voir mcp_server.py
        from .mcp_server import main as mcp_main
        return mcp_main(argv[1:])
    ap = argparse.ArgumentParser(prog="audit-mcp", description="Audit & score the quality / security / context-cost of an MCP server.")
    ap.add_argument("url", help="MCP endpoint URL (streamable-http or SSE), e.g. https://mcp.deepwiki.com/mcp")
    ap.add_argument("--token", help="Bearer token if the server requires auth", default=None)
    ap.add_argument("--json", action="store_true", help="JSON output (report.json)")
    ap.add_argument("--badge", action="store_true", help="Emit the SVG badge + embed snippets")
    ap.add_argument("--html", action="store_true", help="Emit the server's SEO/GEO page (JSON-LD)")
    ap.add_argument("--repo", help="owner/name or GitHub URL -> maintenance/liveness/license signal", default=None)
    ap.add_argument("--min-score", type=int, default=None, help="CI: fail (exit 1) if MCP Score < N")
    ap.add_argument("--baseline", default=None, help="CI: fingerprint file; a regression (tool mutation/removal) fails the build. Created if missing.")
    ap.add_argument("--gh-summary", action="store_true", help="CI: write a Markdown summary to $GITHUB_STEP_SUMMARY")
    ap.add_argument("--deep", action="store_true", help="Runtime depth via external scanner (mcp-scan/snyk/CHECKMCP_SCANNER_CMD) if present")
    ap.add_argument("--evals", action="store_true", help="Behavioral sandbox: actually invoke read-only tools with canary inputs to catch tool-output injection / exfiltration (sends real traffic to the server)")
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

    # ---- Profondeur runtime (#8) : fusion d'un scanner externe si présent ----
    if a.deep:
        from . import scanners
        rt = scanners.scan(a.url)
        res["runtime"] = rt
        for fnd in rt.get("findings", []):
            res["findings"].append({"pillar": "security", "severity": fnd["severity"],
                                    "measured": f"[{fnd['owasp']}·runtime/{fnd['source']}] {fnd['issue']}",
                                    "mechanism": "detected at runtime by an external scanner",
                                    "effect": f"outil: {fnd['tool']}", "delta": 0})
        res["findings"].sort(key=lambda x: x["delta"], reverse=True)

    # ---- Evals comportementaux (#T4, opt-in) : sonde le runtime des outils read-only ----
    if a.evals:
        from .evals import behavioral_eval
        p["url"] = a.url
        ev = behavioral_eval(p, token=a.token)
        res["evals"] = ev
        for f in ev.get("findings", []):
            if f["severity"] == "HIGH":
                res["findings"].append({"pillar": "security", "severity": "CRITICAL",
                                        "measured": f"[behavioral] {f['type']} — {f['tool']}",
                                        "mechanism": f["detail"],
                                        "effect": f.get("evidence") or "confirmed by live tool invocation", "delta": 0})
        if ev.get("verdict") == "malicious":
            res["floor"] = res.get("floor") or "behavioral: active injection/exfiltration confirmed at runtime"
            res["grade"] = "F" if res["grade"] not in ("F",) else res["grade"]
        res["findings"].sort(key=lambda x: x["delta"], reverse=True)

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
            print(f"[checkmcp] baseline pinned -> {a.baseline}", file=sys.stderr)

    # ---- CI: décision d'échec ----
    fail = False
    if a.min_score is not None and res["score"] < a.min_score:
        fail = True
        print(f"[checkmcp] FAIL: score {res['score']} < min {a.min_score}", file=sys.stderr)
    if regression and regression["drift"] and any(e["severity"] in ("CRITICAL", "BREAKING") for e in regression["events"]):
        fail = True
        print(f"[checkmcp] FAIL: regression {regression['verdict']}", file=sys.stderr)
    if res.get("evals", {}).get("verdict") == "malicious":
        fail = True
        print("[checkmcp] FAIL: behavioral eval flagged active injection/exfiltration", file=sys.stderr)

    # ---- CI: GitHub Step Summary ----
    if a.gh_summary and os.environ.get("GITHUB_STEP_SUMMARY"):
        with open(os.environ["GITHUB_STEP_SUMMARY"], "a") as fh:
            fh.write(f"## CheckMCP — `{a.url}`\n\n**MCP Score: {res['score']}/100 ({res['grade']})**"
                     + (f" · ⚠️ {res['floor']}" if res.get("floor") else "") + "\n\n")
            fh.write("| Pillar | Score |\n|---|---|\n" + "".join(f"| {k} | {v} |\n" for k, v in res["pillars"].items()))
            if res["findings"]:
                fh.write("\n**Top opportunities:**\n" + "".join(f"- [{x['severity']}] {x['measured']}\n" for x in res["findings"][:5]))
            if regression and regression["drift"]:
                fh.write(f"\n**⚠️ Regression: {regression['verdict']}**\n" + "".join(f"- [{e['severity']}] {e['type']} `{e['tool']}`\n" for e in regression["events"][:6]))
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
    # exit code: en mode CI (min-score/baseline/evals), gouverné par fail ; sinon défaut grade F
    if a.min_score is not None or a.baseline or a.evals:
        return 1 if fail else 0
    return 0 if res["grade"] not in ("F",) else 1


if __name__ == "__main__":
    sys.exit(main())
