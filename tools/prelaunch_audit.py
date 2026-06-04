#!/usr/bin/env python3
"""CheckMCP pre-launch site auditor — a deep ship-readiness scanner (~100 criteria). stdlib only.

Categories: SEO, Open Graph/Twitter, structured data, security headers & cookies, TLS/redirects,
performance, accessibility, trust/conversion, content quality, infra (robots/sitemap/404/well-known),
broken links & redirect chains, duplicate-meta detection, functional health.

Usage: python3 tools/prelaunch_audit.py [https://checkmcp.dev]
"""
import gzip
import io
import json
import re
import ssl
import socket
import sys
import time
import zlib
import urllib.request
import urllib.error
from datetime import datetime, timezone
from urllib.parse import urljoin, urlparse
from html.parser import HTMLParser

BASE = (sys.argv[1] if len(sys.argv) > 1 else "https://checkmcp.dev").rstrip("/")
HOST = urlparse(BASE).netloc
UA = "Mozilla/5.0 (PrelaunchAudit; +checkmcp.dev)"
PAGES = ["/", "/directory", "/pricing", "/dashboard", "/badge", "/terms", "/privacy",
         "/contact", "/login", "/signup", "/report?url=https://mcp.context7.com/mcp",
         "/mcp/mcp-context7-com"]

R = []
def add(sev, page, check, msg): R.append((sev, page, check, msg))
TITLES, DESCS = {}, {}   # for duplicate detection


def fetch(url, method="GET", timeout=25, headers=None):
    h = {"User-Agent": UA, "Accept": "text/html,application/xhtml+xml,*/*",
         "Accept-Encoding": "gzip, deflate"}
    if headers: h.update(headers)
    req = urllib.request.Request(url, method=method, headers=h)
    t0 = time.time()
    try:
        r = urllib.request.urlopen(req, timeout=timeout)
        raw = r.read() if method == "GET" else b""
        enc = (r.headers.get("Content-Encoding") or "").lower()
        if "gzip" in enc:
            try: raw = gzip.decompress(raw)
            except Exception: pass
        elif "deflate" in enc:
            try: raw = zlib.decompress(raw)
            except Exception:
                try: raw = zlib.decompress(raw, -zlib.MAX_WBITS)
                except Exception: pass
        body = raw.decode("utf-8", "replace") if method == "GET" else ""
        return r.status, {k.lower(): v for k, v in r.headers.items()}, body, time.time() - t0, len(raw)
    except urllib.error.HTTPError as e:
        return e.code, {k.lower(): v for k, v in (e.headers or {}).items()}, "", time.time() - t0, 0
    except Exception as e:
        return 0, {}, str(e)[:80], time.time() - t0, 0


class P(HTMLParser):
    def __init__(s):
        super().__init__()
        s.title = None; s._t = False; s.metas = []; s.links = []; s.jsonld = []; s._ld = ""; s._inld = False
        s.h = {i: 0 for i in range(1, 7)}; s.headings = []; s.lang = None; s.charset = None
        s.imgs = []; s.forms = []; s._form = None; s.inputs = []; s.labels = 0
        s.a = []; s.text_len = 0; s.landmarks = set(); s.scripts = []; s.styles_inline = 0; s.buttons = []

    def handle_starttag(s, tag, attrs):
        d = dict(attrs)
        if tag == "html": s.lang = d.get("lang")
        elif tag == "title": s._t = True
        elif tag == "meta":
            s.metas.append(d)
            if d.get("charset"): s.charset = d["charset"]
        elif tag == "link": s.links.append(d)
        elif tag in ("h1", "h2", "h3", "h4", "h5", "h6"):
            s.h[int(tag[1])] += 1; s.headings.append(int(tag[1]))
        elif tag == "img": s.imgs.append(d)
        elif tag == "form": s.forms.append(d)
        elif tag == "input": s.inputs.append(d)
        elif tag == "label": s.labels += 1
        elif tag == "button": s.buttons.append(d)
        elif tag == "a" and d.get("href"): s.a.append((d["href"], d))
        elif tag in ("main", "nav", "header", "footer", "aside", "section"): s.landmarks.add(tag)
        elif tag == "script":
            s.scripts.append(d)
            if d.get("type") == "application/ld+json": s._inld = True; s._ld = ""
        elif tag == "style": s.styles_inline += 1
        elif tag == "html" and d.get("role"): s.landmarks.add(d["role"])

    def handle_endtag(s, tag):
        if tag == "title": s._t = False
        elif tag == "script" and s._inld: s._inld = False; s.jsonld.append(s._ld)

    def handle_data(s, data):
        if s._t: s.title = (s.title or "") + data
        if s._inld: s._ld += data
        t = data.strip()
        if t: s.text_len += len(t)


