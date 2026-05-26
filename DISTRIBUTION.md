# CheckMCP — Distribution (#6 : Badge + SEO/GEO + MCPizy)

La boucle de croissance : **badge gratuit (viral) → pages SEO/GEO (organique) → MCPizy (trust layer) → SaaS**.

## 1. Badge (viral) — FAIT
`checkmcp --badge <url>` → SVG `MCP Score: N · grade` (couleur par grade) + snippets :
```md
[![MCP Score 82 B](https://checkmcp.com/badge/<slug>.svg)](https://checkmcp.com/mcp/<slug>)
```
- **Service badge** : route `checkmcp.com/badge/<slug>.svg` (re-probe + cache 6-24h, comme shields.io). Chaque badge embarqué dans un README = backlink + pub.
- Module : `checkmcp/badge.py` (`badge_svg`, `embed_snippets`).

## 2. SEO/GEO — 1 page par serveur — FAIT (générateur)
`checkmcp --html <url>` → page autonome : `<title> <server> — MCP Score N/grade</title>` + **JSON-LD `SoftwareApplication`(aggregateRating) + `FAQPage`** (FAQ auto : "Quel est le MCP Score de X ?", "X est-il safe ?", "combien d'outils ?", "coût contexte ?") + canonical + meta.
- Module : `checkmcp/page.py`.
- **Hébergement** : `checkmcp.com` en **Next.js App Router + aeo-kit** (`/Users/hugob/Dev/shared/aeo-kit`) :
  - `/mcp/[slug]/page.tsx` ← template `entity-page` de l'aeo-kit (réutilise `StructuredData.tsx` : SoftwareApplication + FAQ + Breadcrumb).
  - `/mcp/page.tsx` ← index annuaire (template `index-page`), trié par score.
  - dataset = sorties JSON du probe (`--json`) → `lib/public-mcps.ts`.
  - → **milliers de pages indexables** ("[serveur] MCP review / uptime / is it safe"), le pattern qui a sorti Brandyze position 1.

## 3. MCPizy — couche de confiance (intégration, à wirer)
MCPizy (`mcpizy.com`, Node, `/home/ubuntu/mcpizy-staging`) = annuaire MCP. CheckMCP = son **trust signal**.
**Contrat d'intégration (2 voies, non-intrusives) :**
- **Badge embed** : chaque listing MCPizy affiche `<img src="checkmcp.com/badge/<slug>.svg">` → score live, zéro couplage.
- **Score feed (API)** : `GET checkmcp.com/api/score/<slug>` → `{score, grade, pillars, updated_at}` que MCPizy lit pour ranker/filtrer ("trier par MCP Score", "verified ✅").
- **Réciprocité** : MCPizy fournit à CheckMCP la liste des endpoints à probe (alimente le corpus + l'annuaire). Boucle fermée MCPizy↔CheckMCP.
- *Implémentation* : ajouter un composant `<McpScoreBadge slug=.../>` dans le front MCPizy + un cron qui probe les listings. Tâche séparée sur `mcpizy-staging` (Node) — à faire quand l'API CheckMCP est en ligne.

## Déploiement (ordre)
1. Héberger l'API CheckMCP (probe+score) sur Contabo (réutilise Sympho/infra) → expose `/badge/<slug>.svg`, `/api/score/<slug>`, `/mcp/<slug>`.
2. Front Next.js checkmcp.com (Vercel) via aeo-kit → pages + annuaire.
3. Brancher MCPizy (badge + feed).
