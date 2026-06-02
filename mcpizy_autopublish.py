#!/usr/bin/env python3
"""checkmcp → mcpizy : auto-publication des MCP audités, sécu-gated, dédoublonnés.
Sélectionne les serveurs audités sur checkmcp qui (1) passent un gate sécurité STRICT,
(2) ne sont pas déjà dans le catalogue mcpizy → génère une fiche structurée et l'insère.
DRY-RUN par défaut (n'écrit rien) ; --commit pour insérer réellement.
Env : DATABASE_URL (checkmcp), MCPIZY_SUPABASE_URL/KEY (catalogue mcpizy)."""
import os, re, sys, json, urllib.request, urllib.parse, urllib.error

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from checkmcp import store

SB = (os.environ.get("MCPIZY_SUPABASE_URL") or "").rstrip("/")
KEY = os.environ.get("MCPIZY_SUPABASE_KEY")
COMMIT = "--commit" in sys.argv

# --- gate sécurité STRICT (auto-publish) ---
MIN_SCORE = 80          # grade B+
MIN_SECURITY = 95       # pilier sécurité /100
CATEGORIES = [("search", "Search"), ("doc", "Documentation"), ("git", "Developer Tools"),
              ("data", "Data"), ("brows", "Browser"), ("pay", "Payments")]


def _norm(s):
    return re.sub(r"[^a-z0-9]+", "", (s or "").lower())


def _host(u):
    return re.sub(r"^https?://", "", u or "").split("/")[0]


def mcpizy_catalog():
    url = f"{SB}/rest/v1/marketplace_catalog?select=slug,name,github_url,homepage_url&limit=2000"
    req = urllib.request.Request(url, headers={"apikey": KEY, "Authorization": "Bearer " + KEY})
    return json.loads(urllib.request.urlopen(req, timeout=30).read().decode())


def insert(payload):
    # upsert sur slug : ré-exécutable, rafraîchit les fiches hosted déjà publiées
    req = urllib.request.Request(
        f"{SB}/rest/v1/marketplace_catalog?on_conflict=slug",
        data=json.dumps(payload).encode(),
        headers={"apikey": KEY, "Authorization": "Bearer " + KEY,
                 "Content-Type": "application/json", "Prefer": "resolution=merge-duplicates,return=minimal"},
        method="POST")
    try:
        urllib.request.urlopen(req, timeout=20).read()
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"{e.code}: {e.read().decode(errors='replace')[:160]}")


def eligible(a):
    """a = row d'audit live. Renvoie (ok, raison)."""
    if (a.get("score") or 0) < MIN_SCORE:
        return False, f"score {a.get('score')} < {MIN_SCORE}"
    if a.get("floor"):
        return False, f"floor {a['floor']}"
    p = a.get("pillars") or {}
    if (p.get("security") or 0) < MIN_SECURITY:
        return False, f"sécu {p.get('security')} < {MIN_SECURITY}"
    f = a.get("facts") or {}
    if f.get("lethal_trifecta"):
        return False, "lethal-trifecta"
    if any(o.get("sev") == "HIGH" for o in (f.get("owasp") or [])):
        return False, "OWASP HIGH"
    return True, "OK"


def category(name, facts):
    blob = _norm(name)
    for k, label in CATEGORIES:
        if k in blob:
            return label
    return "Developer Tools"


def build_listing(a):
    f = a.get("facts") or {}
    name = a.get("name") or _host(a["url"])
    slug = "hosted-" + re.sub(r"[^a-z0-9]+", "-", _host(a["url"]).lower()).strip("-")
    # description orientée bénéfice + anglais (cohérent avec le catalogue mcpizy ;
    # la 1re phrase alimente le TL;DR « …lets AI agents <benefit> »).
    desc = (f"use {name}'s tools remotely over a hosted MCP endpoint — no local install. "
            f"{f.get('tools', '?')} tools, {f.get('transport', 'http')} transport. "
            f"Audited by CheckMCP: {a['score']}/100 ({a['grade']}).")
    return {
        "slug": slug,
        "name": name,
        "description": desc,
        "category": category(name, f),
        "github_url": None,
        "npm_package": None,
        "install_command": None,                       # hosted : pas d'install npx
        "homepage_url": a["url"],
        "verified": True,                              # gate strict → vérifié
        "installs": 0,
        "icon": "🌐",
        "tools_count": f.get("tools"),
        "config_example": {"transport": f.get("transport", "http"), "url": a["url"], "type": "hosted", "added_by": "checkmcp"},
        "auth_setup": ("OAuth 2.1 (Bearer) requis" if (f.get("well_known") or {}).get("oauth_protected_resource") else "Aucune auth"),
    }


def main():
    if not store.enabled() or not (SB and KEY):
        print("env manquant"); return
    cat = mcpizy_catalog()
    # on dédoublonne contre les fiches mcpizy "natives" uniquement — les fiches hosted-*
    # (publiées par checkmcp) sont ré-upsertées pour rester à jour.
    native = [c for c in cat if not (c.get("slug") or "").startswith("hosted-")]
    seen_names = {_norm(c["name"]) for c in native}
    seen_hosts = {_host(c.get("homepage_url") or "") for c in native if c.get("homepage_url")}
    seen_hosts |= {_host(c.get("github_url") or "") for c in native if c.get("github_url")}
    seen_hosts.discard("")

    audits = store.list_audits(limit=500, order="score")
    print(f"checkmcp: {len(audits)} audits live · mcpizy: {len(cat)} fiches · mode={'COMMIT' if COMMIT else 'DRY-RUN'}\n")
    added, skipped, run_slugs = 0, 0, set()
    for a in audits:
        ok, why = eligible(a)
        if not ok:
            continue
        name_n, host = _norm(a.get("name")), _host(a["url"])
        if name_n in seen_names or host in seen_hosts:
            skipped += 1
            print(f"  = déjà dans mcpizy : {a.get('name')} ({host})")
            continue
        listing = build_listing(a)
        if listing["slug"] in run_slugs:          # collapse same-host services (ex. gitmcp.io/*)
            continue
        run_slugs.add(listing["slug"])
        print(f"  + NOUVEAU : {listing['name']:<28} {a['score']} {a['grade']}  [{listing['category']}]  slug={listing['slug']}")
        if COMMIT:
            try:
                insert(listing); added += 1
            except Exception as e:
                print(f"      échec insert: {str(e)[:120]}")
        else:
            added += 1
    print(f"\n{'INSÉRÉS' if COMMIT else 'À INSÉRER (dry-run)'}: {added} · déjà présents: {skipped}")
    if not COMMIT:
        print("→ relance avec --commit pour publier dans mcpizy.")


if __name__ == "__main__":
    main()
