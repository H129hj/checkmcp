"""Backend Supabase pour CheckMCP SaaS — checkmcp_* via service_role REST.
Si SUPABASE_URL/SERVICE_KEY absents → enabled()=False (le caller retombe sur le JSON local)."""
import os, json, urllib.request, urllib.parse, urllib.error

SB_URL = (os.environ.get("SUPABASE_URL") or "").rstrip("/")
SB_KEY = os.environ.get("SUPABASE_SERVICE_KEY")


def enabled():
    return bool(SB_URL and SB_KEY)


def _req(method, path, params=None, body=None, prefer=None):
    url = f"{SB_URL}/rest/v1/{path}"
    if params:
        url += "?" + urllib.parse.urlencode(params)
    h = {"apikey": SB_KEY, "Authorization": "Bearer " + SB_KEY, "Content-Type": "application/json"}
    if prefer:
        h["Prefer"] = prefer
    data = json.dumps(body).encode() if body is not None else None
    try:
        r = urllib.request.urlopen(urllib.request.Request(url, data=data, headers=h, method=method), timeout=12)
        raw = r.read().decode()
        return json.loads(raw) if raw.strip() else []
    except urllib.error.HTTPError as e:
        return {"error": f"{e.code}: {e.read().decode()[:120]}"}
    except Exception as e:
        return {"error": str(e)[:80]}


def _uid(user_id):
    return "is.null" if user_id is None else f"eq.{user_id}"


def get_baseline(url, user_id=None):
    r = _req("GET", "checkmcp_baselines", {"url": f"eq.{url}", "user_id": _uid(user_id), "limit": "1", "select": "*"})
    return r[0] if isinstance(r, list) and r else None


def upsert_baseline(url, fp, user_id=None):
    body = {"set_hash": fp.get("set_hash"), "count": fp.get("count"), "fingerprint": fp}
    if get_baseline(url, user_id):
        return _req("PATCH", "checkmcp_baselines", {"url": f"eq.{url}", "user_id": _uid(user_id)}, body)
    body.update({"url": url, "user_id": user_id})
    return _req("POST", "checkmcp_baselines", None, body, prefer="return=minimal")


def list_monitors(active=True):
    p = {"select": "url,user_id,min_score,label", "limit": "500"}
    if active:
        p["is_active"] = "eq.true"
    r = _req("GET", "checkmcp_monitors", p)
    return r if isinstance(r, list) else []


def insert_run(url, score=None, grade=None, drift=False, verdict=None, pillars=None, events=None, user_id=None):
    return _req("POST", "checkmcp_runs", None,
                {"url": url, "score": score, "grade": grade, "drift": drift, "verdict": verdict,
                 "pillars": pillars, "events": events, "user_id": user_id}, prefer="return=minimal")
