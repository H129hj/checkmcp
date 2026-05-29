# CheckMCP — Validité de construit (ENDGAME)

Dataset : **n=24 serveurs** (DeepWiki, Chainflip, MicrosoftLearn, HuggingFace, GitMCP-servers, GitMCP-react, GitMCP-langchain, GitMCP-fastapi, Roundtable, GitMCP-vue, GitMCP-django, GitMCP-rust, GitMCP-tailwind, GitMCP-svelte, Symphony, CourseLighting, War-MCP, Drop-Pilot, oss-memory, oss-filesystem, oss-everything, oss-git, oss-sqlite, oss-tavily).  
Outcome empirique = **précision de sélection d'outil** par un LLM (un bon outil/desc → le bon outil est choisi).

> ⚠️ n petit : ces coefficients sont **indicatifs** (direction + force), pas une preuve statistique. Ils orientent les poids et détectent les piliers redondants ; la validation forte demande n≳30.

## 1. La note prédit-elle l'outcome ?

**Composite ↔ sélection : ρ = +0.51** — **corrélation positive forte** : un meilleur MCP Score va de pair avec une meilleure sélection d'outil. ✅ Signal de validité de construit (préliminaire, n modéré).

| Pilier | ρ vs outcome |
|---|---|
| security | +0.51 |
| tool_design | +0.43 |
| desc_schema | +0.37 |
| token | +0.39 |
| compliance | +0.25 |
| use_case | +0.07 |

Tokens (coût contexte) ↔ outcome : ρ = -0.51 (négatif attendu : + de tokens → sélection plus dure).

## 2. Redondance inter-piliers

Deux piliers à |ρ| très élevé mesurent en partie la même chose (candidats à fusion/repondération).

| Paire | ρ |
|---|---|
| security↔tool_design | +0.68 |
| tool_design↔desc_schema | +0.67 |
| security↔desc_schema | +0.63 |
| security↔token | +0.58 |
| tool_design↔token | +0.50 |
| tool_design↔use_case | -0.46 |
| desc_schema↔compliance | +0.36 |
| security↔compliance | +0.34 |
| tool_design↔compliance | +0.30 |
| desc_schema↔use_case | -0.22 |
| token↔compliance | +0.20 |
| compliance↔use_case | +0.19 |
| desc_schema↔token | +0.13 |
| security↔use_case | -0.11 |
| token↔use_case | +0.08 |

## 3. Les poids opèrent-ils ?

Étendue des scores composites : 36–88 (écart-type 14.0). Un écart-type non trivial confirme que la note discrimine les serveurs.

## 4. Poids — repondération empirique ?

**Repondération BLOQUÉE** : conditions de puissance non réunies (n=24, écart-type outcome=0.21, min essais=3 ; requis n≥20, σ≥0.12, essais≥12). On **conserve** les poids actuels (sécu-first, méthodologiquement défendables). Ré-estimer les poids sur ces données reviendrait à sur-apprendre du bruit.

## Verdict

- ✅ **Harnais de validité opérationnel** : probe → score → outcome LLM → corrélations/redondance/sensibilité, reproductible.
- ✅ **La note discrimine** (composite 36–88, σ14.0) — les poids opèrent.
- ✅ **Effet plafond cassé** (σ outcome 0.21) grâce au catalogue complet + tâches orientées-but + juge≠rédacteur (v2).
- ✅ **Signal de validité de construit** : composite ↔ outcome ρ=+0.51, tokens ↔ outcome ρ=-0.51 (le sprawl nuit, comme prédit).
- ⚠️ **Caveat diversité** : une partie du corpus est constituée de serveurs GitMCP quasi-identiques (même score, design templaté) → diversité de design effective < n. À diversifier.
- 🎯 **Pour un verdict fort + repondération** : n≥20 atteint? True · σ≥0.12? True · essais/serveur≥12? False (actuel min=3, plombé par les serveurs à peu d'outils). Lever le dernier verrou = + de serveurs riches en outils (≥12) et n≥20 diversifié (cibles auth'd).


---

# Sous-analyse : corpus diversifié (sans clones)

