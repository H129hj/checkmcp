"""ENDGAME — mesure d'un OUTCOME empirique par serveur : la précision de sélection d'outil.

Hypothèse que CheckMCP prétend valider : un bon design d'outils + des descriptions/schémas clairs
=> un agent sélectionne le bon outil plus fiablement. On le MESURE :
  1. pour un échantillon d'outils, on fait rédiger par un LLM une requête utilisateur naturelle
     (sans recopier le nom de l'outil) qui devrait déclencher cet outil ;
  2. on présente la requête + le catalogue d'outils (nom+description) à un LLM et on lui demande
     QUEL outil appeler ; correct si c'est l'outil cible.
Accuracy = outcome. On le corrèle ensuite (validate.py) aux scores CheckMCP.

LLM via API OpenAI-compatible (Groq par défaut, gratuit/rapide). Zéro dépendance (urllib).
Env : CHECKMCP_LLM_KEY (requis), CHECKMCP_LLM_BASE, CHECKMCP_LLM_MODEL.
"""
import json, os, sys, time, random, urllib.request, urllib.error

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from checkmcp.probe import probe
from checkmcp.score import score

BASE = os.environ.get("CHECKMCP_LLM_BASE", "https://api.groq.com/openai/v1")
KEY = os.environ.get("CHECKMCP_LLM_KEY", "")
MODEL = os.environ.get("CHECKMCP_LLM_MODEL", "llama-3.3-70b-versatile")
MAX_CANDIDATES = 60   # borne le catalogue présenté (équité inter-serveurs + limites de contexte)
MAX_TRIALS = 18       # outils échantillonnés par serveur


def _chat(messages, temperature=0.0, max_tokens=400):
    body = json.dumps({"model": MODEL, "messages": messages,
                       "temperature": temperature, "max_tokens": max_tokens}).encode()
    req = urllib.request.Request(BASE.rstrip("/") + "/chat/completions", data=body,
                                 headers={"Authorization": f"Bearer {KEY}", "Content-Type": "application/json"})
    for attempt in range(3):
        try:
            r = urllib.request.urlopen(req, timeout=60)
            return json.loads(r.read().decode())["choices"][0]["message"]["content"].strip()
        except urllib.error.HTTPError as e:
            if e.code == 429:
                time.sleep(3 * (attempt + 1)); continue
            return None
        except Exception:
            time.sleep(1); continue
    return None


def _usable_tools(tools):
    return [t for t in tools if (t.get("description") or "").strip() and len((t.get("description") or "")) >= 15]


def _author_task(tool):
    msg = [{"role": "system", "content": "Tu génères une requête utilisateur réaliste en une phrase qui devrait "
            "déclencher l'outil décrit, SANS jamais citer le nom technique de l'outil ni ses paramètres. "
            "Réponds uniquement par la requête utilisateur."},
           {"role": "user", "content": f"Outil: {tool['name']}\nDescription: {tool.get('description','')}\n\nRequête utilisateur:"}]
    return _chat(msg, temperature=0.8, max_tokens=120)


def _catalog(tools, target, k):
    others = [t for t in tools if t["name"] != target["name"]]
    random.shuffle(others)
    chosen = [target] + others[:k - 1]
    random.shuffle(chosen)
    lines = [f"- {t['name']}: {(t.get('description') or '')[:160]}" for t in chosen]
    return "\n".join(lines)


def _select(task, catalog):
    msg = [{"role": "system", "content": "Tu es un agent qui choisit l'outil à appeler. On te donne une requête "
            "utilisateur et un catalogue d'outils (nom: description). Réponds UNIQUEMENT par le nom exact d'un "
            "seul outil du catalogue, ou 'NONE' si aucun ne convient. Pas d'explication."},
           {"role": "user", "content": f"Requête: {task}\n\nCatalogue:\n{catalog}\n\nNom de l'outil:"}]
    out = _chat(msg, temperature=0.0, max_tokens=40)
    return out.strip().strip("`\"' ").split()[0] if out else None


def measure_server(name, url, token=None, max_trials=MAX_TRIALS, seed=42):
    random.seed(seed)
    p = probe(url, token) if token else probe(url)
    if p.get("error"):
        return {"name": name, "url": url, "error": p["error"]}
    r = score(p)
    tools = _usable_tools(p.get("tools", []))
    if len(tools) < 3:
        return {"name": name, "url": url, "error": f"trop peu d'outils décrits ({len(tools)})"}
    sample = random.sample(tools, min(max_trials, len(tools)))
    k = min(MAX_CANDIDATES, len(tools))
    correct = total = 0
    for t in sample:
        task = _author_task(t)
        if not task:
            continue
        pick = _select(task, _catalog(tools, t, k))
        if pick is None:
            continue
        total += 1
        if pick == t["name"]:
            correct += 1
    acc = correct / total if total else None
    return {"name": name, "url": url, "n_tools": len(p.get("tools", [])),
            "candidate_set": k, "trials": total, "selection_accuracy": acc,
            "score": r["score"], "grade": r["grade"], "pillars": r["pillars"],
            "tokens": r["facts"]["tools_list_tokens"]}


def run(targets, out_path):
    rows = []
    for name, url, token in targets:
        print(f"[outcome] {name} …", flush=True)
        row = measure_server(name, url, token)
        if "error" in row:
            print(f"   skip: {row['error']}", flush=True)
        else:
            print(f"   acc={row['selection_accuracy']} ({row['trials']} essais) · score={row['score']} · {row['n_tools']} outils", flush=True)
        rows.append(row)
    json.dump(rows, open(out_path, "w"), ensure_ascii=False, indent=2)
    print(f"[outcome] dataset → {out_path}", flush=True)
    return rows


if __name__ == "__main__":
    if not KEY:
        print("CHECKMCP_LLM_KEY manquant", file=sys.stderr); sys.exit(1)
    DP = os.environ.get("DROP_PILOT_MCP_TOKEN")
    TARGETS = [
        ("Symphony", "http://localhost:8787/mcp", None),
        ("CourseLighting", "http://localhost:8790/mcp", None),
        ("War-MCP", "http://localhost:8888/mcp", None),
        ("Drop-Pilot", "http://localhost:8765/mcp", DP),
        ("DeepWiki", "https://mcp.deepwiki.com/mcp", None),
        ("Context7", "https://mcp.context7.com/mcp", None),
        ("Chainflip", "https://chainflip-broker.io/mcp", None),
    ]
    run(TARGETS, os.environ.get("CHECKMCP_OUTCOME_OUT", "/tmp/outcomes.json"))
