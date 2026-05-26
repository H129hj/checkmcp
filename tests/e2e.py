#!/usr/bin/env python3
"""Batterie e2e RÉELLE — audite de vrais serveurs MCP publics + modes de sortie + cas limites + reproductibilité."""
import subprocess, sys, json, time, os

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, HERE)
from checkmcp.probe import probe
from checkmcp.score import score
from checkmcp.optimize import optimize

PUBLIC = [
    ("DeepWiki", "https://mcp.deepwiki.com/mcp"),
    ("Context7", "https://mcp.context7.com/mcp"),
    ("GitMCP", "https://gitmcp.io/modelcontextprotocol/servers"),
    ("Roundtable", "https://mcp.roundtable.now/mcp"),
    ("Chainflip", "https://chainflip-broker.io/mcp"),
]
P, F, results = 0, 0, []

def ok(cond, label):
    global P, F
    if cond:
        P += 1; results.append(f"  ✅ {label}")
    else:
        F += 1; results.append(f"  ❌ {label}")
    return cond

def cli(args):
    r = subprocess.run([sys.executable, "-m", "checkmcp.cli"] + args, capture_output=True, text=True,
                       env={**os.environ, "PYTHONPATH": HERE}, timeout=120)
    return r.returncode, r.stdout, r.stderr

print("═══════════ 1) AUDIT de vrais MCP publics ═══════════")
scored = {}
for name, url in PUBLIC:
    try:
        p = probe(url)
        if p.get("error"):
            results.append(f"  ⚠️  {name}: injoignable/auth ({p['error']}) — SKIP")
            continue
        r = score(p); r["optimize"] = optimize(p)
        scored[name] = (url, r)
        valid = isinstance(r["score"], int) and 0 <= r["score"] <= 100 and r["grade"] in "ABCDF"
        ok(valid, f"{name}: score {r['score']}/{r['grade']} valide ({r['facts']['tools']} tools)")
        ok(isinstance(r["findings"], list), f"{name}: findings causaux présents ({len(r['findings'])})")
        ok(len(r["pillars"]) == 7, f"{name}: 7 piliers")
        ok("optimize" in r and "suggestions" in r["optimize"], f"{name}: bloc optimize")
    except Exception as e:
        F += 1; results.append(f"  ❌ {name}: EXCEPTION {str(e)[:60]}")

print("\n".join(results)); results = []

print("\n═══════════ 2) MODES DE SORTIE (DeepWiki) ═══════════")
u = "https://mcp.deepwiki.com/mcp"
rc, out, err = cli([u]); ok(rc in (0, 1) and "MCP SCORE" in out, "rapport humain")
rc, out, err = cli(["--json", u])
try:
    d = json.loads(out); ok(all(k in d for k in ("score", "grade", "pillars", "findings", "facts")), "JSON structuré valide")
except Exception:
    ok(False, "JSON structuré valide")
rc, out, err = cli(["--badge", u]); ok(out.strip().startswith("<svg") and "MCP Score" in out, "badge SVG")
rc, out, err = cli(["--html", u]); ok("<title>" in out and "application/ld+json" in out and "FAQPage" in out, "page SEO (JSON-LD+FAQ)")
rc, out, err = cli(["--repo", "upstash/context7", u]); ok("upstash/context7" in out.lower(), "--repo (bloc maintenance affiché)")
print("\n".join(results)); results = []

print("\n═══════════ 3) CAS LIMITES (robustesse) ═══════════")
rc, out, err = cli(["https://nonexistent.invalid.example/mcp"]); ok(rc == 2, "URL injoignable → exit 2 propre (pas de crash)")
rc, out, err = cli(["https://example.com"]); ok(rc == 2, "URL non-MCP → erreur gérée")
rc, out, err = cli(["http://localhost:8787/mcp"]); ok(rc == 2, "MCP auth-required sans token → erreur gérée")
print("\n".join(results)); results = []

print("\n═══════════ 4) REPRODUCTIBILITÉ ═══════════")
if "DeepWiki" in scored:
    u2 = scored["DeepWiki"][0]
    s1 = score(probe(u2))["score"]; s2 = score(probe(u2))["score"]
    ok(s1 == s2, f"2 runs DeepWiki → score identique ({s1})")
print("\n".join(results))

print(f"\n═══════════ RÉSULTAT : {P} PASS · {F} FAIL ═══════════")
sys.exit(1 if F else 0)
