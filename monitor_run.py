#!/usr/bin/env python3
"""Runner de monitoring CheckMCP — re-probe les baselines épinglées, alerte Telegram sur drift/rug-pull.
Lancé par un timer systemd. Réutilise l'infra (Telegram déjà dispo sur Contabo)."""
import json, os, sys, urllib.request, urllib.parse

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from checkmcp.probe import probe
from checkmcp.score import score
from checkmcp.monitor import fingerprint, diff, summarize
from checkmcp.evals import behavioral_eval
from checkmcp import store

BASELINES = os.environ.get("CHECKMCP_BASELINES", os.path.join(os.path.dirname(os.path.abspath(__file__)), "baselines.json"))
TG_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN")
TG_CHAT = os.environ.get("TELEGRAM_CHAT_ID")


def alert(text):
    if not (TG_TOKEN and TG_CHAT):
        print("[no telegram]", text); return
    try:
        data = urllib.parse.urlencode({"chat_id": TG_CHAT, "text": text, "disable_web_page_preview": "true"}).encode()
        urllib.request.urlopen(f"https://api.telegram.org/bot{TG_TOKEN}/sendMessage", data=data, timeout=10)
    except Exception as e:
        print("telegram error:", e)


def post_webhook(hook_url, payload):
    """Alerte sortante (plans Pro/Team) — POST JSON vers l'URL choisie par l'utilisateur (Slack/Discord/n8n…)."""
    try:
        body = json.dumps(payload).encode()
        req = urllib.request.Request(hook_url, data=body, headers={
            "Content-Type": "application/json", "User-Agent": "CheckMCP-Webhook/1.0"})
        urllib.request.urlopen(req, timeout=10)
        print("webhook ->", hook_url)
    except Exception as e:
        print("webhook error:", hook_url, e)


def dispatch_webhooks(url, kind, summary, score=None, grade=None, min_score=None, eval_verdict=None):
    """Notifie chaque follower (plan webhook-capable) de ce serveur."""
    if not store.enabled():
        return
    for w in store.monitor_webhooks(url):
        thr = w.get("min_score")
        if kind == "threshold" and not (thr is not None and score is not None and score < thr):
            continue
        post_webhook(w["webhook_url"], {
            "event": "checkmcp.alert", "kind": kind, "url": url,
            "score": score, "grade": grade, "min_score": thr,
            "verdict": summary.get("verdict") if summary else None,
            "eval_verdict": eval_verdict,
            "events": (summary.get("events") if summary else []) or [],
            "report": f"https://checkmcp.dev/report?url={urllib.parse.quote(url, safe='')}",
        })


def main():
    use_sb = store.enabled()
    if use_sb:
        targets = [(m["url"], m.get("user_id")) for m in store.list_monitors()]
        local = {}
    else:
        try:
            local = json.load(open(BASELINES))
        except Exception:
            print("no baselines"); return
        targets = [(u, None) for u in local]
    print(f"checkmcp-monitor: backend={'postgres' if use_sb else 'json'}, {len(targets)} cibles")
    drifted = 0
    for url, user_id in targets:
        p = probe(url)
        if p.get("error"):
            continue  # injoignable ponctuel — on ne crie pas au loup
        fp = fingerprint(p)
        if use_sb:
            b = store.get_baseline(url)
            base = b.get("fingerprint") if b else None
        else:
            base = local.get(url)
        if not base:
            continue  # pas encore de baseline épinglée
        s = summarize(diff(base, fp))
        sc = score(p) if use_sb else None
        if use_sb:
            store.insert_run(url, score=sc.get("score"), grade=sc.get("grade"), drift=s["drift"],
                             verdict=s.get("verdict"), pillars=sc.get("pillars"), events=s.get("events"))
            # alerte seuil : prévient les followers dont min_score n'est plus tenu
            dispatch_webhooks(url, "threshold", s, score=sc.get("score"), grade=sc.get("grade"))
        crit = [e for e in s["events"] if e["severity"] in ("CRITICAL", "BREAKING")]
        if crit:
            drifted += 1
            # eval-on-change : un drift critique → on SONDE le runtime pour savoir s'il est devenu dangereux
            ev_verdict = None
            try:
                p["url"] = url
                ev = behavioral_eval(p, max_tools=3, timeout=5)
                ev_verdict = ev.get("verdict")
                if use_sb:
                    store.update_eval(url, ev_verdict, ev.get("findings"))
            except Exception as e:
                print("eval-on-change error:", e)
            lines = ["🚨 CheckMCP — drift détecté", url, f"verdict: {s['verdict']}"]
            if ev_verdict and ev_verdict not in ("clean", "inconclusive"):
                lines.append(f"⚠️ behavioral eval: {ev_verdict.upper()}")
            for e in crit[:6]:
                lines.append(f"• [{e['severity']}] {e['type']} — {e['tool']}")
            lines.append("re-pin via /api/monitor?url=...&pin=1 si légitime")
            alert("\n".join(lines))
            dispatch_webhooks(url, "drift", s, score=sc.get("score") if sc else None,
                              grade=sc.get("grade") if sc else None, eval_verdict=ev_verdict)
            print("DRIFT", url, s["verdict"], "| eval:", ev_verdict)
    print(f"checkmcp-monitor: {len(targets)} surveillés, {drifted} en drift")


if __name__ == "__main__":
    main()