Clones détectés (1 groupes de profils piliers identiques, ex : GitMCP-servers, GitMCP-react, GitMCP-langchain…). En les déduplicant à 1 représentant par groupe → **n_diverse = 20**. C'est l'analyse la plus honnête pour la validité de construit (les clones ajoutent du bruit à score constant).

# CheckMCP — Validité de construit (ENDGAME)

Dataset : **n=16 serveurs** (DeepWiki, Chainflip, MicrosoftLearn, HuggingFace, GitMCP-servers, Roundtable, Symphony, CourseLighting, War-MCP, Drop-Pilot, oss-memory, oss-filesystem, oss-everything, oss-git, oss-sqlite, oss-tavily).  
Outcome empirique = **précision de sélection d'outil** par un LLM (un bon outil/desc → le bon outil est choisi).

> ⚠️ n petit : ces coefficients sont **indicatifs** (direction + force), pas une preuve statistique. Ils orientent les poids et détectent les piliers redondants ; la validation forte demande n≳30.

## 1. La note prédit-elle l'outcome ?

**Composite ↔ sélection : ρ = +0.65** — **corrélation positive forte** : un meilleur MCP Score va de pair avec une meilleure sélection d'outil. ✅ Signal de validité de construit (préliminaire, n modéré).

| Pilier | ρ vs outcome |
|---|---|
| security | +0.60 |
| tool_design | +0.45 |
| desc_schema | +0.38 |
| token | +0.50 |
| compliance | +0.27 |
| use_case | +0.31 |

Tokens (coût contexte) ↔ outcome : ρ = -0.54 (négatif attendu : + de tokens → sélection plus dure).

## 2. Redondance inter-piliers

Deux piliers à |ρ| très élevé mesurent en partie la même chose (candidats à fusion/repondération).

| Paire | ρ |
|---|---|
| security↔tool_design | +0.64 |
| security↔token | +0.62 |
| tool_design↔desc_schema | +0.62 |
| tool_design↔token | +0.60 |
| security↔desc_schema | +0.52 |
| compliance↔use_case | +0.37 |
| desc_schema↔compliance | +0.33 |
| security↔compliance | +0.32 |
| tool_design↔compliance | +0.27 |
| security↔use_case | +0.24 |
| token↔use_case | +0.23 |
| token↔compliance | +0.17 |
| tool_design↔use_case | -0.14 |
| desc_schema↔token | +0.01 |
| desc_schema↔use_case | +0.01 |

## 3. Les poids opèrent-ils ?

Étendue des scores composites : 36–88 (écart-type 15.7). Un écart-type non trivial confirme que la note discrimine les serveurs.

## 4. Poids — repondération empirique ?

**Repondération BLOQUÉE** : conditions de puissance non réunies (n=16, écart-type outcome=0.19, min essais=3 ; requis n≥20, σ≥0.12, essais≥12). On **conserve** les poids actuels (sécu-first, méthodologiquement défendables). Ré-estimer les poids sur ces données reviendrait à sur-apprendre du bruit.

## Verdict

- ✅ **Harnais de validité opérationnel** : probe → score → outcome LLM → corrélations/redondance/sensibilité, reproductible.
- ✅ **La note discrimine** (composite 36–88, σ15.7) — les poids opèrent.
- ✅ **Effet plafond cassé** (σ outcome 0.19) grâce au catalogue complet + tâches orientées-but + juge≠rédacteur (v2).
- ✅ **Signal de validité de construit** : composite ↔ outcome ρ=+0.65, tokens ↔ outcome ρ=-0.54 (le sprawl nuit, comme prédit).
- ⚠️ **Caveat diversité** : une partie du corpus est constituée de serveurs GitMCP quasi-identiques (même score, design templaté) → diversité de design effective < n. À diversifier.
- 🎯 **Pour un verdict fort + repondération** : n≥20 atteint? False · σ≥0.12? True · essais/serveur≥12? False (actuel min=3, plombé par les serveurs à peu d'outils). Lever le dernier verrou = + de serveurs riches en outils (≥12) et n≥20 diversifié (cibles auth'd).