def m(p, prop=None, name=None):
    for x in p.metas:
        if prop and x.get("property") == prop: return x.get("content", "")
        if name and x.get("name") == name: return x.get("content", "")
    return None

def lk(p, rel):
    for l in p.links:
        if rel in (l.get("rel", "")).split(): return l
    return None


def check_page(path):
    url = BASE + path
    st, hd, body, dt, size = fetch(url)
    pg = path if len(path) < 34 else path[:31] + "…"
    if st in (301, 302, 307, 308):
        add("INFO", pg, "http.redirect", f"{st}→{hd.get('location','?')}"); return None
    if st == 0: add("FAIL", pg, "http.unreachable", body); return None
    if st != 200: add("FAIL", pg, "http.status", f"HTTP {st}"); return None

    p = P()
    try: p.feed(body)
    except Exception: pass

    # ---------------- SEO ----------------
    t = (p.title or "").strip()
    (add("FAIL", pg, "seo.title", "missing") if not t
     else add("WARN", pg, "seo.title", f"{len(t)} chars (10–60)") if not 10 <= len(t) <= 60 else None)
    if t: TITLES.setdefault(t, []).append(pg)
    d = m(p, name="description")
    if not d: add("WARN", pg, "seo.description", "missing")
    elif len(d) > 160: add("WARN", pg, "seo.description", f"{len(d)} chars (≤160)")
    elif len(d) < 50: add("WARN", pg, "seo.description", f"{len(d)} chars (≥50)")
    if d: DESCS.setdefault(d, []).append(pg)
    cl = lk(p, "canonical")
    if not cl: add("WARN", pg, "seo.canonical", "missing")
    else:
        cu = cl.get("href", "")
        if not cu.startswith("http"): add("WARN", pg, "seo.canonical", "not absolute")
        elif urlparse(cu).path.rstrip("/") != urlparse(url).path.rstrip("/"):
            add("WARN", pg, "seo.canonical", f"≠ page ({cu})")
    if not p.charset: add("WARN", pg, "seo.charset", "no <meta charset>")
    if not m(p, name="viewport"): add("WARN", pg, "seo.viewport", "no viewport")
    noindex = "noindex" in (m(p, name="robots") or "").lower()
    if p.h[1] == 0 and not noindex: add("WARN", pg, "seo.h1", "no <h1>")
    elif p.h[1] > 1: add("INFO", pg, "seo.h1", f"{p.h[1]} h1")
    # heading order (no skipped level downward)
    prev = 0
    for lvl in p.headings:
        if prev and lvl > prev + 1: add("INFO", pg, "a11y.heading-order", f"jump h{prev}→h{lvl}"); break
        prev = lvl
    rob = (m(p, name="robots") or "").lower()
    if "noindex" in rob: add("INFO", pg, "seo.robots", "noindex")
    if p.text_len < 250 and path not in ("/login", "/signup", "/badge"):
        add("WARN", pg, "content.thin", f"~{p.text_len} chars of text")
    # placeholder / dev content
    if re.search(r"lorem ipsum|TODO|FIXME|coming soon|placeholder text|localhost:\d", body, re.I):
        add("WARN", pg, "content.placeholder", "lorem/TODO/localhost found")

    # ---------------- Open Graph / Twitter ----------------
    ogt = m(p, prop="og:title")
    if not ogt: add("WARN", pg, "og.title", "missing")
    elif not 10 <= len(ogt) <= 60: add("WARN", pg, "og.title", f"{len(ogt)} chars")
    if not m(p, prop="og:description"): add("WARN", pg, "og.description", "missing")
    if not m(p, prop="og:url"): add("WARN", pg, "og.url", "missing")
    if not m(p, prop="og:type"): add("INFO", pg, "og.type", "missing")
    if not m(p, prop="og:site_name"): add("INFO", pg, "og.site_name", "missing")
    ogi = m(p, prop="og:image")
    if not ogi: add("WARN", pg, "og.image", "missing")
    else:
        ist, ih, _, _, _ = fetch(urljoin(url, ogi), "HEAD", 15)
        if ist != 200 or not (ih.get("content-type", "").startswith("image")):
            add("WARN", pg, "og.image-loads", f"{ist} {ih.get('content-type','')[:20]}")
    if not m(p, name="twitter:card"): add("INFO", pg, "tw.card", "missing")

    # ---------------- structured data ----------------
    if not p.jsonld: add("WARN", pg, "sd.jsonld", "none")
    else:
        types = set()
        for j in p.jsonld:
            try:
                o = json.loads(j)
                for n in (o.get("@graph", [o]) if isinstance(o, dict) else o):
                    if isinstance(n, dict) and n.get("@type"): types.add(n["@type"])
            except Exception: add("WARN", pg, "sd.jsonld", "invalid JSON")
        if path == "/" and "Organization" not in types: add("INFO", pg, "sd.org", "no Organization schema")

    # ---------------- icons / analytics / fonts ----------------
    if not lk(p, "apple-touch-icon"): add("FAIL", pg, "icon.apple", "missing")
    if not lk(p, "icon"): add("WARN", pg, "icon.favicon", "missing")
    if not re.search(r"plausible|gtag|googletagmanager|posthog|umami|fathom|/_vercel/insights", body):
        add("FAIL", pg, "analytics", "none detected")
    if "fonts.googleapis" in body and not any("preconnect" in (l.get("rel", "")) for l in p.links):
        add("INFO", pg, "perf.font-preconnect", "google fonts w/o preconnect")

    # ---------------- security headers ----------------
    hsts = hd.get("strict-transport-security", "")
    if not hsts: add("WARN", pg, "sec.hsts", "missing")
    else:
        mo = re.search(r"max-age=(\d+)", hsts)
        if not mo or int(mo.group(1)) < 15552000: add("INFO", pg, "sec.hsts", "max-age < 180d")
        if "includesubdomains" not in hsts.lower(): add("INFO", pg, "sec.hsts", "no includeSubDomains")
    if hd.get("x-content-type-options", "").lower() != "nosniff": add("WARN", pg, "sec.nosniff", "missing")
    if not (hd.get("x-frame-options") or "frame-ancestors" in hd.get("content-security-policy", "")):
        add("WARN", pg, "sec.clickjacking", "no X-Frame-Options/frame-ancestors")
    if not hd.get("content-security-policy"): add("WARN", pg, "sec.csp", "no CSP")
    if not hd.get("referrer-policy"): add("WARN", pg, "sec.referrer", "missing")
    if not hd.get("permissions-policy"): add("INFO", pg, "sec.permissions-policy", "missing")
    if hd.get("x-powered-by"): add("INFO", pg, "sec.leak", hd["x-powered-by"])
    sc = hd.get("set-cookie", "")
    if sc:
        low = sc.lower()
        if "secure" not in low: add("WARN", pg, "sec.cookie", "Set-Cookie without Secure")
        if "httponly" not in low: add("INFO", pg, "sec.cookie", "no HttpOnly")
        if "samesite" not in low: add("INFO", pg, "sec.cookie", "no SameSite")
    # mixed content
    if url.startswith("https") and re.search(r'(src|href)=["\']http://', body):
        add("WARN", pg, "sec.mixed-content", "http:// resource on https page")
    if not hd.get("cache-control"): add("INFO", pg, "perf.cache-control", "no Cache-Control")

    # ---------------- performance ----------------
    if dt > 3: add("WARN", pg, "perf.ttfb", f"{dt:.1f}s (<3s)")
    elif dt > 1.5: add("INFO", pg, "perf.ttfb", f"{dt:.1f}s")
    if "gzip" not in hd.get("content-encoding", "") and "br" not in hd.get("content-encoding", ""):
        add("WARN", pg, "perf.compression", "no gzip/br")
    if size > 250000: add("INFO", pg, "perf.html-size", f"{size//1024}KB HTML")
    if "cf-ray" not in hd and "cf-cache-status" not in hd: add("INFO", pg, "perf.cdn", "no Cloudflare headers")
    lazy = sum(1 for im in p.imgs if im.get("loading") == "lazy")
    if p.imgs and lazy == 0: add("INFO", pg, "perf.img-lazy", f"{len(p.imgs)} imgs, none lazy")

    # ---------------- accessibility ----------------
    if not p.lang: add("WARN", pg, "a11y.lang", "no <html lang>")
    noalt = sum(1 for im in p.imgs if im.get("alt") is None)
    if noalt: add("WARN", pg, "a11y.img-alt", f"{noalt}/{len(p.imgs)} img w/o alt")
    labelable = [i for i in p.inputs if i.get("type") not in ("hidden", "submit", "button")]
    explicit = sum(1 for i in labelable if i.get("aria-label") or i.get("aria-labelledby") or i.get("id"))
    unlabeled = max(0, len(labelable) - explicit - p.labels)   # <label>-wrapped inputs count as labeled
    if unlabeled: add("WARN", pg, "a11y.input-label", f"{unlabeled} inputs unlabeled")
    vp = m(p, name="viewport") or ""
    if "user-scalable=no" in vp or "maximum-scale=1" in vp: add("WARN", pg, "a11y.zoom", "zoom disabled")
    if "main" not in p.landmarks: add("INFO", pg, "a11y.landmark", "no <main>")
    empty_links = sum(1 for href, dd in p.a if not (dd.get("aria-label")) and href.startswith("#"))
    return [(url, href) for href, _ in p.a]


