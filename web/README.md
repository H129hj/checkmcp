# CheckMCP — dashboard (Next.js + Supabase Auth)

Front du SaaS CheckMCP : login (lien magique Supabase) → mes monitors → ajouter une URL MCP → score & drift.

## Stack
- Next.js 14 (App Router) + `@supabase/ssr` (auth par cookies, RLS).
- Données : tables `checkmcp_monitors` / `checkmcp_baselines` / `checkmcp_runs` (projet Supabase brandyze, RLS par `user_id`).
- Moteur : l'API CheckMCP (Contabo) probe/score/épingle ; le runner (timer 30min) écrit les runs.

## Lancer en local
```bash
cp .env.example .env.local   # remplir si besoin (URL + anon key déjà préremplis)
npm install
npm run dev                  # http://localhost:3000
```

## Déployer (Vercel)
1. Importer le repo, root = `web/`.
2. Env vars : `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `CHECKMCP_API` (https://checkmcp.kezify.com une fois le DNS posé).
3. Dans Supabase → Auth → URL Configuration : ajouter le domaine Vercel en **Redirect URL** (`https://…/auth/callback`).

## Flux
- `/login` → `signInWithOtp` → email → `/auth/callback` (exchange) → `/dashboard`.
- `/dashboard` (protégé par `middleware.ts`) liste `checkmcp_monitors` du user (RLS) + dernier `checkmcp_runs`.
- `addMonitor` (server action) : upsert le monitor + appelle l'API CheckMCP pour épingler la baseline.

## ⚠️ À durcir avant prod
- **Auth de l'API CheckMCP** : la route `/api/monitor?user_id=` accepte un user_id en clair (MVP). En prod, l'API doit **vérifier le JWT Supabase** (header Authorization) au lieu de faire confiance au query param.
- Rotation des clés, rate-limit, plans Stripe (free/pro/team) à brancher.
