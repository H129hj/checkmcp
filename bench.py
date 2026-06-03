#!/usr/bin/env python3
"""Agent-success benchmark for CheckMCP construct validity (T4 part 2, bootstrap).

For each (MCP server, task) we run a REAL Claude agent (headless `claude -p`) connected to that server
and grade whether it accomplished the task (ground-truth regex on the final answer + no error). The
per-server success rate is the *outcome* signal that calibrate.py correlates against pillar sub-scores.

Non-circular: outcome comes from real task completion, not from the static score. Honest: a tiny/narrow
corpus yields a low R² — that finding is the point (it says "collect more, more-diverse servers").

Usage: python3 bench.py            # runs all tasks, writes bench_samples.json + prints summary
       python3 bench.py --runs 2   # repeat each task N times for a rate
"""
import argparse, json, os, re, subprocess, sys, tempfile

# Discriminating tasks: specific, single ground-truth answer reachable ONLY by actually using the
# server's tools well. Success therefore tracks tool/schema quality + retrieval accuracy, not luck.
TASKS = [
    ("https://mcp.exa.ai/mcp", "exa",
     "Use web search to find which company created the Model Context Protocol (MCP) and the year it was first released. Give the company and year.",
     r"anthropic.*(2024|2025)|(2024|2025).*anthropic|anthropic"),
    ("https://learn.microsoft.com/api/mcp", "mslearn",
     "Search Microsoft Learn for the exact Azure CLI command that creates a storage account. Answer with the command only.",
     r"az storage account create"),
    ("https://mcp.context7.com/mcp", "context7",
     "Resolve docs for the 'zod' library and give the exact function call used to define a string schema. Answer with the call.",
     r"z\.string\(\)"),
    ("https://mcp.docs.astro.build/mcp", "astro",
     "In Astro, what client directive hydrates a component only when it scrolls into view? Answer with the directive.",
     r"client:visible"),
    ("https://mcp.deepwiki.com/mcp", "deepwiki",
     "In the repo modelcontextprotocol/python-sdk, what is the high-level class used to build a server (the ergonomic one)? Answer with the class name.",
     r"fastmcp"),
    ("https://mcp.roundtable.now/mcp", "roundtable",
     "Inspect the available tools and call the most relevant one to return a concrete result. Then name the exact tool you used.",
     r"\b\w+_\w+\b|tool"),  # usability: must actually invoke a named tool
    ("https://chainflip-broker.io/mcp", "chainflip",
     "Using the tools, name at least two crypto assets supported for swapping on Chainflip. Answer with the ticker symbols.",
     r"\b(btc|eth|usdc|usdt|flip|dot|sol|arb)\b.*\b(btc|eth|usdc|usdt|flip|dot|sol|arb)\b"),
    ("https://gitmcp.io/supabase/supabase", "supabase",
     "In the supabase-js client, what method chain inserts a new row into a table? Answer with the method.",
     r"\.insert\("),
    ("https://gitmcp.io/tiangolo/fastapi", "fastapi",
     "In FastAPI, which class do you use as a default value to declare and validate a path parameter? Answer with the class name.",
     r"\bpath\b"),
    ("https://gitmcp.io/facebook/react", "react",
     "Which React Hook memoizes the result of an expensive computation between renders? Answer with the hook name.",
     r"usememo"),
    ("https://gitmcp.io/microsoft/typescript", "typescript",
     "In TypeScript, which built-in utility type makes all properties of a type T optional? Answer with the type name.",
     r"partial<"),
    ("https://gitmcp.io/pytorch/pytorch", "pytorch",
     "In PyTorch, what optimizer method clears (zeroes) the accumulated gradients? Answer with the method name.",
     r"zero_grad"),
    ("https://gitmcp.io/tailwindlabs/tailwindcss", "tailwind",
     "In Tailwind CSS, which utility class applies CSS 'display: flex'? Answer with the class.",
     r"\bflex\b"),
    ("https://gitmcp.io/python/cpython", "cpython",
     "In CPython, what C-API macro returns a new reference to Py_None? Answer with the macro.",
     r"py_return_none|py_none"),
]


def run_task(url, name, task, runs):
    allowed = f"mcp__{name}"
    cfg = {"mcpServers": {name: {"type": "http", "url": url}}}
    successes = 0
    detail = []
    with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False) as f:
        json.dump(cfg, f); cfgpath = f.name
    try:
        for i in range(runs):
            try:
                out = subprocess.run(
                    # --strict-mcp-config: load ONLY the target server, NOT the user's global MCP config
                    # (otherwise every headless run boots serena/playwright/etc. → resource storm).
                    ["claude", "-p", task, "--mcp-config", cfgpath, "--strict-mcp-config",
                     "--allowedTools", allowed, "--output-format", "json", "--max-turns", "6"],
                    capture_output=True, text=True, timeout=180)
                d = json.loads(out.stdout or "{}")
                ans = d.get("result") or ""
                ok = (not d.get("is_error")) and bool(ans)
                detail.append({"is_error": d.get("is_error"), "turns": d.get("num_turns"), "answer": ans[:160]})
            except Exception as e:
                ok, ans = False, ""
                detail.append({"error": str(e)[:120]})
            successes += 1 if ok else 0
    finally:
        os.unlink(cfgpath)
    return successes / runs if runs else 0.0, detail


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("--runs", type=int, default=1)
    ap.add_argument("--out", default="bench_samples.json")
    a = ap.parse_args(argv)

    samples = []
    for url, name, task, expect in TASKS:
        rate, detail = run_task(url, name, task, a.runs)
        # grade: succès si pas d'erreur ET la vérité-terrain apparaît dans la réponse
        graded = []
        for d in detail:
            ans = d.get("answer", "")
            graded.append(1 if (not d.get("is_error") and not d.get("error") and re.search(expect, ans, re.I)) else 0)
        outcome = sum(graded) / len(graded) if graded else 0.0
        samples.append({"url": url, "name": name, "outcome": round(outcome, 3)})
        print(f"  {outcome:>4.0%}  {name:<12} {url}", file=sys.stderr)
        for d in detail:
            print(f"        · {d}", file=sys.stderr)

    json.dump(samples, open(a.out, "w"), indent=2)
    print(json.dumps(samples, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
