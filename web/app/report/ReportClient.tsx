"use client";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Report from "../../components/Report";
import AuditInput from "../../components/AuditInput";
import { AuditResult, hostOf } from "../../lib/format";
import { trackAudit } from "../account/actions";

const STEPS = ["initialize handshake", "tools/list + resources + prompts", "OWASP security scan", "MCP Score computation"];

export default function ReportClient() {
  const sp = useSearchParams();
  const url = sp.get("url") || "";
  const [res, setRes] = useState<AuditResult | null>(null);
  const [err, setErr] = useState<{ msg: string; auth?: boolean } | null>(null);
  const [step, setStep] = useState(0);
  const [token, setToken] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  async function runAudit(bearer?: string) {
    setRes(null); setErr(null); setStep(0);
    if (bearer) setAuthLoading(true);
    const tick = setInterval(() => setStep((s) => Math.min(s + 1, STEPS.length - 1)), 1400);
    try {
      const r = await fetch(`/api/score?url=${encodeURIComponent(url)}`, {
        cache: "no-store",
        ...(bearer ? { headers: { Authorization: `Bearer ${bearer}` } } : {}),
      });
      const j = await r.json();
      if (!r.ok || j.error) setErr({ msg: j.error || "audit failed", auth: !!j.auth_required });
      else { setRes(j); if (!j.private) trackAudit(url).catch(() => {}); }
    } catch {
      setErr({ msg: "network unavailable" });
    } finally {
      clearInterval(tick); setAuthLoading(false);
    }
  }

  useEffect(() => { if (url) runAudit(); /* eslint-disable-next-line */ }, [url]);

  if (!url) return (
    <div className="max-w-xl pt-20">
      <h1 className="mb-4 text-3xl font-extrabold">Audit an MCP server</h1>
      <AuditInput autofocus />
    </div>
  );

  return (
    <div className="py-10">
      {!res && !err && (
        <div className="card mx-auto mt-14 max-w-lg border border-base-content/10 bg-base-200/60">
          <div className="card-body">
            <div className="mb-4 flex items-center gap-3">
              <span className="loading loading-spinner loading-sm text-primary" />
              <span className="font-mono text-base-content/60">auditing <b className="text-base-content">{hostOf(url)}</b>…</span>
            </div>
            {STEPS.map((s, i) => (
              <div key={i} aria-live="polite" className={`py-1 font-mono text-sm ${i <= step ? "text-primary" : "text-base-content/30"}`}>
                {i < step ? "✓" : i === step ? "❯" : "·"} {s}
              </div>
            ))}
          </div>
        </div>
      )}

      {err && (
        <div className="card mx-auto mt-14 max-w-xl border border-base-content/10 bg-base-200/60">
          <div className="card-body">
            <h2 className="text-2xl font-extrabold">{err.auth ? "🔒 Protected server" : "Audit failed"}</h2>
            <p className="font-mono text-sm text-base-content/60">{err.msg}</p>
            {err.auth ? (
              <div className="mt-2">
                <p className="mb-3 text-sm text-base-content/60">
                  This MCP requires OAuth. Paste an <b className="text-base-content">access token (Bearer)</b> to audit it privately — it is never stored nor published.
                </p>
                <div className="join w-full">
                  <span className="join-item flex items-center border border-base-content/15 border-r-0 bg-base-200 px-3">🔑</span>
                  <input type="password" value={token} onChange={(e) => setToken(e.target.value)} onKeyDown={(e) => e.key === "Enter" && token && runAudit(token)}
                    placeholder="Bearer token…" aria-label="Bearer token" className="input input-bordered join-item w-full border-l-0 bg-base-200 font-mono text-sm" />
                  <button className="btn btn-primary join-item" disabled={!token || authLoading} onClick={() => runAudit(token)}>
                    {authLoading ? <span className="loading loading-spinner loading-xs" /> : "Audit privately"}
                  </button>
                </div>
              </div>
            ) : (
              <>
                <p className="text-sm text-base-content/50">Make sure the URL is an MCP endpoint (often <code>…/mcp</code> or <code>/sse</code>) and publicly reachable.</p>
                <div className="mt-3"><AuditInput /></div>
              </>
            )}
          </div>
        </div>
      )}

      {res && (
        <>
          {res.private && (
            <div role="alert" className="alert mb-4 border-primary/40 bg-primary/5 text-sm">
              🔒 <span className="font-mono text-base-content/70">Private authenticated audit — <b className="text-base-content">not published</b>, absent from the directory and cache.</span>
            </div>
          )}
          <Report res={res} />
        </>
      )}
    </div>
  );
}
