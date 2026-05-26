# Intégration MCPizy ↔ CheckMCP

MCPizy (Next.js, Supabase `marketplace_catalog`) affiche un **signal de confiance CheckMCP**
sur chaque fiche serveur. Le catalog est surtout des serveurs **stdio** (npx) → pas d'endpoint
HTTP à scorer ; mais chaque entrée a un **`github_url`** → on utilise le mode **repo** de CheckMCP
(maintenance / liveness / licence / provenance — OWASP MCP04), applicable à TOUTES les entrées.

## Câblé (dans mcpizy-staging)
- `src/lib/checkmcp.ts` — helper serveur : `repoSignal(githubUrl)` → `GET $CHECKMCP_API/api/repo?repo=` (timeout 6s, cache 6h, jamais bloquant).
- `src/components/marketplace/CheckMcpBadge.tsx` — server component async (pill licence/push/⭐/⚠).
- `src/app/marketplace/[slug]/page.tsx` — import + `<CheckMcpBadge githubUrl={mcp.github_url} />` après le `<h1>`.

## Pré-requis runtime
- API CheckMCP live sur Contabo : systemd `checkmcp-api:8799` (route `/api/repo`).
- Le conteneur mcpizy l'atteint via le gateway docker → définir l'env **`CHECKMCP_API=http://172.17.0.1:8799`** (validé joignable). Défaut déjà = cette valeur.

## Déploiement (à faire dans ta pipeline MCPizy)
1. `npm ci && npm run typecheck && npm run build` (valide les types).
2. Rebuild/redeploy le conteneur `mcpizy` avec `CHECKMCP_API` en env.
3. (optionnel) badge aussi sur la grille `category/[category]` et l'index marketplace.

## Évolutions
- Quand le catalog aura des serveurs **remote** (champ URL), utiliser `/api/score?url=` pour le MCP Score complet (pas juste repo).
- Réciprocité : MCPizy peut POSTer ses `github_url`/URLs à CheckMCP pour alimenter le corpus de calibration.
