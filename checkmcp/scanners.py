"""Profondeur RUNTIME (#8) — adaptateur d'analyseurs externes (Snyk / mcp-scan / custom).

CheckMCP fait l'analyse statique (T1). La profondeur runtime — exécuter les outils et inspecter
leurs *résultats* (tool poisoning actif, exfiltration réelle) — est le métier de scanners dédiés.
Plutôt que de la réimplémenter, on l'INTÈGRE : si un scanner est présent, on le lance, on normalise
sa sortie au format CheckMCP (OWASP-taggé) et on la fusionne. Sinon, no-op gracieux.

Activation : `checkmcp <url> --deep`. Ordre de préférence :
  1. env CHECKMCP_SCANNER_CMD = gabarit shell avec {url}, doit émettre du JSON sur stdout.
  2. binaire `mcp-scan` (Invariant Labs) sur le PATH.
  3. binaire `snyk` sur le PATH (si une commande MCP est configurée côté Snyk).
Aucun de ces outils n'est une dépendance : absence = analyse statique seule (documenté dans le rapport).
"""
import json, os, shutil, subprocess, shlex

_SEV = {"critical": "CRITICAL", "high": "HIGH", "error": "HIGH", "medium": "MEDIUM",
        "moderate": "MEDIUM", "warning": "MEDIUM", "low": "LOW", "info": "LOW", "note": "LOW"}


def available():
    """Liste des backends runtime détectés (sans rien exécuter)."""
    found = []
    if os.environ.get("CHECKMCP_SCANNER_CMD"):
        found.append("custom")
    if shutil.which("mcp-scan"):
        found.append("mcp-scan")
    if shutil.which("snyk"):
        found.append("snyk")
    return found


def _norm_sev(v):
    return _SEV.get(str(v or "").strip().lower(), "MEDIUM")


def _norm_findings(payload, source):
    """Normalise une sortie JSON hétérogène en findings CheckMCP. Tolérant aux schémas."""
    out = []
    if isinstance(payload, dict):
        items = payload.get("findings") or payload.get("issues") or payload.get("results") or payload.get("vulnerabilities") or []
    elif isinstance(payload, list):
        items = payload
    else:
        items = []
    for it in items:
        if not isinstance(it, dict):
            continue
        sev = _norm_sev(it.get("severity") or it.get("level") or it.get("priority"))
        issue = it.get("issue") or it.get("title") or it.get("message") or it.get("description") or it.get("rule") or "finding"
        tool = it.get("tool") or it.get("toolName") or it.get("target") or it.get("name") or "(serveur)"
        owasp = it.get("owasp") or it.get("category") or "RUNTIME"
        out.append({"owasp": str(owasp), "severity": sev, "tool": str(tool)[:80],
                    "issue": str(issue)[:200], "source": source, "runtime": True})
    return out


def _run(cmd, timeout):
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
        out = (r.stdout or "").strip()
        if not out:
            return None
        # certains outils émettent du JSON-lines ou du bruit avant le JSON
        try:
            return json.loads(out)
        except Exception:
            start = out.find("{") if out.find("{") >= 0 else out.find("[")
            return json.loads(out[start:]) if start >= 0 else None
    except Exception:
        return None


def scan(url, timeout=120):
    """Lance le premier backend disponible. Retourne {backend, findings:[...], error?}."""
    backends = available()
    if not backends:
        return {"backend": None, "findings": [],
                "note": "aucun scanner runtime détecté — analyse statique (T1) seule. "
                        "Installez mcp-scan/snyk ou définissez CHECKMCP_SCANNER_CMD pour la profondeur runtime."}
    backend = backends[0]
    if backend == "custom":
        tmpl = os.environ["CHECKMCP_SCANNER_CMD"]
        cmd = shlex.split(tmpl.replace("{url}", shlex.quote(url))) if "{url}" in tmpl else shlex.split(tmpl) + [url]
    elif backend == "mcp-scan":
        cmd = ["mcp-scan", "scan", url, "--json"]
    else:  # snyk
        cmd = ["snyk", "mcp", "test", url, "--json"]
    payload = _run(cmd, timeout)
    if payload is None:
        return {"backend": backend, "findings": [],
                "error": f"{backend} n'a pas produit de JSON exploitable (absent, échec, ou format inattendu)"}
    return {"backend": backend, "findings": _norm_findings(payload, backend)}
