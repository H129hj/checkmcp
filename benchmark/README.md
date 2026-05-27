# CheckMCP — Benchmark de validité (ENDGAME)

Chaîne pour passer d'un indice méthodologiquement solide à un score **causalement validé**.

## `outcomes.py` — mesure d'un outcome empirique
Pour chaque serveur : échantillonne des outils, fait rédiger par un LLM une requête utilisateur
naturelle (sans citer le nom de l'outil), puis demande à un LLM de choisir l'outil dans le catalogue.
**Accuracy de sélection = outcome.**

```bash
CHECKMCP_LLM_BASE=https://generativelanguage.googleapis.com/v1beta/openai \
CHECKMCP_LLM_KEY=<clé> CHECKMCP_LLM_MODEL=gemini-2.5-flash-lite \
python3 benchmark/outcomes.py   # → dataset JSON
```
Compatible tout endpoint OpenAI-like (Groq, OpenRouter, Gemini OpenAI-compat…).

## `validate.py` — validité de construit
Corrélations Spearman composite/piliers ↔ outcome, redondance inter-piliers, sensibilité,
repondération empirique **gardée par des seuils de puissance** (n≥20, σ≥0.12, essais≥12) — sinon BLOQUÉE.

```bash
python3 benchmark/validate.py <dataset.json>   # → VALIDITY.md
```

## Pilote 2026-05-27 (`outcomes-2026-05-27.json`)
n=6. **Effet plafond** (l'outcome ne discrimine pas encore) → repondération bloquée à dessein.
Le harnais est opérationnel ; le verdict attend n≳30, catalogue complet, outcome à variance.
Voir `../VALIDITY.md`.