def check_trust():
    st, hd, body, _, _ = fetch(BASE + "/")
    p = P(); p.feed(body)
    if not p.forms: add("FAIL", "/", "trust.form", "no <form>")
    if not (any("mailto:" in h or "/contact" in h for h, _ in p.a)): add("FAIL", "/", "trust.contact", "no contact")
    for legal in ("/terms", "/privacy"):
        st2, _, _, _, _ = fetch(BASE + legal)
        if st2 != 200: add("FAIL", "(site)", f"trust{legal}", f"{legal} → {st2}")
    yr = str(datetime.now(timezone.utc).year)
    if "©" in body or "&copy;" in body or "copyright" in body.lower():
        if yr not in body and str(int(yr) - 1) not in body: add("INFO", "/", "trust.copyright", "year may be stale")
    # social proof heuristic
    if not re.search(r"testimonial|review|trusted by|customers|logos?|\d+\+? (servers|users|developers|companies)", body, re.I):
        add("WARN", "/", "trust.social-proof", "no testimonials/logos/stats")


def dup_meta():
    for t, pgs in TITLES.items():
        if len(pgs) > 1: add("WARN", "(site)", "seo.dup-title", f"{len(pgs)} pages share title: {pgs}")
    for d, pgs in DESCS.items():
        if len(pgs) > 1: add("INFO", "(site)", "seo.dup-desc", f"{len(pgs)} pages share description")


