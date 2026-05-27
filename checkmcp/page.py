"""Page SEO/GEO par serveur MCP — JSON-LD SoftwareApplication + FAQPage (pattern aeo-kit).
1 page indexable par serveur => moteur de découverte organique pour checkmcp.com."""
import json, html


def _faqs(name, res):
    f = res["facts"]
    qs = [
        (f"Quel est le MCP Score de {name} ?",
         f"{name} obtient un MCP Score de {res['score']}/100 (grade {res['grade']}) à l'audit CheckMCP, "
         f"calculé sur 7 piliers (sécurité, design des outils, qualité des schémas, coût contexte, conformité, fiabilité, couverture)."),
        (f"Combien d'outils {name} expose-t-il ?",
         f"{name} expose {f['tools']} outils MCP" + (f", {f['resources']} resources et {f['prompts']} prompts." if (f['resources'] or f['prompts']) else ".")
         + (f" C'est au-delà du p95 de l'écosystème (médiane ~7) — un signal de tool sprawl." if f['tools'] > 42 else "")),
        (f"{name} est-il sûr à brancher dans un agent ?",
         f"L'audit relève {f['unconfirmed_destructive']} outil(s) destructif(s) sans confirmation et {f['annotations_pct']}% d'annotations de sécurité déclarées."
         + (" Aucun secret en clair détecté dans les schémas." if not res.get('floor') else " ⚠️ Un risque de sécurité a plafonné la note.")),
        (f"Combien {name} coûte-t-il en contexte ?",
         f"Charger la liste d'outils de {name} consomme ~{f['tools_list_tokens']//1000 or f['tools_list_tokens']}{'k' if f['tools_list_tokens']>=1000 else ''} tokens, "
         f"payés à chaque requête de la session."),
    ]
    if f.get("lethal_trifecta"):
        c = f.get("sec_capabilities", {})
        qs.append((
            f"{name} est-il exposé au « lethal trifecta » MCP ?",
            f"Oui. {name} combine sur le même serveur les trois capacités à risque : ingestion de contenu non-fiable "
            f"({c.get('untrusted_content',0)} outils), accès à des données sensibles ({c.get('sensitive_data',0)} outils) "
            f"et exfiltration/destruction ({c.get('exfil',0)+c.get('destructive',0)} outils). "
            f"Une prompt-injection dans le contenu ingéré peut donc lire un secret puis l'exfiltrer. "
            f"Remédiation : scinder en deux serveurs — un MCP « lecture/contenu non-fiable » en read-only, isolé du MCP « privilégié » "
            f"(données sensibles + exfil/destruction) ; à défaut, placer les outils sensibles derrière confirmation + destructiveHint."))
    return qs


def render(url, slug, res):
    s = res["score"]; g = res["grade"]; f = res["facts"]
    name = (res.get("server", {}) or {}).get("name") or slug
    desc = f"MCP Score de {name} : {s}/100 (grade {g}). {f['tools']} outils, ~{f['tools_list_tokens']//1000}k tokens de contexte. Audit qualité/sécurité/coût par CheckMCP."
    faqs = _faqs(name, res)
    ld = {
        "@context": "https://schema.org", "@graph": [
            {"@type": "SoftwareApplication", "name": f"{name} (serveur MCP)",
             "applicationCategory": "DeveloperApplication", "operatingSystem": "MCP",
             "url": url, "description": desc,
             "aggregateRating": {"@type": "AggregateRating", "ratingValue": round(s/20, 1), "bestRating": 5, "worstRating": 0, "ratingCount": 1, "reviewCount": 1}},
            {"@type": "FAQPage", "mainEntity": [
                {"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": a}} for q, a in faqs]},
        ]}
    pillars = "".join(f"<li><b>{k}</b>: {v}/100</li>" for k, v in res["pillars"].items())
    finds = "".join(f"<li><b>{html.escape(x['measured'])}</b> — {html.escape(x['mechanism'])} → {html.escape(x['effect'])} <em>(Δ{x['delta']})</em></li>" for x in res["findings"][:8])
    opt = res.get("optimize", {})
    # Sécurité OWASP : findings taggés + callout lethal-trifecta avec remédiation
    owasp = f.get("owasp", [])
    secli = "".join(f"<li><b>{html.escape(o['id'])}</b> <span>({html.escape(o['sev'])})</span> — <code>{html.escape(o['tool'])}</code></li>" for o in owasp[:8])
    split = next((x for x in opt.get("suggestions", []) if x.get("type") == "split-trifecta"), None)
    trifecta_html = ""
    if f.get("lethal_trifecta") and split:
        trifecta_html = (
            f'<h2 id="lethal-trifecta">⚠️ Lethal trifecta détecté</h2>'
            f'<p><b>{html.escape(split["why"])}</b></p>'
            f'<p><b>Remédiation : </b>{html.escape(split["proposed"])}.</p>'
            f'<ul>{"".join(f"<li>{html.escape(t)}</li>" for t in split["tools"])}</ul>')
    sec_html = (f'<h2 id="securite">Sécurité (OWASP MCP Top 10)</h2><ul>{secli}</ul>' if secli else "") + trifecta_html
    suggs = [x for x in opt.get("suggestions", []) if x.get("type") != "split-trifecta"]
    optli = "".join(f"<li>{html.escape(', '.join(x['tools'][:4]))} → <code>{html.escape(x['proposed'])}</code></li>" for x in suggs[:5])
    faqhtml = "".join(f"<details><summary>{html.escape(q)}</summary><p>{html.escape(a)}</p></details>" for q, a in faqs)
    return f"""<!doctype html><html lang="fr"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{html.escape(name)} — MCP Score {s}/{g} | CheckMCP</title>
<meta name="description" content="{html.escape(desc)}">
<link rel="canonical" href="https://checkmcp.com/mcp/{slug}">
<script type="application/ld+json">{json.dumps(ld, ensure_ascii=False)}</script>
</head><body>
<main>
<nav><a href="/mcp">← Annuaire MCP</a></nav>
<h1>{html.escape(name)} — MCP Score {s}/100 <span>(grade {g})</span></h1>
<p>{html.escape(desc)}</p>
<h2>Score par pilier</h2><ul>{pillars}</ul>
<h2>Pourquoi cette note (opportunités)</h2><ul>{finds}</ul>
{sec_html}
{"<h2>Optimisations composite suggérées</h2><ul>"+optli+"</ul>" if optli else ""}
<h2>FAQ</h2>{faqhtml}
<footer><p>Audit par <a href="https://checkmcp.com">CheckMCP</a> — méthodologie ouverte, calibrée sur l'écosystème MCP réel.</p></footer>
</main></body></html>"""
