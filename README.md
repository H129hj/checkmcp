# checkmcp

**Audit & score qualité / sécurité / context-cost, vendor-neutral, pour n'importe quel serveur MCP.**
Un `npx`/`uvx` → un **MCP Score /100** + des **opportunités causales** (pourquoi la note), façon Lighthouse.

```bash
uvx checkmcp https://mcp.deepwiki.com/mcp
# ou
pipx run checkmcp https://mcp.context7.com/mcp --json
checkmcp https://my-mcp.example.com/mcp --token "$TOKEN"
```

## Ce qu'il mesure (v0.1 — bloc NOW)
- **Tool Design** — sprawl/consolidation (bandes percentile-calibrées sur 177 serveurs réels : médiane 7 outils, p95 42).
- **Desc/Schema** — descriptions + complétude des `inputSchema` + `outputSchema`.
- **Token/Context** — coût en tokens du `tools/list` (le poste de coût payé à chaque requête) — *le wedge : personne d'autre ne le score*.
- **Sécurité** — destructifs sans confirmation, secrets en schéma, surface d'injection (heuristique v0.1 ; profondeur Snyk/OWASP à venir).
- **Compliance** — version protocole, conformance JSON-RPC, annotations.
- **Use-Case** — couverture des 3 primitives (tools **+ resources + prompts**).
- **Fiabilité** — latence T1 (non créditée au score : nécessite monitoring T3 ≥24h).

## Attribution causale
Chaque point perdu est tracé : `mesure → mécanisme → effet → Δ-impact`, trié par impact (modèle "Opportunities" de Lighthouse). On vend les **faits**, pas une note sur-vendue.

## Honnêteté (limites assumées)
- Bandes = percentiles d'un corpus n=177 (1 registre) → à élargir.
- Tokens exacts avec `pip install checkmcp[exact-tokens]` (cl100k_base) ; sinon approx chars/4.
- Sécurité = heuristique (regex) ; la profondeur (tool-poisoning, rug-pull, exfiltration) viendra via intégration Snyk/mcp-scan + OWASP MCP Top 10.
- Les **poids** ne sont pas encore validés contre un benchmark de succès agent (validité de construit = roadmap endgame).

MIT.
