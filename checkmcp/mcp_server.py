"""Mode serveur MCP — expose l'audit CheckMCP comme un tool MCP (stdio, JSON-RPC 2.0).

`checkmcp mcp` (ou `checkmcp-mcp`) démarre un serveur MCP stdio qu'un agent
(Claude Code, Claude Desktop, Cursor…) peut brancher pour auditer un serveur MCP
en pleine conversation : « est-ce que ce serveur est safe ? » → tool call.

Transport stdio MCP : un message JSON-RPC par ligne sur stdout ; stderr pour les logs.
Stdlib uniquement, comme le reste du moteur.
"""
import json
import sys

from . import __version__

PROTOCOL_VERSIONS = ("2025-06-18", "2025-03-26", "2024-11-05")

TOOL = {
    "name": "audit_mcp_server",
    "title": "Audit an MCP server (MCP Score)",
    "description": (
        "Audit a remote MCP server and return its MCP Score (0-100, grade A-F) with the findings that "
        "explain it. Probes the live endpoint (streamable-http or SSE), runs an OWASP MCP Top 10 security "
        "pass (tool poisoning, hardcoded secrets in schemas, command injection, the lethal trifecta) plus "
        "tool-design, schema, reliability, context-cost and compliance checks. Read-only: it never invokes "
        "the target's tools. Call this when the user asks whether an MCP server is safe or well built, "
        "before recommending or adding a server to a client config, or to compare two servers (call once "
        "per server)."
    ),
    "inputSchema": {
        "type": "object",
        "properties": {
            "url": {
                "type": "string",
                "description": "The MCP endpoint URL to audit, e.g. https://mcp.example.com/mcp",
            },
            "token": {
                "type": "string",
                "description": "Optional Bearer token if the target server requires authentication.",
            },
        },
        "required": ["url"],
        "additionalProperties": False,
    },
    "annotations": {
        "readOnlyHint": True,
        "destructiveHint": False,
        "idempotentHint": True,
        "openWorldHint": True,
    },
}

_PILL = {"security": "Security", "tool_design": "Tool design", "desc_schema": "Schemas/descriptions",
         "reliability": "Reliability", "token": "Context-cost", "compliance": "Compliance",
         "use_case": "Coverage"}


def _run_audit(url, token=None):
    """Probe + score en process ; retourne (markdown, is_error)."""
    from .probe import probe
    from .score import score

    p = probe(url, token=token)
    if p.get("error"):
        return f"Audit failed for {url}: {p['error']}", True
    res = score(p)

    lines = [f"# MCP Score: {res['score']}/100 (grade {res['grade']}) — {url}"]
    if res.get("floor"):
        lines.append(f"**FLOOR applied: {res['floor']}** (hard cap — see findings)")
    fa = res.get("facts", {})
    lines.append(f"Protocol {fa.get('proto', '?')} · {fa.get('tools', '?')} tools · "
                 f"{fa.get('resources', '?')} resources · {fa.get('prompts', '?')} prompts · "
                 f"~{fa.get('tools_list_tokens', '?')} context tokens")
    lines.append("")
    lines.append("## Pillars")
    for k, label in _PILL.items():
        v = res.get("pillars", {}).get(k)
        if v is not None:
            lines.append(f"- {label}: {v}/100")
    findings = res.get("findings", [])
    lines.append("")
    if findings:
        lines.append(f"## Top findings ({len(findings)} total, sorted by causal impact)")
        for f in findings[:8]:
            lines.append(f"- [{f['severity']} Δ{f['delta']}] {f['measured']} — {f['mechanism']} → {f['effect']}")
        if len(findings) > 8:
            lines.append(f"- … {len(findings) - 8} more")
    else:
        lines.append("## Findings\n- none — clean audit")
    lines.append("")
    lines.append(f"Full methodology & directory: https://checkmcp.dev (CLI: `uvx checkmcp {url}`)")
    return "\n".join(lines), False


def _handle(msg):
    """Traite une requête ; retourne le dict réponse (ou None pour une notification)."""
    method = msg.get("method")
    mid = msg.get("id")
    is_notification = mid is None

    if method == "initialize":
        req = (msg.get("params") or {}).get("protocolVersion")
        proto = req if req in PROTOCOL_VERSIONS else PROTOCOL_VERSIONS[0]
        return {"jsonrpc": "2.0", "id": mid, "result": {
            "protocolVersion": proto,
            "capabilities": {"tools": {}},
            "serverInfo": {"name": "checkmcp", "title": "CheckMCP — MCP server auditor",
                           "version": __version__},
            "instructions": ("Use audit_mcp_server to score any remote MCP server for security and "
                             "quality before trusting it. One call per server; results are safe to "
                             "share with the user verbatim."),
        }}
    if method in ("notifications/initialized", "notifications/cancelled"):
        return None
    if method == "ping":
        return {"jsonrpc": "2.0", "id": mid, "result": {}}
    if method == "tools/list":
        return {"jsonrpc": "2.0", "id": mid, "result": {"tools": [TOOL]}}
    if method == "tools/call":
        params = msg.get("params") or {}
        name = params.get("name")
        args = params.get("arguments") or {}
        if name != TOOL["name"]:
            return {"jsonrpc": "2.0", "id": mid,
                    "error": {"code": -32602, "message": f"Unknown tool: {name}"}}
        url = args.get("url")
        if not isinstance(url, str) or not url.strip():
            return {"jsonrpc": "2.0", "id": mid, "result": {
                "content": [{"type": "text", "text": "Missing required argument: url"}],
                "isError": True}}
        try:
            text, is_err = _run_audit(url.strip(), token=args.get("token"))
        except Exception as e:  # jamais crasher la session pour un audit raté
            text, is_err = f"Audit failed for {url}: {e}", True
        return {"jsonrpc": "2.0", "id": mid, "result": {
            "content": [{"type": "text", "text": text}], "isError": is_err}}
    if is_notification:
        return None
    return {"jsonrpc": "2.0", "id": mid,
            "error": {"code": -32601, "message": f"Method not found: {method}"}}


def serve(inp=None, out=None):
    """Boucle stdio : une ligne JSON par message. Retourne le code de sortie."""
    inp = inp or sys.stdin
    out = out or sys.stdout
    for line in inp:
        line = line.strip()
        if not line:
            continue
        try:
            msg = json.loads(line)
        except ValueError:
            out.write(json.dumps({"jsonrpc": "2.0", "id": None,
                                  "error": {"code": -32700, "message": "Parse error"}}) + "\n")
            out.flush()
            continue
        resp = _handle(msg)
        if resp is not None:
            out.write(json.dumps(resp, ensure_ascii=False) + "\n")
            out.flush()
    return 0


def main(argv=None):
    print(f"checkmcp mcp server v{__version__} — stdio, tool: audit_mcp_server", file=sys.stderr)
    return serve()


if __name__ == "__main__":
    raise SystemExit(main())
