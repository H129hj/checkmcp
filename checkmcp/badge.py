"""Badge SVG "MCP Score" (style shields) + snippet d'embed. Mécanisme viral de CheckMCP."""

GRADE_COLOR = {"A": "#2ea44f", "B": "#7fbf3f", "C": "#dfb317", "D": "#fe7d37", "F": "#e05d44"}


def _w(text, px=7):
    return max(20, int(len(text) * px) + 10)


def badge_svg(score, grade, label="MCP Score"):
    val = f"{score} · {grade}"
    color = GRADE_COLOR.get(grade, "#9f9f9f")
    lw, vw = _w(label), _w(val)
    total = lw + vw
    return f'''<svg xmlns="http://www.w3.org/2000/svg" width="{total}" height="20" role="img" aria-label="{label}: {val}">
<linearGradient id="s" x2="0" y2="100%"><stop offset="0" stop-color="#bbb" stop-opacity=".1"/><stop offset="1" stop-opacity=".1"/></linearGradient>
<clipPath id="r"><rect width="{total}" height="20" rx="3" fill="#fff"/></clipPath>
<g clip-path="url(#r)">
<rect width="{lw}" height="20" fill="#555"/>
<rect x="{lw}" width="{vw}" height="20" fill="{color}"/>
<rect width="{total}" height="20" fill="url(#s)"/>
</g>
<g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" font-size="11">
<text x="{lw/2*10}" y="150" fill="#010101" fill-opacity=".3" transform="scale(.1)" textLength="{(lw-10)*10}">{label}</text>
<text x="{lw/2*10}" y="140" transform="scale(.1)" textLength="{(lw-10)*10}">{label}</text>
<text x="{(lw+vw/2)*10}" y="150" fill="#010101" fill-opacity=".3" transform="scale(.1)" textLength="{(vw-10)*10}">{val}</text>
<text x="{(lw+vw/2)*10}" y="140" transform="scale(.1)" textLength="{(vw-10)*10}">{val}</text>
</g></svg>'''


def embed_snippets(slug, score, grade):
    base = f"https://checkmcp.com/badge/{slug}.svg"
    page = f"https://checkmcp.com/mcp/{slug}"
    return {
        "markdown": f"[![MCP Score {score} {grade}]({base})]({page})",
        "html": f'<a href="{page}"><img src="{base}" alt="MCP Score {score} {grade}"></a>',
        "url": base,
    }
