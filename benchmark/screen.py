"""Pré-screening des cibles du benchmark : ne garde que les serveurs MCP joignables et exploitables.

Lit une liste de candidats (benchmark/candidates.txt : une URL par ligne, ou "Nom = URL"),
probe chacun, et écrit targets.json avec ceux qui répondent ET exposent ≥3 outils décrits
(seuil minimal pour mesurer une sélection d'outil). Rapport en console.

Note egress : certains serveurs publics sont bloqués depuis une IP datacenter (VPS) mais joignables
depuis un réseau résidentiel (Mac), et inversement pour la flotte localhost. Lancer le screen depuis
le réseau qui sera utilisé pour le run.
"""
import json, os, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from checkmcp.probe import probe

MIN_DESCRIBED = 3


def _parse(line):
    line = line.strip()
    if not line or line.startswith("#"):
        return None
    if "=" in line and not line.split("=", 1)[1].strip().startswith("//"):
        name, url = line.split("=", 1)
        return name.strip(), url.strip()
    url = line
    host = url.split("//", 1)[-1].split("/")[0]
    return host, url


def screen(candidates):
    keep, drop = [], []
    for name, url in candidates:
        p = probe(url)
        if p.get("error"):
            drop.append((name, url, p["error"])); print(f"  ✗ {name:24} {p['error']}", flush=True); continue
        tools = p.get("tools", [])
        described = [t for t in tools if len((t.get("description") or "").strip()) >= 15]
        if len(described) < MIN_DESCRIBED:
            drop.append((name, url, f"{len(described)} outils décrits (<{MIN_DESCRIBED})"))
            print(f"  ✗ {name:24} {len(tools)} outils, {len(described)} décrits", flush=True); continue
        keep.append({"name": name, "url": url})
        print(f"  ✓ {name:24} {len(tools)} outils ({len(described)} décrits)", flush=True)
    return keep, drop


def main():
    here = os.path.dirname(os.path.abspath(__file__))
    cand_path = sys.argv[1] if len(sys.argv) > 1 else os.path.join(here, "candidates.txt")
    out_path = sys.argv[2] if len(sys.argv) > 2 else os.path.join(here, "targets.json")
    candidates = [c for c in (_parse(l) for l in open(cand_path)) if c]
    print(f"[screen] {len(candidates)} candidats…", flush=True)
    keep, drop = screen(candidates)
    json.dump(keep, open(out_path, "w"), ensure_ascii=False, indent=2)
    print(f"\n[screen] retenus {len(keep)}/{len(candidates)} → {out_path}")
    print(f"[screen] objectif n≥30 : {'ATTEINT' if len(keep) >= 30 else f'manque {30-len(keep)}'}")


if __name__ == "__main__":
    main()
