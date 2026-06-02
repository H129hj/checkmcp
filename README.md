# checkmcp

**Vendor-neutral quality / security / context-cost audit & score for any MCP server.**
One `uvx`/`pipx` command → an **MCP Score /100** + **causal opportunities** (why the score), Lighthouse-style.

```bash
uvx checkmcp https://mcp.deepwiki.com/mcp
# or
pipx run checkmcp https://mcp.context7.com/mcp --json
checkmcp https://my-mcp.example.com/mcp --token "$TOKEN"
```

No dependencies (stdlib only). `tiktoken` optional for exact token counts.

## What it measures (7 pillars)
- **Security** — OWASP MCP Top 10 (tool poisoning, hardcoded secrets, command injection), lethal-trifecta.
- **Tool design** — sprawl/consolidation (percentile-calibrated on real servers: median ~7 tools, p95 ~42).
- **Schemas / desc** — descriptions + `inputSchema`/`outputSchema` completeness.
- **Context-cost** — tokens spent on `tools/list`, paid on every request (the #1 pain of 2026).
- **Compliance** — protocol-version gap, annotations, JSON-RPC error conformance, OAuth discovery.
- **Reliability** — single-shot today (not credited; continuous T3 monitoring on checkmcp.dev).
- **Coverage** — the 3 primitives (tools **+ resources + prompts**).

Hard floors: secret-in-schema → cap D, failed handshake → cap F. Every penalty is attributed: `measure → mechanism → effect → Δscore`.

## CLI flags
| flag | what |
|---|---|
| `--json` | machine-readable report |
| `--badge` | SVG badge + README embed snippets |
| `--html` | standalone SEO/GEO page (JSON-LD `SoftwareApplication` + FAQ) |
| `--repo owner/name` | add maintenance/license/provenance signal from GitHub |
| `--token <bearer>` | audit an OAuth-protected server |
| `--min-score N` | CI: exit 1 if MCP Score < N |
| `--baseline file` | CI: pin tool definitions; fail on regression (rug-pull) |
| `--gh-summary` | CI: write a Markdown summary to `$GITHUB_STEP_SUMMARY` |
| `--deep` | runtime depth via an external scanner (mcp-scan/snyk) if present |

## GitHub Action

```yaml
# .github/workflows/mcp-audit.yml
name: MCP audit
on: [push, pull_request]
jobs:
  checkmcp:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: H129hj/checkmcp@v1
        with:
          url: https://my-mcp.example.com/mcp
          min-score: "70"
          baseline: .checkmcp-baseline.json   # commit it → fails on rug-pull
```

## Hosted
Full reports, public directory, live badges and continuous drift monitoring at **[checkmcp.dev](https://checkmcp.dev)**.

## Honest limitations
- Percentile bands come from a growing corpus (one+ registries) — widening over time.
- Exact tokens with `pipx install "checkmcp[exact-tokens]"` (cl100k_base); otherwise chars/4 approximation.
- Pillar weights are not yet validated against an agent-success benchmark (construct validity = roadmap endgame).

MIT.