def tls_check():
    try:
        ctx = ssl.create_default_context()
        with socket.create_connection((HOST, 443), timeout=10) as s:
            with ctx.wrap_socket(s, server_hostname=HOST) as ss:
                cert = ss.getpeercert()
                exp = datetime.strptime(cert["notAfter"], "%b %d %H:%M:%S %Y %Z").replace(tzinfo=timezone.utc)
                days = (exp - datetime.now(timezone.utc)).days
                if days < 15: add("FAIL", "(site)", "tls.expiry", f"cert expires in {days}d")
                elif days < 30: add("WARN", "(site)", "tls.expiry", f"cert expires in {days}d")
                else: add("INFO", "(site)", "tls.expiry", f"cert OK ({days}d)")
                ver = ss.version()
                if ver in ("TLSv1", "TLSv1.1"): add("WARN", "(site)", "tls.version", f"weak {ver}")
    except Exception as e:
        add("WARN", "(site)", "tls.handshake", str(e)[:60])


def site_infra():
    # robots
    st, hd, body, _, _ = fetch(BASE + "/robots.txt")
    if st != 200: add("WARN", "(site)", "infra.robots", f"{st}")
    else:
        if "sitemap" not in body.lower(): add("WARN", "(site)", "infra.robots-sitemap", "no Sitemap: line")
        # only a real blocker if the wildcard agent disallows root (per-bot AI blocks are fine)
        if re.search(r"disallow:\s*/\s*$", body, re.I | re.M) and not re.search(r"user-agent:\s*\*[\s\S]*?allow:\s*/", body, re.I):
            add("FAIL", "(site)", "infra.robots-block", "User-agent:* Disallow:/ (blocks all)")
        if re.search(r"user-agent:\s*(gptbot|claudebot|google-extended|ccbot|bytespider)[\s\S]{0,40}?disallow:\s*/", body, re.I):
            add("WARN", "(site)", "aeo.ai-crawlers-blocked", "robots blocks AI/answer-engine crawlers (hurts AEO)")
    # sitemap
    st, _, body, _, _ = fetch(BASE + "/sitemap.xml")
    locs = re.findall(r"<loc>([^<]+)</loc>", body) if st == 200 else []
    if st != 200: add("WARN", "(site)", "infra.sitemap", f"{st}")
    else:
        add("INFO", "(site)", "infra.sitemap", f"{len(locs)} urls")
        if "<lastmod>" not in body: add("INFO", "(site)", "infra.sitemap-lastmod", "no <lastmod>")
        # sample 5 sitemap urls for 200
        bad = 0
        for u in locs[:8]:
            s2, _, _, _, _ = fetch(u, "HEAD", 12)
            if s2 in (405, 0): s2, _, _, _, _ = fetch(u, timeout=12)
            if s2 >= 400: bad += 1; add("WARN", "(site)", "infra.sitemap-404", f"{s2} {u}")
        if bad == 0: add("INFO", "(site)", "infra.sitemap-urls", "sampled urls OK")
    # well-known + files
    for path, sev in [("/favicon.ico", "INFO"), ("/icon.png", "INFO"), ("/apple-icon.png", "FAIL"),
                      ("/manifest.json", "INFO"), ("/.well-known/security.txt", "INFO"), ("/llms.txt", "INFO")]:
        s2, _, _, _, _ = fetch(BASE + path)
        if s2 != 200: add(sev, "(site)", f"infra{path}", f"{s2}")
    # real 404
    s2, _, _, _, _ = fetch(BASE + "/zzz-nope-" + str(int(time.time())))
    if s2 != 404: add("WARN", "(site)", "infra.soft-404", f"unknown page → {s2}")
    # http→https
    s2, h2, _, _, _ = fetch("http://" + HOST + "/", timeout=15)
    if s2 not in (301, 308) or not h2.get("location", "").startswith("https"):
        add("WARN", "(site)", "sec.https-redirect", f"http:// → {s2} (want 301→https)")
    # www ↔ apex
    other = ("www." + HOST) if not HOST.startswith("www.") else HOST[4:]
    s2, h2, _, _, _ = fetch(f"https://{other}/", timeout=12)
    if s2 == 200 and "canonical" not in h2: add("INFO", "(site)", "infra.www", f"{other} also serves 200 (canonicalize)")


