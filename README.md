<!-- mcp-name: io.github.H129hj/checkmcp -->

# checkmcp

[![PyPI](https://img.shields.io/pypi/v/checkmcp)](https://pypi.org/project/checkmcp/) [![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE) [![GitHub Action](https://img.shields.io/badge/CI-GitHub%20Action-2088FF?logo=githubactions&logoColor=white)](action.yml) [![Web audit](https://img.shields.io/badge/web-checkmcp.dev-blue)](https://checkmcp.dev)

**Vendor-neutral quality / security / context-cost audit & score for any MCP server.**
One `uvx`/`pipx` command → an **MCP Score /100** + **causal opportunities** (why the score), Lighthouse-style.

```bash
uvx checkmcp https://mcp.deepwiki.com/mcp
# or
pipx run checkmcp https://mcp.context7.com/mcp --json
checkmcp https://my-mcp.example.com/mcp --token "$TOKEN"
```

## Use it as an MCP server

`checkmcp mcp` turns the auditor itself into an MCP server (stdio) exposing one tool,
`audit_mcp_server` — so your agent can answer *"is this MCP server safe?"* mid-conversation.

```bash
# Claude Code
claude mcp add checkmcp -- uvx checkmcp mcp
```

```json
// Cursor (.cursor/mcp.json) / Claude Desktop (claude_desktop_config.json)
{ "mcpServers": { "checkmcp": { "command": "uvx", "args": ["checkmcp", "mcp"] } } }
```

Registry name: `io.github.H129hj/checkmcp` <!-- mcp-name: io.github.H129hj/checkmcp -->


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
| `--evals` | behavioral sandbox: actually invokes read-only tools with canary inputs to catch tool-output prompt-injection, exfiltration vectors, secret/PII leakage and context bombs (sends real traffic; CI-fails on a malicious verdict) |

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

## Behavioral evals (`--evals`)
Static analysis catches *declared* danger; `--evals` catches *runtime* danger by actually invoking
read-only tools with canary inputs and inspecting the **responses** for tool-output prompt-injection,
exfiltration vectors and secret/PII leakage (multilingual; optional callback-canary confirms exfil).
CI-fails on a malicious verdict.

## Self-hosted security gateway
Beyond auditing, CheckMCP ships an **in-band MCP gateway** — a proxy you put between your agent and an
MCP server. It inspects every call, and in *active* mode **blocks/strips** tool-poisoning & exfiltration
before they reach the agent. Run it in your own infra (tool traffic never leaves your network):

```bash
docker pull ghcr.io/h129hj/checkmcp-gateway:latest   # or build from source
docker run -p 8080:8080 -e GATEWAY_BACKEND_URL=https://mcp.example.com/mcp \
  -e GATEWAY_MODE=active -e GATEWAY_SECRET=$(openssl rand -hex 16) \
  ghcr.io/h129hj/checkmcp-gateway:latest
```

See **[GATEWAY.md](GATEWAY.md)** for config (passive/active, OAuth backends, policy, logs).

## Hosted
Full reports, public directory, live badges, continuous drift monitoring, a governance policy API and a
hosted gateway at **[checkmcp.dev](https://checkmcp.dev)**.

## Honest limitations
- Percentile bands come from a growing corpus (one+ registries) — widening over time.
- Exact tokens with `pipx install "checkmcp[exact-tokens]"` (cl100k_base); otherwise chars/4 approximation.
- Pillar weights are expert priors. `python -m checkmcp.calibrate samples.json` validates them against a labeled agent-success sample (per-pillar correlation + OLS-suggested weights + construct-validity R²) — supply real outcomes to close the loop.

MIT.
