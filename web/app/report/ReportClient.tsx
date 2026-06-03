"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import Report from "../../components/Report";
import AuditInput from "../../components/AuditInput";
import { AuditResult, hostOf } from "../../lib/format";
import { trackAudit } from "../account/actions";

const STEPS = ["initialize handshake", "tools/list + resources + prompts", "OWASP security scan", "MCP Score computation"];

export default function ReportClient({ canPrivate = false, signedIn = false, canEval = false }: { canPrivate?: boolean; signedIn?: boolean; canEval?: boolean }) {
  const sp = useSearchParams();
  const url = sp.get("url") || "";
  const [res, setRes] = useState<AuditResult | null>(null);
  const [err, setErr] = useState<{ msg: string; auth?: boolean } | null>(null);
  const [step, setStep] = useState(0);
  const [token, setToken] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [evalState, setEvalState] = useState<{ loading: boolean; data?: any; err?: string }>({ loading: false });

  async function runEval() {
    setEvalState({ loading: true });
    const hdr = token ? { headers: { Authorization: `Bearer ${token}` } } : {};
    try {
      // 1) crée le job async (la requête ne bloque pas même pour un serveur lent)
      const c = await fetch(`/api/eval-job?url=${encodeURIComponent(url)}`, { cache: "no-store", ...hdr });
      const cj = await c.json();
      if (!c.ok || cj.error || !cj.id) {
        setEvalState({ loading: false, err: cj.error || "eval failed" });
        return;
      }
      // 2) poll jusqu'à done/error (max ~70s)
      for (let i = 0; i < 35; i++) {
        await new Promise((r) => setTimeout(r, 2000));
        const p = await fetch(`/api/eval-job?id=${encodeURIComponent(cj.id)}`, { cache: "no-store" });
        const pj = await p.json();
        if (pj.status === "done") { setEvalState({ loading: false, data: pj.evals || { ran: false, reason: "no eval data" } }); return; }
        if (pj.status === "error") { setEvalState({ loading: false, err: pj.error || "eval failed" }); return; }
      }
      setEvalState({ loading: false, err: "eval timed out — the server is very slow to respond" });
    } catch {
      setEvalState({ loading: false, err: "network unavailable" });
    }
  }

  async function runAudit(bearer?: string) {
    setRes(null); setErr(null); setStep(0);
    if (bearer) setAuthLoading(true);
    const tick = setInterval(() => setStep((s) => Math.min(s + 1, STEPS.length - 1)), 1400);
    try {
      // private (token) audits go through the session-aware /api/secure-audit proxy (Pro-gated server-side);
      // public audits hit the engine directly.
      const endpoint = bearer ? "/api/secure-audit" : "/api/score";
      const r = await fetch(`${endpoint}?url=${encodeURIComponent(url)}`, {
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
            {err.auth && canPrivate ? (
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
            ) : err.auth ? (
              <div className="mt-2">
                <p className="mb-3 text-sm text-base-content/60">
                  This MCP requires OAuth. <b className="text-base-content">Private authenticated audits</b> (your token is never stored nor published) are a Pro feature.
                </p>
                <Link href={signedIn ? "/pricing?reason=webhook" : "/signup?next=pricing"} className="btn btn-primary btn-sm">
                  {signedIn ? "Upgrade to audit privately" : "Sign up to audit privately"}
                </Link>
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

          {/* Behavioral safety eval (Pro) — the runtime-proof moat */}
          <div className="card mt-6 border border-base-content/10 bg-base-200/60">
            <div className="card-body gap-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-lg font-extrabold">Behavioral safety eval</h3>
                  <p className="text-sm text-base-content/60">Actually invokes read-only tools with canary inputs to catch tool-output prompt-injection, exfiltration, secret/PII leakage — what static analysis can’t see.</p>
                </div>
                {canEval ? (
                  <button className="btn btn-primary btn-sm" onClick={runEval} disabled={evalState.loading}>
                    {evalState.loading ? <span className="loading loading-spinner loading-xs" /> : evalState.data ? "Re-run eval" : "Run eval"}
                  </button>
                ) : (
                  <a href="/pricing?reason=webhook" className="btn btn-sm">Pro feature →</a>
                )}
              </div>

              {evalState.loading && (
                <div className="flex items-center gap-2 font-mono text-sm text-base-content/60">
                  <span className="loading loading-spinner loading-xs text-primary" /> probing tools with canary inputs…
                </div>
              )}
              {evalState.err && <div role="alert" className="alert border-g-d/40 bg-g-d/10 text-sm"><span className="text-g-d">{evalState.err}</span></div>}

              {evalState.data?.ran === false && (
                <p className="font-mono text-sm text-base-content/50">Not run: {evalState.data.reason}</p>
              )}
              {evalState.data?.ran && (
                <div className="mt-1">
                  {(() => {
                    const v = evalState.data.verdict as string;
                    const map: Record<string, string> = {
                      clean: "border-g-a/40 bg-g-a/10 text-g-a",
                      suspicious: "border-g-c/40 bg-g-c/10 text-g-c",
                      malicious: "border-g-f/40 bg-g-f/10 text-g-f",
                      inconclusive: "border-base-content/20 bg-base-200 text-base-content/60",
                    };
                    return (
                      <div className={`mb-3 inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 font-mono text-sm ${map[v] || map.inconclusive}`}>
                        verdict: <b className="uppercase">{v}</b>
                        <span className="text-base-content/50">· {evalState.data.tools_probed?.length ?? 0} read-only tool(s) probed · {evalState.data.skipped ?? 0} skipped</span>
                      </div>
                    );
                  })()}
                  {(!evalState.data.findings || evalState.data.findings.length === 0) ? (
                    <p className="font-mono text-sm text-g-a">✓ no runtime injection / exfiltration / leakage observed</p>
                  ) : (
                    <ul className="space-y-2">
                      {evalState.data.findings.map((f: any, i: number) => (
                        <li key={i} className="rounded-lg border border-base-content/10 bg-base-100/50 p-3">
                          <div className="flex items-center gap-2 font-mono text-sm">
                            <span className={`badge badge-sm ${f.severity === "HIGH" ? "border-g-f/40 bg-g-f/10 text-g-f" : f.severity === "MEDIUM" ? "border-g-c/40 bg-g-c/10 text-g-c" : "border-base-content/20"}`}>{f.severity}</span>
                            <b>{f.type}</b><span className="text-base-content/50">— {f.tool}</span>
                          </div>
                          <p className="mt-1 text-sm text-base-content/70">{f.detail}</p>
                          {f.evidence && <p className="mt-1 break-all font-mono text-xs text-base-content/40">evidence: {f.evidence}</p>}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
