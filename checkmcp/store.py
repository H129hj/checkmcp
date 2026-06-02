"""Backend Postgres pour CheckMCP — base `checkmcp` locale (psycopg2).
Tables : audits (cache des rapports), monitors (serveurs suivis + baseline), runs (historique drift),
repo_audits (Repo-Quality Score des serveurs repo/stdio, p.ex. importés de mcpizy).
Si DATABASE_URL absent → enabled()=False (le caller retombe sur le JSON/cache local)."""
import os, re, json, threading

DSN = os.environ.get("DATABASE_URL") or os.environ.get("CHECKMCP_DATABASE_URL")
_lock = threading.Lock()
_conn = None

try:
    import psycopg2
    import psycopg2.extras
    _HAS_PG = True
except Exception:
    _HAS_PG = False


def enabled():
    return bool(DSN and _HAS_PG)


def _connect():
    c = psycopg2.connect(DSN)
    c.autocommit = True
    return c


def _cur():
    """Curseur dict, avec reconnexion paresseuse si la connexion est tombée."""
    global _conn
    if _conn is None or _conn.closed:
        _conn = _connect()
    try:
        return _conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    except Exception:
        _conn = _connect()
        return _conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)


def _exec(sql, params=None, fetch=None):
    """fetch: None|'one'|'all'. Thread-safe, renvoie {'error':...} en cas d'échec."""
    if not enabled():
        return {"error": "store disabled"}
    with _lock:
        try:
            cur = _cur()
            cur.execute(sql, params or ())
            out = None
            if fetch == "one":
                out = cur.fetchone()
            elif fetch == "all":
                out = cur.fetchall()
            cur.close()
            return out
        except Exception as e:
            global _conn
            try:
                _conn.close()
            except Exception:
                pass
            _conn = None
            return {"error": str(e)[:160]}


# ---------- audits (cache des rapports + annuaire) ----------

def save_audit(url, slug, res):
    r = res
    return _exec(
        """INSERT INTO audits (url, slug, name, score, grade, floor, pillars, facts, findings, optimize, server, result, updated_at)
           VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s, now())
           ON CONFLICT (url) DO UPDATE SET
             slug=EXCLUDED.slug, name=EXCLUDED.name, score=EXCLUDED.score, grade=EXCLUDED.grade,
             floor=EXCLUDED.floor, pillars=EXCLUDED.pillars, facts=EXCLUDED.facts, findings=EXCLUDED.findings,
             optimize=EXCLUDED.optimize, server=EXCLUDED.server, result=EXCLUDED.result, updated_at=now()""",
        (url, slug, (r.get("server") or {}).get("name"), r.get("score"), r.get("grade"), r.get("floor"),
         json.dumps(r.get("pillars")), json.dumps(r.get("facts")), json.dumps(r.get("findings")),
         json.dumps(r.get("optimize")), json.dumps(r.get("server")), json.dumps(r)))


def get_audit(url, max_age_s=None):
    extra = ""
    if max_age_s:
        extra = " AND updated_at > now() - interval '%d seconds'" % int(max_age_s)
    r = _exec("SELECT result, updated_at FROM audits WHERE url=%s" + extra, (url,), fetch="one")
    if isinstance(r, dict) and r.get("result"):
        return r["result"]
    return None


def list_audits(limit=200, order="score"):
    col = {"score": "score DESC NULLS LAST", "recent": "updated_at DESC"}.get(order, "score DESC NULLS LAST")
    r = _exec(
        "SELECT url, slug, name, score, grade, floor, pillars, facts, updated_at "
        "FROM audits ORDER BY " + col + " LIMIT %s", (limit,), fetch="all")
    return r if isinstance(r, list) else []


def catalog():
    """slug -> url, pour résolution des routes /mcp et /badge après redémarrage."""
    r = _exec("SELECT slug, url FROM audits", fetch="all")
    return {row["slug"]: row["url"] for row in r} if isinstance(r, list) else {}


# ---------- monitors (serveurs suivis + baseline) ----------

def get_baseline(url, user_id=None):
    r = _exec("SELECT set_hash, tool_count AS count, baseline AS fingerprint FROM monitors WHERE url=%s", (url,), fetch="one")
    return r if isinstance(r, dict) else None


