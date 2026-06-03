import { redirect } from "next/navigation";
import Link from "next/link";
import { getUser } from "../../lib/auth";
import { q } from "../../lib/db";
import { planOf } from "../../lib/plans";
import { hostOf } from "../../lib/format";
import { createGateway, deleteGateway, setGatewayMode } from "./actions";
import CopyButton from "../../components/CopyButton";

export const metadata = { title: "MCP Gateway — CheckMCP" };
export const dynamic = "force-dynamic";

const BASE = process.env.NEXT_PUBLIC_BASE_URL || "https://checkmcp.dev";

export default async function Gateways() {
  const user = await getUser();
  if (!user) redirect("/login");
  const plan = planOf(user.plan);
  const canUse = plan.privateAudits;

  const gws = await q<any>(
    `SELECT g.id, g.backend_url, g.label, g.mode, g.secret, g.created_at,
            (SELECT count(*) FROM gateway_calls c WHERE c.gateway_id=g.id) AS calls,
            (SELECT count(*) FROM gateway_calls c WHERE c.gateway_id=g.id AND c.flagged) AS flagged
       FROM gateways g WHERE g.user_id=$1 ORDER BY g.created_at DESC`, [user.id]);
  const ids = gws.map((g) => g.id);
  const calls = ids.length
    ? await q<any>(`SELECT gateway_id, method, tool, flagged, verdict, ms, created_at FROM gateway_calls
                     WHERE gateway_id = ANY($1) ORDER BY created_at DESC LIMIT 300`, [ids])
    : [];
  const byGw: Record<string, any[]> = {};
  for (const c of calls) (byGw[c.gateway_id] ||= []).push(c);

  return (
    <div className="py-12">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="font-mono text-xs uppercase tracking-[0.22em] text-primary/80">Gateway · passive</div>
          <h1 className="mt-2 text-3xl font-extrabold">MCP Gateway</h1>
          <p className="mt-1 max-w-2xl text-sm text-base-content/60">Point your agent at a CheckMCP gateway URL instead of the raw MCP server. The gateway proxies every call, inspects tool outputs for injection/exfiltration and checks your policy — and logs everything. <b>Passive mode</b>: it observes & flags, it does not block (yet).</p>
        </div>
        <div className="flex gap-2"><Link href="/policy" className="btn btn-ghost btn-sm">Policy ›</Link><Link href="/fleet" className="btn btn-ghost btn-sm">Fleet ›</Link></div>
      </div>

      {!canUse && (
        <div role="alert" className="alert mt-6 border-primary/40 bg-primary/5">
          <span>The MCP Gateway is a <b>Pro</b> feature. <Link href="/pricing?reason=webhook" className="text-primary">Upgrade ›</Link></span>
        </div>
      )}

      <form action={createGateway} className="card mt-6 border border-base-content/10 bg-base-200/60">
        <div className="card-body flex-row flex-wrap items-end gap-2 p-4">
          <label className="form-control flex-1">
            <span className="label-text mb-1 text-xs">Backend MCP server URL</span>
            <input name="backend_url" required disabled={!canUse} placeholder="https://mcp.example.com/mcp" spellCheck={false} inputMode="url"
              className="input input-sm input-bordered min-w-[16rem] bg-base-100 font-mono text-sm" />
          </label>
          <label className="form-control">
            <span className="label-text mb-1 text-xs">Label</span>
            <input name="label" disabled={!canUse} placeholder="optional" className="input input-sm input-bordered w-36 bg-base-100 font-mono text-sm" />
          </label>
          <button className="btn btn-primary btn-sm" type="submit" disabled={!canUse}>+ Create gateway</button>
        </div>
      </form>

      {gws.length === 0 ? (
        <p className="mt-8 text-base-content/60">No gateways yet. Create one above to start proxying an MCP server through CheckMCP.</p>
      ) : (
        <div className="mt-8 space-y-5">
          {gws.map((g) => {
            const gwUrl = `${BASE}/gw/${g.id}/mcp`;
            const log = byGw[g.id] || [];
            return (
              <div key={g.id} className="card border border-base-content/10 bg-base-200/60">
                <div className="card-body gap-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="font-semibold">{g.label || hostOf(g.backend_url)}</div>
                      <div className="font-mono text-xs text-base-content/40">→ {g.backend_url}</div>
                    </div>
                    <div className="flex items-center gap-2 font-mono text-xs">
                      {g.mode === "active"
                        ? <span className="badge badge-sm border-primary/50 bg-primary/15 text-primary">● active · enforcing</span>
                        : <span className="badge badge-sm border-base-content/25 text-base-content/60">○ passive · observe</span>}
                      <form action={setGatewayMode}>
                        <input type="hidden" name="id" value={g.id} />
                        <input type="hidden" name="mode" value={g.mode === "active" ? "passive" : "active"} />
                        <button className="btn btn-ghost btn-xs" type="submit">{g.mode === "active" ? "→ passive" : "→ active"}</button>
                      </form>
                      <span className="badge badge-sm border-base-content/20">{g.calls} calls</span>
                      {Number(g.flagged) > 0
                        ? <span className="badge badge-sm border-g-d/40 bg-g-d/10 text-g-d">{g.flagged} flagged</span>
                        : <span className="badge badge-sm border-g-a/35 bg-g-a/10 text-g-a">clean</span>}
                      <form action={deleteGateway}><input type="hidden" name="id" value={g.id} /><button className="btn btn-ghost btn-xs" type="submit">delete</button></form>
                    </div>
                  </div>

                  {(() => {
                    const cfg = JSON.stringify({ mcpServers: { [g.label || "gateway"]: { type: "http", url: gwUrl, headers: { Authorization: `Bearer ${g.secret}` } } } }, null, 2);
                    return (
                      <div className="rounded-lg bg-base-300/50 p-3">
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <span className="font-mono text-xs uppercase tracking-widest text-base-content/40">Point your agent here (MCP config)</span>
                          <CopyButton text={cfg} />
                        </div>
                        <pre className="overflow-x-auto whitespace-pre font-mono text-xs text-base-content/80">{cfg}</pre>
                        <div className="mt-2 flex items-center gap-2">
                          <span className="font-mono text-[11px] text-base-content/40">secret</span>
                          <code className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap font-mono text-xs text-primary">{g.secret}</code>
                          <CopyButton text={g.secret} />
                        </div>
                      </div>
                    );
                  })()}

                  {log.length > 0 && (
                    <div className="overflow-x-auto">
                      <table className="table table-xs">
                        <thead><tr className="text-base-content/40"><th>when</th><th>method</th><th>tool</th><th>verdict</th><th className="text-right">ms</th></tr></thead>
                        <tbody>
                          {log.slice(0, 12).map((c, i) => (
                            <tr key={i} className={c.flagged ? "bg-g-d/5" : ""}>
                              <td className="font-mono text-xs text-base-content/40">{new Date(c.created_at).toLocaleTimeString()}</td>
                              <td className="font-mono text-xs">{c.method}</td>
                              <td className="font-mono text-xs text-base-content/60">{c.tool || "—"}</td>
                              <td>{c.flagged ? <span className="font-mono text-xs text-g-d">⚠ {c.verdict}</span> : <span className="font-mono text-xs text-g-a">{c.verdict || "—"}</span>}</td>
                              <td className="text-right font-mono text-xs text-base-content/40">{c.ms ?? "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