def crawl_links(all_links):
    seen, n = set(), 0
    for src, href in all_links:
        u = urljoin(src, href).split("#")[0]
        if not u.startswith(BASE) or "/api/" in u or "/cdn-cgi/" in u: continue
        if u in seen: continue
        seen.add(u); n += 1
        if n > 80: break
        s2, h2, _, _, _ = fetch(u, "HEAD", 12)
        if s2 in (405, 0): s2, h2, _, _, _ = fetch(u, timeout=15)
        if s2 >= 400: add("WARN", "(links)", "links.broken", f"{s2} {u}")
        elif s2 in (301, 308): add("INFO", "(links)", "links.redirect", f"{u}")


def main():
    print(f"PRE-LAUNCH AUDIT · {BASE} · {datetime.now(timezone.utc):%Y-%m-%d %H:%M UTC}\n" + "=" * 72)
    links = []
    for path in PAGES:
        r = check_page(path)
        if r: links += r
    check_trust(); dup_meta(); tls_check(); site_infra(); crawl_links(links)

    order = {"FAIL": 0, "WARN": 1, "INFO": 2}
    R.sort(key=lambda x: (order.get(x[0], 9), x[2]))
    cat = {}
    for sev, pg, chk, msg in R:
        if sev == "INFO": continue
        print(f"  [{sev}] {pg:30} {chk:22} {msg}")
        cat[chk.split('.')[0]] = cat.get(chk.split('.')[0], 0) + 1
    f = sum(1 for r in R if r[0] == "FAIL"); w = sum(1 for r in R if r[0] == "WARN"); i = sum(1 for r in R if r[0] == "INFO")
    print("=" * 72)
    print(f"  by category: " + " · ".join(f"{k}:{v}" for k, v in sorted(cat.items(), key=lambda x: -x[1])))
    print(f"  FAIL {f} · WARN {w} · INFO {i} (info hidden) · {len(PAGES)} pages · {len([1 for _ in R])} checks raised")
    print("  " + ("✅ SHIP-READY (0 FAIL)" if f == 0 else f"⛔ NOT READY — {f} blocking"))


if __name__ == "__main__":
    main()
