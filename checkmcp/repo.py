"""Repo-Quality Score (/100) pour les serveurs MCP distribués en repo/stdio (npx, GitHub).
Sans exécution : métadonnées publiques GitHub (1 appel). Complète le MCP Score live (qui exige un endpoint distant).
Piliers : maintenance 40 · licence 25 · adoption 20 · documentation 15. Floor : repo archived → cap D."""
import json, re, time, urllib.request, urllib.error

PERMISSIVE = {"MIT", "APACHE-2.0", "BSD-2-CLAUSE", "BSD-3-CLAUSE", "ISC", "MPL-2.0", "UNLICENSE", "0BSD"}
COPYLEFT = {"GPL-2.0", "GPL-3.0", "AGPL-3.0", "LGPL-2.1", "LGPL-3.0"}
WEIGHTS = {"maintenance": 40, "license": 25, "adoption": 20, "documentation": 15}


def _parse_repo(s):
    s = s.strip()
    m = re.search(r"github\.com[/:]([^/]+)/([^/.#?]+)", s) or re.match(r"^([^/]+)/([^/]+)$", s)
    return (m.group(1), m.group(2)) if m else (None, None)


def _days_since(ts):
    if not ts:
        return None
    try:
        return int((time.time() - time.mktime(time.strptime(ts, "%Y-%m-%dT%H:%M:%SZ"))) / 86400)
    except Exception:
        return None


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
    lic = (d.get("license") or {}).get("spdx_id")
    return {
        "repo": f"{owner}/{name}",
        "name": d.get("name") or name,
        "description": d.get("description"),
        "homepage": d.get("homepage") or None,
        "pushed_days": _days_since(d.get("pushed_at")),
        "created_days": _days_since(d.get("created_at")),
        "license": (None if lic in ("NOASSERTION", None) else lic),
        "archived": bool(d.get("archived")),
        "stars": d.get("stargazers_count", 0),
        "forks": d.get("forks_count", 0),
        "open_issues": d.get("open_issues_count", 0),
        "topics": d.get("topics") or [],
    }


def _band(score):
    return "A" if score >= 90 else "B" if score >= 80 else "C" if score >= 70 else "D" if score >= 55 else "F"


def score_repo(meta):
    """meta = sortie de fetch(). Renvoie un score /100 explicable + findings."""
    if meta.get("error"):
        return meta
    p = {}
    F = []

    # --- maintenance /40 ---
    if meta.get("archived"):
        p["maintenance"] = 0
        F.append({"pillar": "maintenance", "severity": "HIGH", "measured": "repo archived",
                  "mechanism": "frozen project", "effect": "no fixes/security updates coming", "delta": 40})
    else:
        d = meta.get("pushed_days")
        if d is None:
            p["maintenance"] = 22
        elif d <= 30:
            p["maintenance"] = 40
        elif d <= 90:
            p["maintenance"] = 34
        elif d <= 180:
            p["maintenance"] = 26
        elif d <= 365:
            p["maintenance"] = 16
        else:
            p["maintenance"] = 6
        if d is not None and d > 180:
            F.append({"pillar": "maintenance", "severity": "MEDIUM", "measured": f"last push {d}d ago",
                      "mechanism": "weak maintenance", "effect": "abandonment risk / spec drift", "delta": WEIGHTS["maintenance"] - p["maintenance"]})

    # --- licence /25 ---
    lic = (meta.get("license") or "").upper()
    if not lic:
        p["license"] = 0
        F.append({"pillar": "license", "severity": "MEDIUM", "measured": "no declared license",
                  "mechanism": "unclear legal status", "effect": "blocks enterprise adoption (OWASP MCP04)", "delta": 25})
    elif lic in PERMISSIVE:
        p["license"] = 25
    elif lic in COPYLEFT:
        p["license"] = 16
        F.append({"pillar": "license", "severity": "LOW", "measured": f"copyleft license ({meta['license']})",
                  "mechanism": "redistribution constraints", "effect": "proprietary-integration friction", "delta": 9})
    else:
        p["license"] = 18

    # --- adoption /20 (stars + forks, échelle par paliers) ---
    s = meta.get("stars", 0) or 0
    base = 20 if s >= 5000 else 17 if s >= 1000 else 14 if s >= 300 else 10 if s >= 50 else 6 if s >= 10 else 3 if s >= 1 else 0
    if (meta.get("forks", 0) or 0) >= 20 and base < 20:
        base += 1
    p["adoption"] = min(20, base)
    if p["adoption"] <= 6:
        F.append({"pillar": "adoption", "severity": "LOW", "measured": f"{s} stars",
                  "mechanism": "low community traction", "effect": "less peer review/hardening", "delta": WEIGHTS["adoption"] - p["adoption"]})

    # --- documentation /15 ---
    doc = 0
    if meta.get("description"):
        doc += 7
    if meta.get("topics"):
        doc += 4
    if meta.get("homepage"):
        doc += 4
    p["documentation"] = min(15, doc)
    if p["documentation"] < 11:
        F.append({"pillar": "documentation", "severity": "LOW", "measured": "incomplete repo metadata (desc/topics/homepage)",
                  "mechanism": "reduced discoverability & onboarding", "effect": "slower adoption", "delta": WEIGHTS["documentation"] - p["documentation"]})

    score = sum(p.values())
    floor = None
    if meta.get("archived"):                  # signal dur : un repo mort ne mérite pas mieux que D
        score = min(score, 54)
        floor = "ARCHIVED"
    F.sort(key=lambda x: -x["delta"])
    return {
        "repo": meta["repo"], "kind": "repo", "score": score, "grade": _band(score), "floor": floor,
        "pillars": p, "findings": F,
        "facts": {"stars": s, "forks": meta.get("forks", 0), "pushed_days": meta.get("pushed_days"),
                  "license": meta.get("license"), "archived": meta.get("archived"),
                  "open_issues": meta.get("open_issues", 0), "description": meta.get("description")},
        "name": meta.get("name"), "homepage": meta.get("homepage"),
    }


def findings(meta):
    """Compat : findings bruts (l'attribution complète est dans score_repo)."""
    return score_repo(meta).get("findings", []) if not meta.get("error") else []
