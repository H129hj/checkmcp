#!/usr/bin/env python3
"""Runner de monitoring CheckMCP — re-probe les baselines épinglées, alerte Telegram sur drift/rug-pull.
Lancé par un timer systemd. Réutilise l'infra (Telegram déjà dispo sur Contabo)."""
import json, os, sys, urllib.request, urllib.parse

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from checkmcp.probe import probe
from checkmcp.score import score
from checkmcp.monitor import fingerprint, diff, summarize
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
        if use_sb:
            sc = score(p)
            store.insert_run(url, score=sc.get("score"), grade=sc.get("grade"), drift=s["drift"],
                             verdict=s.get("verdict"), pillars=sc.get("pillars"), events=s.get("events"))
        crit = [e for e in s["events"] if e["severity"] in ("CRITICAL", "BREAKING")]
        if crit:
            drifted += 1
            lines = [f"🚨 CheckMCP — drift détecté", url, f"verdict: {s['verdict']}"]
            for e in crit[:6]:
                lines.append(f"• [{e['severity']}] {e['type']} — {e['tool']}")
            lines.append("re-pin via /api/monitor?url=...&pin=1 si légitime")
            alert("\n".join(lines))
            print("DRIFT", url, s["verdict"])
    print(f"checkmcp-monitor: {len(targets)} surveillés, {drifted} en drift")


if __name__ == "__main__":
    main()
