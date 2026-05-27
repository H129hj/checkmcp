# CheckMCP — Validité de construit (ENDGAME)

Dataset : **n=6 serveurs** (Symphony, CourseLighting, War-MCP, Drop-Pilot, DeepWiki, Chainflip).  
Outcome empirique = **précision de sélection d'outil** par un LLM (un bon outil/desc → le bon outil est choisi).

> ⚠️ n petit : ces coefficients sont **indicatifs** (direction + force), pas une preuve statistique. Ils orientent les poids et détectent les piliers redondants ; la validation forte demande n≳30.

> 🛑 **Effet plafond détecté** : écart-type de l'outcome = 0.10 (< 0.12), min essais/serveur = 3. La sélection d'outil est ici trop facile (catalogue plafonné à 60, tâches rédigées depuis la description → appariement quasi-trivial) pour discriminer les serveurs. **Les corrélations ci-dessous sont donc dominées par le bruit — à interpréter comme un test du harnais, pas un verdict sur la note.**

## 1. La note prédit-elle l'outcome ?

**Composite ↔ sélection : ρ = +0.06** — non concluant à ce stade (voir garde-fous ci-dessus).

| Pilier | ρ vs outcome |
|---|---|
| security | +0.07 |
| tool_design | -0.13 |
| desc_schema | -0.66 |
| token | -0.01 |
| compliance | -0.66 |
| use_case | -0.79 |

Tokens (coût contexte) ↔ outcome : ρ = +0.03 (négatif attendu : + de tokens → sélection plus dure).

## 2. Redondance inter-piliers

Deux piliers à |ρ| très élevé mesurent en partie la même chose (candidats à fusion/repondération).

| Paire | ρ |
|---|---|
| desc_schema↔compliance | +1.00 ⚠️ redondance |
| tool_design↔token | +0.85 ⚠️ redondance |
| security↔token | +0.82 ⚠️ redondance |
| security↔tool_design | +0.76 |
| tool_design↔desc_schema | +0.54 |
| tool_design↔compliance | +0.54 |
| tool_design↔use_case | +0.47 |
| desc_schema↔use_case | +0.46 |
| compliance↔use_case | +0.46 |
| security↔use_case | +0.45 |
| token↔use_case | +0.45 |
| security↔desc_schema | +0.13 |
| security↔compliance | +0.13 |
| desc_schema↔token | +0.13 |
| token↔compliance | +0.13 |

## 3. Les poids opèrent-ils ?

Étendue des scores composites : 36–81 (écart-type 16.6). Un écart-type non trivial confirme que la note discrimine les serveurs.

## 4. Poids — repondération empirique ?

**Repondération BLOQUÉE** : conditions de puissance non réunies (n=6, écart-type outcome=0.10, min essais=3 ; requis n≥20, σ≥0.12, essais≥12). On **conserve** les poids actuels (sécu-first, méthodologiquement défendables). Ré-estimer les poids sur ces données reviendrait à sur-apprendre du bruit.

## Verdict

- ✅ **Harnais de validité opérationnel** : probe → score → outcome LLM → corrélations/redondance/sensibilité, reproductible.
- ✅ **La note discrimine** (composite 36–81, σ16.6) — les poids opèrent.
- 🛑 **Outcome actuel non discriminant** (effet plafond) → ne valide ni n'invalide la note. Conclusion bloquée à dessein.
- 🎯 **Prochaine itération pour un vrai verdict** : (a) n≳30 serveurs (élargir hors flotte) ; (b) catalogue COMPLET (pas de cap 60) pour tester réellement le sprawl ; (c) outcome plus dur et à variance (complétion multi-tours, distracteurs adverses, tâches non dérivées de la description) ; (d) modèle juge ≠ modèle rédacteur des tâches (casser la circularité).
