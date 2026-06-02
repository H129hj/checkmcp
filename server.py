#!/usr/bin/env python3
"""API CheckMCP — service HTTP stdlib (zéro dépendance).
Routes: /health · /api/score?url= · /badge/<slug>.svg(?url=) · /mcp/<slug>(?url=) · /audit?url=
Cache TTL + catalogue slug->url persistant."""
import json, time, re, os, sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs


def _json(obj):
    """Sérialise en gérant datetime (default=str) — les rows PG portent des timestamptz."""
    return json.dumps(obj, ensure_ascii=False, default=str)

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from checkmcp import __version__
from checkmcp.probe import probe
from checkmcp.score import score
from checkmcp.optimize import optimize
from checkmcp.badge import badge_svg
from checkmcp.page import render as render_page
from checkmcp.repo import fetch as repo_fetch, score_repo
from checkmcp.monitor import fingerprint, diff, summarize
from checkmcp import store

TTL = 6 * 3600
BASELINES = os.environ.get("CHECKMCP_BASELINES", os.path.join(os.path.dirname(os.path.abspath(__file__)), "baselines.json"))
_baselines = {}


def _load_baselines():
    global _baselines
    try:
        _baselines = json.load(open(BASELINES))
    except Exception:
        _baselines = {}


def monitor_for(url, pin=False, label=None, min_score=None):
    p = probe(url)
    if p.get("error"):
        return {"url": url, "error": p["error"]}
    fp = fingerprint(p)
    sc = score(p)
    if store.enabled():
        base = store.get_baseline(url)
        if base is None or pin:
            store.upsert_baseline(url, fp, label=label, min_score=min_score)
            store.insert_run(url, score=sc.get("score"), grade=sc.get("grade"), drift=False, pillars=sc.get("pillars"))
            return {"url": url, "pinned": True, "set_hash": fp["set_hash"], "count": fp["count"],
                    "score": sc.get("score"), "grade": sc.get("grade"), "drift": False, "backend": "postgres"}
        res = summarize(diff(base.get("fingerprint", {}), fp))
        res.update({"url": url, "baseline_hash": base.get("set_hash"), "current_hash": fp["set_hash"], "count": fp["count"],
                    "score": sc.get("score"), "grade": sc.get("grade"), "backend": "postgres"})
        store.insert_run(url, score=sc.get("score"), grade=sc.get("grade"), drift=res["drift"],
                         verdict=res.get("verdict"), pillars=sc.get("pillars"), events=res.get("events"))
        return res
    # fallback JSON local
    base = _baselines.get(url)
    if base is None or pin:
        _baselines[url] = fp
        try:
            json.dump(_baselines, open(BASELINES, "w"))
        except Exception:
            pass
        return {"url": url, "pinned": True, "set_hash": fp["set_hash"], "count": fp["count"], "drift": False, "backend": "json"}
    s = summarize(diff(base, fp))
    s.update({"url": url, "baseline_hash": base["set_hash"], "current_hash": fp["set_hash"], "count": fp["count"], "backend": "json"})
    return s
GH_TOKEN = os.environ.get("GITHUB_TOKEN")
_repo_cache = {}


def repo_for(repo):
    now = time.time()
    if repo in _repo_cache and now - _repo_cache[repo][0] < TTL:
        return _repo_cache[repo][1]
    m = repo_fetch(repo, GH_TOKEN)
    r = m if m.get("error") else score_repo(m)
    if not r.get("error") and store.enabled():
        store.save_repo_audit(r)
    _repo_cache[repo] = (now, r)
    return r
PORT = int(os.environ.get("CHECKMCP_PORT", "8799"))
CATALOG = os.environ.get("CHECKMCP_CATALOG", os.path.join(os.path.dirname(os.path.abspath(__file__)), "catalog.json"))
_cache = {}            # url -> (ts, result)
_catalog = {}          # slug -> url