def upsert_baseline(url, fp, user_id=None, label=None, min_score=None):
    return _exec(
        """INSERT INTO monitors (url, label, min_score, set_hash, tool_count, baseline, updated_at)
           VALUES (%s,%s,%s,%s,%s,%s, now())
           ON CONFLICT (url) DO UPDATE SET
             set_hash=EXCLUDED.set_hash, tool_count=EXCLUDED.tool_count, baseline=EXCLUDED.baseline,
             label=COALESCE(EXCLUDED.label, monitors.label),
             min_score=COALESCE(EXCLUDED.min_score, monitors.min_score), updated_at=now()""",
        (url, label, min_score, fp.get("set_hash"), fp.get("count"), json.dumps(fp)))


def list_monitors(active=True):
    sql = "SELECT url, label, min_score, set_hash, tool_count, updated_at FROM monitors"
    if active:
        sql += " WHERE is_active=true"
    sql += " ORDER BY updated_at DESC LIMIT 500"
    r = _exec(sql, fetch="all")
    return r if isinstance(r, list) else []


# ---------- runs (historique des checks) ----------

def insert_run(url, score=None, grade=None, drift=False, verdict=None, pillars=None, events=None, user_id=None):
    return _exec(
        "INSERT INTO runs (url, score, grade, drift, verdict, pillars, events) VALUES (%s,%s,%s,%s,%s,%s,%s)",
        (url, score, grade, drift, verdict, json.dumps(pillars), json.dumps(events)))


def list_runs(url, limit=100):
    r = _exec(
        "SELECT id, url, score, grade, drift, verdict, events, created_at FROM runs WHERE url=%s "
        "ORDER BY created_at DESC LIMIT %s", (url, limit), fetch="all")
    return r if isinstance(r, list) else []


# ---------- repo_audits (Repo-Quality Score : serveurs repo/stdio) ----------

def repo_slug(repo):
    return re.sub(r"[^a-z0-9]+", "-", (repo or "").lower()).strip("-")


def save_repo_audit(r, source=None, mcpizy_slug=None):
    slug = repo_slug(r["repo"])
    return _exec(
        """INSERT INTO repo_audits (repo, slug, name, score, grade, floor, pillars, facts, findings, homepage, source, mcpizy_slug, result, updated_at)
           VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s, now())
           ON CONFLICT (repo) DO UPDATE SET
             slug=EXCLUDED.slug, name=EXCLUDED.name, score=EXCLUDED.score, grade=EXCLUDED.grade, floor=EXCLUDED.floor,
             pillars=EXCLUDED.pillars, facts=EXCLUDED.facts, findings=EXCLUDED.findings, homepage=EXCLUDED.homepage,
             source=COALESCE(EXCLUDED.source, repo_audits.source),
             mcpizy_slug=COALESCE(EXCLUDED.mcpizy_slug, repo_audits.mcpizy_slug), result=EXCLUDED.result, updated_at=now()""",
        (r["repo"], slug, r.get("name"), r.get("score"), r.get("grade"), r.get("floor"),
         json.dumps(r.get("pillars")), json.dumps(r.get("facts")), json.dumps(r.get("findings")),
         r.get("homepage"), source, mcpizy_slug, json.dumps(r)))


def get_repo_audit(slug):
    r = _exec("SELECT result, mcpizy_slug FROM repo_audits WHERE slug=%s OR repo=%s", (slug, slug), fetch="one")
    if not (isinstance(r, dict) and r.get("result")):
        return None
    res = r["result"]
    res["mcpizy_slug"] = r.get("mcpizy_slug")     # lien retour vers la fiche mcpizy
    return res


def list_repo_audits(limit=300, order="score", source=None):
    col = {"score": "score DESC NULLS LAST", "recent": "updated_at DESC", "stars": "(facts->>'stars')::int DESC NULLS LAST"}.get(order, "score DESC NULLS LAST")
    where = "WHERE source=%s" if source else ""
    params = ([source] if source else []) + [limit]
    r = _exec("SELECT repo, slug, name, score, grade, floor, pillars, facts, homepage, source, mcpizy_slug, updated_at "
              "FROM repo_audits " + where + " ORDER BY " + col + " LIMIT %s", params, fetch="all")
    return r if isinstance(r, list) else []
