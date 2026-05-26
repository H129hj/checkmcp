#!/usr/bin/env python3
"""API CheckMCP — service HTTP stdlib (zéro dépendance).
Routes: /health · /api/score?url= · /badge/<slug>.svg(?url=) · /mcp/<slug>(?url=) · /audit?url=
Cache TTL + catalogue slug->url persistant."""
import json, time, re, os, sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from checkmcp import __version__
from checkmcp.probe import probe
from checkmcp.score import score
from checkmcp.optimize import optimize
from checkmcp.badge import badge_svg
from checkmcp.page import render as render_page

TTL = 6 * 3600
PORT = int(os.environ.get("CHECKMCP_PORT", "8799"))
CATALOG = os.environ.get("CHECKMCP_CATALOG", os.path.join(os.path.dirname(os.path.abspath(__file__)), "catalog.json"))
_cache = {}            # url -> (ts, result)
_catalog = {}          # slug -> url


def _slug(url):
    h = re.sub(r"^https?://", "", url).split("/")[0]
    return re.sub(r"[^a-z0-9]+", "-", h.lower()).strip("-")


def _load():
    global _catalog
    try:
        _catalog = json.load(open(CATALOG))
    except Exception:
        _catalog = {}


def _save():
    try:
        json.dump(_catalog, open(CATALOG, "w"))
    except Exception:
        pass


def result_for(url):
    now = time.time()
    if url in _cache and now - _cache[url][0] < TTL:
        return _cache[url][1]
    p = probe(url)
    if p.get("error"):
        return {"error": p["error"], "url": url}
    r = score(p); r["optimize"] = optimize(p); r["url"] = url; r["server"] = p.get("server", {})
    _cache[url] = (now, r)
    slug = _slug(url)
    if _catalog.get(slug) != url:
        _catalog[slug] = url; _save()
    return r


def resolve(path_slug, qs):
    if "url" in qs:
        return qs["url"][0]
    return _catalog.get(path_slug)


class H(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def _send(self, code, body, ctype):
        b = body.encode() if isinstance(body, str) else body
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(b)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Cache-Control", "public, max-age=21600")
        self.end_headers()
        self.wfile.write(b)

    def do_GET(self):
        u = urlparse(self.path)
        qs = parse_qs(u.query)
        parts = [p for p in u.path.split("/") if p]

        if u.path == "/health":
            return self._send(200, json.dumps({"status": "ok", "version": __version__, "cached": len(_cache), "catalog": len(_catalog)}), "application/json")

        if u.path == "/api/score" or u.path == "/audit":
            url = qs.get("url", [None])[0]
            if not url:
                return self._send(400, json.dumps({"error": "param ?url= requis"}), "application/json")
            r = result_for(url)
            if u.path == "/audit" and r.get("error") is None:
                return self._send(200, render_page(url, _slug(url), r), "text/html; charset=utf-8")
            return self._send(200 if not r.get("error") else 502, json.dumps(r, ensure_ascii=False), "application/json")

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
                return self._send(502, f"<h1>Audit impossible: {r['error']}</h1>", "text/html; charset=utf-8")
            return self._send(200, render_page(url, slug, r), "text/html; charset=utf-8")

        self._send(404, json.dumps({"error": "not found", "routes": ["/health", "/api/score?url=", "/audit?url=", "/badge/<slug>.svg", "/mcp/<slug>"]}), "application/json")


if __name__ == "__main__":
    _load()
    print(f"CheckMCP API v{__version__} on :{PORT} (catalog={len(_catalog)})", flush=True)
    ThreadingHTTPServer(("0.0.0.0", PORT), H).serve_forever()
