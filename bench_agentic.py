#!/usr/bin/env python3
"""Long-horizon, multi-tool agentic benchmark (CheckMCP construct validity, path 2).

Unlike the single-question bench.py, each task here needs SEVERAL tool calls + synthesis, so a server's
tool design / schema clarity / coverage can actually cause partial failure. Success is graded 0 / 0.5 / 1
by an LLM judge (a toolless `claude -p`) against a per-task rubric — finer than regex, more variance.

Resource-safe: EVERY `claude -p` uses --strict-mcp-config so ONLY the target server loads (never the
user's global MCP config → no serena/playwright storm). Judge runs use an empty MCP config.

Emits agentic_samples.json [{url, name, outcome, turns}].
"""
import argparse, json, os, re, subprocess, sys, tempfile

TASKS = [
    ("https://mcp.exa.ai/mcp", "exa",
     "Research with web search: find the current latest stable version of BOTH React and Vue.js, give the source URL for each, and state which framework released its latest version more recently.",
     "Full credit if it reports a plausible React version AND a Vue version, with a source URL for each, and a recency comparison. Half if only one framework is fully covered."),
    ("https://learn.microsoft.com/api/mcp", "mslearn",
     "Using Microsoft Learn, give the exact Azure CLI commands to (1) create a resource group, (2) create an Azure Container Registry, and (3) create an App Service plan. List all three commands.",
     "Full credit if all three commands are present and correct (az group create, az acr create, az appservice plan create). Half if two are correct."),
    ("https://mcp.context7.com/mcp", "context7",
     "Using the library docs, write a correct minimal Zod example: a schema for an object with a required 'email' (validated as an email) and an optional numeric 'age', then parse an input object. Provide the code.",
     "Full credit if the code uses z.object, z.string().email(), an optional number, and .parse(). Half if mostly correct but missing one element."),
    ("https://mcp.docs.astro.build/mcp", "astro",
     "Using Astro docs, show how to fetch data at build time in an .astro component and render a list from it. Give a code sketch covering both the frontmatter fetch and the template loop.",
     "Full credit if it shows a top-level await fetch in the frontmatter AND a .map()/loop in the template. Half if only one part."),
    ("https://mcp.deepwiki.com/mcp", "deepwiki",
     "In modelcontextprotocol/python-sdk, show how to create a FastMCP server and register a tool via decorator, including the import line and how to run it. Provide the code.",
     "Full credit if it shows the FastMCP import, an @...tool() decorator on a function, and a run call. Half if mostly right but missing one."),
    ("https://mcp.roundtable.now/mcp", "roundtable",
     "Explore this server's available tools, then accomplish a representative end-to-end task using AT LEAST TWO different tools. Report which tools you called and the concrete results.",
     "Full credit if it actually invoked >=2 distinct tools and reported concrete results. Half if it used one tool or only described without results."),
    ("https://gitmcp.io/supabase/supabase", "supabase",
     "Using the supabase docs, write JS code to: initialize the supabase client, insert a row into a 'todos' table, then select all rows. Provide the code.",
     "Full credit if it shows createClient, .from('todos').insert(...), and .select(). Half if two of three."),
    ("https://chainflip-broker.io/mcp", "chainflip",
     "Using the tools, obtain a REAL swap quote: how much of one supported asset you would receive for swapping a specific amount of another supported asset. Report the asset pair and the numeric quote.",
     "Full credit ONLY if a concrete numeric quote for a real asset pair is returned via the tools. Half if it identified assets/tools but could not produce a quote. Zero if it failed to use the server."),
    ("https://gitmcp.io/microsoft/typescript", "typescript",
     "Using the docs, give a code example of a TypeScript generic function constrained with 'extends', and explain in one sentence what the constraint enforces.",
     "Full credit if it shows a <T extends ...> generic function example AND a correct one-sentence explanation. Half if one is weak."),
]

JUDGE_MODEL_CFG = {"mcpServers": {}}


def _run_claude(prompt, cfgpath, allowed=None, max_turns=12):
    cmd = ["claude", "-p", prompt, "--mcp-config", cfgpath, "--strict-mcp-config",
           "--output-format", "json", "--max-turns", str(max_turns)]
    if allowed:
        cmd += ["--allowedTools", allowed]
    out = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
    try:
        return json.loads(out.stdout or "{}")
    except Exception:
        return {"is_error": True, "result": "", "_raw": (out.stdout or out.stderr)[:200]}


def judge(task, rubric, answer):
    with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False) as f:
        json.dump(JUDGE_MODEL_CFG, f); cfg = f.name
    try:
        prompt = (f"You are grading an AI agent's answer to a task.\n\nTASK:\n{task}\n\nRUBRIC:\n{rubric}\n\n"
                  f"AGENT ANSWER:\n{answer}\n\nReply with ONLY a JSON object: {{\"score\": 1.0|0.5|0.0, \"why\": \"...\"}}.")
        d = _run_claude(prompt, cfg, max_turns=1)
        txt = d.get("result") or ""
        m = re.search(r'\{.*\}', txt, re.S)
        if m:
            try:
                j = json.loads(m.group(0))
                s = float(j.get("score"))
                return (s if s in (0.0, 0.5, 1.0) else round(max(0.0, min(1.0, s)) * 2) / 2), j.get("why", "")[:120]
            except Exception:
                pass
        return 0.0, "judge-parse-fail: " + txt[:80]
    finally:
        os.unlink(cfg)


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="agentic_samples.json")
    a = ap.parse_args(argv)
    samples = []
    for url, name, task, rubric in TASKS:
        cfg = {"mcpServers": {name: {"type": "http", "url": url}}}
        with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False) as f:
            json.dump(cfg, f); cfgpath = f.name
        try:
            d = _run_claude(task, cfgpath, allowed=f"mcp__{name}", max_turns=12)
        finally:
            os.unlink(cfgpath)
        ans = d.get("result") or ""
        turns = d.get("num_turns")
        if d.get("is_error") or not ans:
            score, why = 0.0, "agent error/empty"
        else:
            score, why = judge(task, rubric, ans)
        samples.append({"url": url, "name": name, "outcome": score, "turns": turns})
        print(f"  {score:>4}  {name:<12} turns={turns}  ({why})", file=sys.stderr)
    json.dump(samples, open(a.out, "w"), indent=2)
    print(json.dumps(samples, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
