#!/usr/bin/env python3
"""Import du catalogue marketplace mcpizy → repo_audits CheckMCP (Repo-Quality Score).
Couvre TOUT le catalogue : github_url direct, sinon résolution du repo via le registre npm
(install_command `npx -y <pkg>` → registry.npmjs.org → repository). Idempotent (upsert).
Env requis : MCPIZY_SUPABASE_URL/KEY, DATABASE_URL, GITHUB_TOKEN."""
import os, re, sys, json, time, urllib.request, urllib.parse

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from checkmcp.repo import fetch as repo_fetch, score_repo, _parse_repo
from checkmcp import store

SB_URL = (os.environ.get("MCPIZY_SUPABASE_URL") or "").rstrip("/")
SB_KEY = os.environ.get("MCPIZY_SUPABASE_KEY")
GH = os.environ.get("GITHUB_TOKEN")


def catalog():
    url = (f"{SB_URL}/rest/v1/marketplace_catalog"
           "?select=slug,name,github_url,install_command,homepage_url&limit=2000")
    req = urllib.request.Request(url, headers={"apikey": SB_KEY, "Authorization": "Bearer " + SB_KEY})
    return json.loads(urllib.request.urlopen(req, timeout=30).read().decode())


def npm_repo(install_command, homepage):
    """Résout le repo GitHub d'un package npm via le registre (champ repository)."""
    cand = None
    for src in (install_command or "", ):
        m = (re.search(r"npx\s+(?:-y\s+)?(@?[\w.\-/]+)", src) or
             re.search(r"npm\s+i(?:nstall)?\s+(?:-g\s+)?(@?[\w.\-/]+)", src))
        if m:
            cand = m.group(1); break
    if not cand:
        # parfois le homepage est déjà un repo github
        o, n = _parse_repo(homepage or "")
        return f"{o}/{n}" if o else None
    try:
        u = "https://registry.npmjs.org/" + urllib.parse.quote(cand, safe="@/")
        d = json.loads(urllib.request.urlopen(u, timeout=10).read().decode())
        repo = d.get("repository")
        url = repo.get("url") if isinstance(repo, dict) else (repo if isinstance(repo, str) else "")
        o, n = _parse_repo(url or "")
        return f"{o}/{n}" if o else None
    except Exception:
        return None


def main():
    if not (SB_URL and SB_KEY) or not store.enabled():
        print("env manquant (MCPIZY_SUPABASE_URL/KEY ou DATABASE_URL)"); return
    rows = catalog()
    seen, ok, via_npm, no_repo, dead = set(), 0, 0, 0, []
    print(f"mcpizy: {len(rows)} entrées au total")
    for r in rows:
        repo, src = None, "github"
        o, n = _parse_repo(r.get("github_url") or "")
        if o:
            repo = f"{o}/{n}"
        m = repo_fetch(repo, GH) if repo else {"error": "no-github"}
        if m.get("error"):                       # fallback npm/homepage
            nrepo = npm_repo(r.get("install_command"), r.get("homepage_url"))
            if nrepo and nrepo != repo:
                repo, src = nrepo, "npm"
                m = repo_fetch(repo, GH)
        if not repo:
            no_repo += 1; print(f"  --  pas de repo résoluble: {r['slug']}"); continue
        if m.get("error"):
            dead.append((r["slug"], repo, m["error"])); continue
        if repo in seen:
            continue
        seen.add(repo)
        sc = score_repo(m)
        store.save_repo_audit(sc, source="mcpizy", mcpizy_slug=r.get("slug"))
        ok += 1
        if src == "npm":
            via_npm += 1
        print(f"  {sc['score']:>3} {sc['grade']}  {repo}" + ("  (via npm)" if src == "npm" else ""))
        time.sleep(0.35)
    print(f"\n=== couverture mcpizy ===")
    print(f"  audités: {ok} (dont {via_npm} résolus via npm)")
    print(f"  repos morts (GitHub 404/erreur): {len(dead)}")
    print(f"  sans repo résoluble du tout: {no_repo}")
    for s, repo, e in dead[:30]:
        print(f"    dead: {s} -> {repo} ({e})")


if __name__ == "__main__":
    main()
