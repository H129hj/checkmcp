# CheckMCP — Validité de construit (ENDGAME)

Dataset : **n=18 serveurs** (DeepWiki, Chainflip, MicrosoftLearn, HuggingFace, GitMCP-servers, GitMCP-react, GitMCP-langchain, GitMCP-fastapi, Roundtable, GitMCP-vue, GitMCP-django, GitMCP-rust, GitMCP-tailwind, GitMCP-svelte, Symphony, CourseLighting, War-MCP, Drop-Pilot).  
Outcome empirique = **précision de sélection d'outil** par un LLM (un bon outil/desc → le bon outil est choisi).

> ⚠️ n petit : ces coefficients sont **indicatifs** (direction + force), pas une preuve statistique. Ils orientent les poids et détectent les piliers redondants ; la validation forte demande n≳30.

## 1. La note prédit-elle l'outcome ?

**Composite ↔ sélection : ρ = +0.61** — **corrélation positive forte** : un meilleur MCP Score va de pair avec une meilleure sélection d'outil. ✅ Signal de validité de construit (préliminaire, n modéré).

| Pilier | ρ vs outcome |
|---|---|
| security | +0.61 |
| tool_design | +0.56 |
| desc_schema | +0.48 |
| token | +0.48 |
| compliance | +0.44 |
| use_case | -0.02 |

Tokens (coût contexte) ↔ outcome : ρ = -0.53 (négatif attendu : + de tokens → sélection plus dure).

## 2. Redondance inter-piliers

Deux piliers à |ρ| très élevé mesurent en partie la même chose (candidats à fusion/repondération).

| Paire | ρ |
|---|---|
| security↔token | +0.76 |
| security↔tool_design | +0.74 |
| desc_schema↔compliance | +0.72 |
| security↔desc_schema | +0.69 |
| tool_design↔token | +0.68 |
| tool_design↔compliance | +0.61 |
| tool_design↔desc_schema | +0.55 |
| token↔compliance | +0.51 |
| security↔compliance | +0.50 |
| tool_design↔use_case | -0.36 |
| desc_schema↔token | +0.35 |
| token↔use_case | -0.17 |
| compliance↔use_case | +0.17 |
| desc_schema↔use_case | +0.13 |
| security↔use_case | -0.12 |

## 3. Les poids opèrent-ils ?

Étendue des scores composites : 36–88 (écart-type 15.8). Un écart-type non trivial confirme que la note discrimine les serveurs.

## 4. Poids — repondération empirique ?

**Repondération BLOQUÉE** : conditions de puissance non réunies (n=18, écart-type outcome=0.22, min essais=3 ; requis n≥20, σ≥0.12, essais≥12). On **conserve** les poids actuels (sécu-first, méthodologiquement défendables). Ré-estimer les poids sur ces données reviendrait à sur-apprendre du bruit.

## Verdict

- ✅ **Harnais de validité opérationnel** : probe → score → outcome LLM → corrélations/redondance/sensibilité, reproductible.
- ✅ **La note discrimine** (composite 36–88, σ15.8) — les poids opèrent.
- ✅ **Effet plafond cassé** (σ outcome 0.22) grâce au catalogue complet + tâches orientées-but + juge≠rédacteur (v2).
- ✅ **Signal de validité de construit** : composite ↔ outcome ρ=+0.61, tokens ↔ outcome ρ=-0.53 (le sprawl nuit, comme prédit).
- ⚠️ **Caveat diversité** : une partie du corpus est constituée de serveurs GitMCP quasi-identiques (même score, design templaté) → diversité de design effective < n. À diversifier.
- 🎯 **Pour un verdict fort + repondération** : n≥20 atteint? False · σ≥0.12? True · essais/serveur≥12? False (actuel min=3, plombé par les serveurs à peu d'outils). Lever le dernier verrou = + de serveurs riches en outils (≥12) et n≥20 diversifié (cibles auth'd).
