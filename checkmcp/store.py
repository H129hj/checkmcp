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
    sql = ("SELECT url, label, min_score, set_hash, tool_count, last_eval_verdict, last_eval_at, updated_at "
           "FROM monitors")
    if active:
        sql += " WHERE is_active=true"
    sql += " ORDER BY updated_at DESC LIMIT 500"
    r = _exec(sql, fetch="all")
    return r if isinstance(r, list) else []


def update_eval(url, verdict, findings=None):
    """Mémorise le dernier verdict d'eval comportemental d'un serveur surveillé (eval-on-change)."""
    return _exec(
        "UPDATE monitors SET last_eval_verdict=%s, last_eval_at=now(), last_eval_findings=%s WHERE url=%s",
        (verdict, json.dumps(findings or []), url))


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


# ---------- clés API & quotas (monétisation) ----------

def api_key_owner(key_hash):
    """Résout une clé API → {user_id, plan}. None si inconnue."""
    r = _exec(
        "SELECT u.id AS user_id, u.plan FROM api_keys k JOIN users u ON u.id = k.user_id WHERE k.key_hash=%s",
        (key_hash,), fetch="one")
    return r if isinstance(r, dict) else None


def bump_api_usage(key_hash):
    """Incrémente le compteur du jour pour la clé et renvoie le total après incrément (int)."""
    r = _exec(
        """INSERT INTO api_usage (key_hash, day, count) VALUES (%s, current_date, 1)
           ON CONFLICT (key_hash, day) DO UPDATE SET count = api_usage.count + 1
           RETURNING count""",
        (key_hash,), fetch="one")
    return r.get("count") if isinstance(r, dict) else 0


DEFAULT_POLICY = {
    "min_score": 70, "max_severity": "MEDIUM", "block_floor": True,
    "block_lethal_trifecta": True, "block_malicious_eval": True,
    "require_monitored": False, "allowlist_hosts": [], "denylist_hosts": [],
}


def get_policy(user_id):
    """Policy de gouvernance d'un utilisateur/org (defaults fusionnés)."""
    r = _exec("SELECT config FROM policies WHERE user_id=%s", (user_id,), fetch="one")
    cfg = r.get("config") if isinstance(r, dict) else None
    if isinstance(cfg, str):
        try:
            cfg = json.loads(cfg)
        except Exception:
            cfg = None
    return {**DEFAULT_POLICY, **(cfg or {})}


def set_policy(user_id, config):
    return _exec(
        """INSERT INTO policies (user_id, config, updated_at) VALUES (%s,%s, now())
           ON CONFLICT (user_id) DO UPDATE SET config=EXCLUDED.config, updated_at=now()""",
        (user_id, json.dumps(config)))


def last_eval(url):
    r = _exec("SELECT last_eval_verdict FROM monitors WHERE url=%s", (url,), fetch="one")
    return r.get("last_eval_verdict") if isinstance(r, dict) else None


# ---------- gateway (proxy MCP in-band, mode passif) ----------

def create_gateway(gid, user_id, backend_url, label=None, secret=None):
    return _exec("INSERT INTO gateways (id, user_id, backend_url, label, secret) VALUES (%s,%s,%s,%s,%s)",
                 (gid, user_id, backend_url, label, secret))


def get_gateway(gid):
    r = _exec("SELECT id, user_id, backend_url, label, mode, secret FROM gateways WHERE id=%s", (gid,), fetch="one")
    return r if isinstance(r, dict) else None


def set_gateway_mode(gid, user_id, mode):
    mode = mode if mode in ("passive", "active") else "passive"
    return _exec("UPDATE gateways SET mode=%s WHERE id=%s AND user_id=%s", (mode, gid, user_id))


def list_gateways(user_id):
    r = _exec("SELECT id, backend_url, label, mode, created_at FROM gateways WHERE user_id=%s ORDER BY created_at DESC",
              (user_id,), fetch="all")
    return r if isinstance(r, list) else []


def delete_gateway(gid, user_id):
    return _exec("DELETE FROM gateways WHERE id=%s AND user_id=%s", (gid, user_id))


def log_gateway_call(gid, method, tool=None, flagged=False, verdict=None, findings=None, ms=None):
    return _exec(
        "INSERT INTO gateway_calls (gateway_id, method, tool, flagged, verdict, findings, ms) VALUES (%s,%s,%s,%s,%s,%s,%s)",
        (gid, method, tool, flagged, verdict, json.dumps(findings or []), ms))


def list_gateway_calls(gid, limit=100):
    r = _exec("SELECT method, tool, flagged, verdict, findings, ms, created_at FROM gateway_calls "
              "WHERE gateway_id=%s ORDER BY created_at DESC LIMIT %s", (gid, limit), fetch="all")
    return r if isinstance(r, list) else []


def gateway_summary(gid):
    r = _exec("SELECT count(*) AS calls, count(*) FILTER (WHERE flagged) AS flagged, max(created_at) AS last "
              "FROM gateway_calls WHERE gateway_id=%s", (gid,), fetch="one")
    return r if isinstance(r, dict) else {"calls": 0, "flagged": 0, "last": None}


def monitor_webhooks(url):
    """URLs de webhook des utilisateurs (plan webhook-capable) qui suivent ce serveur."""
    r = _exec(
        """SELECT um.webhook_url, um.min_score FROM user_monitors um JOIN users u ON u.id = um.user_id
           WHERE um.url=%s AND um.webhook_url IS NOT NULL AND um.webhook_url <> ''
             AND u.plan IN ('pro','team')""",
        (url,), fetch="all")
    return r if isinstance(r, list) else []


def list_repo_audits(limit=300, order="score", source=None):
    col = {"score": "score DESC NULLS LAST", "recent": "updated_at DESC", "stars": "(facts->>'stars')::int DESC NULLS LAST"}.get(order, "score DESC NULLS LAST")
    where = "WHERE source=%s" if source else ""
    params = ([source] if source else []) + [limit]
    r = _exec("SELECT repo, slug, name, score, grade, floor, pillars, facts, homepage, source, mcpizy_slug, updated_at "
              "FROM repo_audits " + where + " ORDER BY " + col + " LIMIT %s", params, fetch="all")
    return r if isinstance(r, list) else []