def _slug(url):
    # host + segments de chemin significatifs (pour distinguer p.ex. gitmcp.io/<repo>),
    # en éliminant les suffixes de transport (/mcp, /sse, /api).
    s = re.sub(r"^https?://", "", url.rstrip("/"))
    parts = [p for p in s.split("/") if p]
    host = parts[0] if parts else s
    path = [p for p in parts[1:] if p.lower() not in ("mcp", "sse", "api")]
    return re.sub(r"[^a-z0-9]+", "-", "-".join([host] + path).lower()).strip("-")


def _load():
    global _catalog
    try:
        _catalog = json.load(open(CATALOG))
    except Exception:
        _catalog = {}
    if store.enabled():            # seed depuis Postgres (survit aux redémarrages)
        try:
            _catalog.update(store.catalog())
        except Exception:
            pass


def _save():
    try:
        json.dump(_catalog, open(CATALOG, "w"))
    except Exception:
        pass


def result_for(url, force=False):
    now = time.time()
    if not force and url in _cache and now - _cache[url][0] < TTL:
        return _cache[url][1]
    if not force and store.enabled():          # read-through Postgres (cache partagé/persistant)
        cached = store.get_audit(url, max_age_s=TTL)
        if cached:
            _cache[url] = (now, cached)
            return cached
    p = probe(url)
    if p.get("error"):
        return {**p, "url": url}          # préserve auth_required / well_known pour le front
    r = score(p); r["optimize"] = optimize(p); r["url"] = url; r["server"] = p.get("server", {})
    _cache[url] = (now, r)
    slug = _slug(url)
    _catalog[slug] = url
    if store.enabled():
        store.save_audit(url, slug, r)
    else:
        _save()
    return r


def private_result(url, token):
    """Audit authentifié (token Bearer) — pour les MCP OAuth-gated. Jamais caché ni persisté."""
    p = probe(url, token=token)
    if p.get("error"):
        return {**p, "url": url}
    r = score(p); r["optimize"] = optimize(p); r["url"] = url; r["server"] = p.get("server", {}); r["private"] = True
    return r


def resolve(path_slug, qs):
    if "url" in qs:
        return qs["url"][0]
    return _catalog.get(path_slug)


