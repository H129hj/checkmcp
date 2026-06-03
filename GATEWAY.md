# CheckMCP Gateway — self-hosted

A single-backend **MCP security proxy** you run in your own infrastructure. Your agent connects to the
gateway instead of the raw MCP server; the gateway proxies every call, **inspects tool outputs** for
prompt-injection / exfiltration / secret leakage, scores the backend, and (in active mode) **blocks or
strips** danger before it reaches your agent. Tool traffic never leaves your network. stdlib-only image.

## Run

```bash
# pull the published image (after the first GitHub Release) …
docker pull ghcr.io/h129hj/checkmcp-gateway:latest
# … or build from source:
docker build -t checkmcp-gateway .

docker run -d -p 8080:8080 \
  -e GATEWAY_BACKEND_URL=https://mcp.example.com/mcp \
  -e GATEWAY_MODE=active \
  -e GATEWAY_MIN_SCORE=70 \
  -e GATEWAY_SECRET="$(openssl rand -hex 16)" \
  checkmcp-gateway
```

Point your agent at `http://<host>:8080/mcp` with header `Authorization: Bearer <GATEWAY_SECRET>`:

```json
{
  "mcpServers": {
    "secured": {
      "type": "http",
      "url": "http://localhost:8080/mcp",
      "headers": { "Authorization": "Bearer <GATEWAY_SECRET>" }
    }
  }
}
```

## Config (env)

| var | default | meaning |
|---|---|---|
| `GATEWAY_BACKEND_URL` | — (required) | the real MCP server to proxy |
| `GATEWAY_BACKEND_TOKEN` | — | OAuth Bearer for the backend (stays in your env) |
| `GATEWAY_SECRET` | — | if set, the agent must present it as `Authorization: Bearer` |
| `GATEWAY_MODE` | `passive` | `passive` = observe + log; `active` = block/strip |
| `GATEWAY_MIN_SCORE` | `0` (off) | active: block calls if the backend MCP Score is below this |
| `GATEWAY_BLOCK_INJECTION` | `1` | active: strip tool outputs containing injection/exfil/secrets |
| `GATEWAY_PORT` | `8080` | listen port |

## Modes

- **Passive** — proxies everything unchanged, logs each call + flags risks. Use this first to build trust
  and see what your MCP servers actually return.
- **Active** — enforces: a backend below `GATEWAY_MIN_SCORE` is blocked; a tool response containing a
  HIGH-severity finding (active prompt-injection, exfiltration vector, hardcoded secret) is **withheld**
  and replaced with a safety notice. Your agent never sees the poisoned content.

## Observability

One JSON object per line to stdout — pipe it into your logging stack:

```json
{"event":"tools/list","tools":2,"score":87,"grade":"B","ts":1780475844}
{"event":"output_blocked","tool":"read_note","kinds":"active_prompt_injection, exfiltration_vector","ts":1780475933}
{"event":"drift","verdict":"BREAKING","events":[...],"ts":...}
```

`GET /health` returns `{status, version, backend, mode}` for liveness/readiness probes.

## What it catches

- **Tool-response poisoning** — injection instructions hidden in a tool's *output* (multilingual).
- **Exfiltration vectors** — output pushing the agent to send data to an external destination.
- **Secret / PII leakage** in responses.
- **Rug-pull / drift** — the backend's tool set or schemas mutating mid-session (tool pinning).

The hosted control plane (audit, scoring, public directory, monitoring) lives at **checkmcp.dev**; this
container is the in-band enforcement point you keep in your own VPC.
