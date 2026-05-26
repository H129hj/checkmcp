"""Largeur 'cheap' : maintenance / liveness / licence / provenance via métadonnées GitHub.
Sans exécution, juste l'API publique GitHub (repo donné via --repo owner/name ou URL)."""
import json, re, time, urllib.request, urllib.error


def _parse_repo(s):
    s = s.strip()
    m = re.search(r"github\.com[/:]([^/]+)/([^/.]+)", s) or re.match(r"^([^/]+)/([^/]+)$", s)
    return (m.group(1), m.group(2)) if m else (None, None)


def fetch(repo_str, token=None):
    owner, name = _parse_repo(repo_str)
    if not owner:
        return {"error": "repo non reconnu (attendu owner/name ou URL github)"}
    h = {"Accept": "application/vnd.github+json", "User-Agent": "checkmcp"}
    if token:
        h["Authorization"] = "Bearer " + token
    try:
        r = urllib.request.urlopen(urllib.request.Request(f"https://api.github.com/repos/{owner}/{name}", headers=h), timeout=12)
        d = json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        return {"error": f"GitHub HTTP {e.code}"}
    except Exception as e:
        return {"error": str(e)[:40]}
    pushed = d.get("pushed_at")
    days = None
    if pushed:
        try:
            days = int((time.time() - time.mktime(time.strptime(pushed, "%Y-%m-%dT%H:%M:%SZ"))) / 86400)
        except Exception:
            pass
    lic = (d.get("license") or {}).get("spdx_id")
    return {"repo": f"{owner}/{name}", "pushed_days": days, "license": (None if lic in ("NOASSERTION", None) else lic),
            "archived": bool(d.get("archived")), "stars": d.get("stargazers_count", 0)}


def findings(meta):
    """Findings de maintenance/provenance (largeur)."""
    F = []
    if meta.get("error"):
        return F
    if meta.get("archived"):
        F.append({"pillar": "maintenance", "severity": "HIGH", "measured": "repo archivé",
                  "mechanism": "projet figé", "effect": "pas de correctifs/sécu à venir", "delta": 0})
    d = meta.get("pushed_days")
    if d is not None and d > 180:
        F.append({"pillar": "maintenance", "severity": "MEDIUM", "measured": f"dernier push il y a {d} j",
                  "mechanism": "maintenance faible", "effect": "risque d'abandon / drift spec", "delta": 0})
    if not meta.get("license"):
        F.append({"pillar": "provenance", "severity": "MEDIUM", "measured": "aucune licence déclarée",
                  "mechanism": "statut légal flou", "effect": "blocage adoption entreprise (OWASP MCP04)", "delta": 0})
    return F