class H(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def _send(self, code, body, ctype, cache=21600):
        b = body.encode() if isinstance(body, str) else body
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(b)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Cache-Control", f"public, max-age={cache}" if cache else "no-store")
        self.end_headers()
        self.wfile.write(b)

    def do_GET(self):
        u = urlparse(self.path)
        qs = parse_qs(u.query)
        parts = [p for p in u.path.split("/") if p]

        if u.path == "/health":
            return self._send(200, json.dumps({"status": "ok", "version": __version__, "cached": len(_cache), "catalog": len(_catalog)}), "application/json")

        if u.path == "/api/monitor":
            url = qs.get("url", [None])[0]
            if not url:
                return self._send(400, json.dumps({"error": "param ?url= requis"}), "application/json")
            m = monitor_for(url, pin=qs.get("pin", ["0"])[0] in ("1", "true"),
                            label=qs.get("label", [None])[0], min_score=qs.get("min_score", [None])[0])
            return self._send(200 if not m.get("error") else 422, _json(m), "application/json", cache=0)

        if u.path == "/api/monitors":
            return self._send(200, _json({"monitors": store.list_monitors()}), "application/json", cache=0)

        if u.path == "/api/runs":
            url = qs.get("url", [None])[0]
            if not url:
                return self._send(400, json.dumps({"error": "param ?url= requis"}), "application/json")
            return self._send(200, _json({"url": url, "runs": store.list_runs(url, int(qs.get("limit", ["100"])[0]))}), "application/json", cache=0)

        if u.path == "/api/directory":
            order = qs.get("order", ["score"])[0]
            limit = min(int(qs.get("limit", ["200"])[0]), 500)
            return self._send(200, _json({"servers": store.list_audits(limit=limit, order=order)}), "application/json", cache=60)

        if u.path == "/api/repo":
            slug = qs.get("slug", [None])[0]
            if slug:                                   # lecture d'un audit repo persistant
                r = store.get_repo_audit(slug)
                return self._send(200 if r else 404, _json(r or {"error": "repo inconnu"}), "application/json")
            repo = qs.get("repo", [None])[0]
            if not repo:
                return self._send(400, json.dumps({"error": "param ?repo= ou ?slug= requis"}), "application/json")
            m = repo_for(repo)
            return self._send(200 if not m.get("error") else 422, _json(m), "application/json")

        if u.path == "/api/repos":
            order = qs.get("order", ["score"])[0]
            limit = min(int(qs.get("limit", ["300"])[0]), 500)
            src = qs.get("source", [None])[0]
            return self._send(200, _json({"repos": store.list_repo_audits(limit=limit, order=order, source=src)}), "application/json", cache=60)

        if u.path == "/api/score" or u.path == "/audit":
            url = qs.get("url", [None])[0]
            if not url:
                return self._send(400, json.dumps({"error": "param ?url= requis"}), "application/json")
            auth = self.headers.get("Authorization", "")
            token = auth[7:].strip() if auth.lower().startswith("bearer ") else None
            if token:                                  # audit privé authentifié — jamais caché/persisté
                r = private_result(url, token)
                return self._send(200 if not r.get("error") else 422, _json(r), "application/json", cache=0)
            r = result_for(url, force=qs.get("refresh", ["0"])[0] in ("1", "true"))
            if u.path == "/audit" and r.get("error") is None:
                return self._send(200, render_page(url, _slug(url), r), "text/html; charset=utf-8")
            err = bool(r.get("error"))
            return self._send(422 if err else 200, _json(r), "application/json", cache=0 if err else 21600)

        # badge repo : /badge/repo/<slug>.svg  (Repo-Quality Score, p.ex. fiches mcpizy)
        if len(parts) == 3 and parts[0] == "badge" and parts[1] == "repo" and parts[2].endswith(".svg"):
            slug = parts[2][:-4]
            repo = qs.get("repo", [None])[0]
            r = repo_for(repo) if repo else store.get_repo_audit(slug)
            if not r or r.get("error"):
                return self._send(404, badge_svg(0, "F", "Repo Score"), "image/svg+xml")
            return self._send(200, badge_svg(r["score"], r["grade"], "Repo Score"), "image/svg+xml")

        if len(parts) == 2 and parts[0] == "badge" and parts[1].endswith(".svg"):
            slug = parts[1][:-4]
            url = resolve(slug, qs)
            if not url:
                return self._send(404, badge_svg(0, "F", "MCP Score"), "image/svg+xml")
            r = result_for(url)
            sc, gr = (0, "F") if r.get("error") else (r["score"], r["grade"])
            return self._send(200, badge_svg(sc, gr), "image/svg+xml")

        if len(parts) == 2 and parts[0] == "mcp":
            slug = parts[1]
            url = resolve(slug, qs)
            if not url:
                return self._send(404, "<h1>404 — serveur inconnu. Auditez-le via /audit?url=</h1>", "text/html; charset=utf-8")
            r = result_for(url)
            if r.get("error"):
                return self._send(422, f"<h1>Audit impossible: {r['error']}</h1>", "text/html; charset=utf-8")
            return self._send(200, render_page(url, slug, r), "text/html; charset=utf-8")

        self._send(404, json.dumps({"error": "not found", "routes": ["/health", "/api/score?url=", "/audit?url=", "/badge/<slug>.svg", "/mcp/<slug>"]}), "application/json")


if __name__ == "__main__":
    _load()
    _load_baselines()
    print(f"CheckMCP API v{__version__} on :{PORT} (catalog={len(_catalog)}, baselines={len(_baselines)})", flush=True)
    ThreadingHTTPServer(("0.0.0.0", PORT), H).serve_forever()
