import { redirect } from "next/navigation";
import Link from "next/link";
import { cookies } from "next/headers";
import { getUser } from "../../lib/auth";
import { q } from "../../lib/db";
import { GRADE_CHIP, gradeKey, hostOf } from "../../lib/format";
import { logout, followMonitor, unfollowMonitor, createApiKey, deleteApiKey, setWebhook } from "./actions";
import CopyButton from "../../components/CopyButton";
import { planOf } from "../../lib/plans";

export const metadata = { title: "My space" };
export const dynamic = "force-dynamic";

function Grade({ score, grade }: { score?: number; grade?: string }) {
  if (typeof score !== "number") return <span className="font-mono text-xs text-base-content/40">pending</span>;
  return (
    <span className="inline-flex items-center gap-2">
      <span className="font-mono font-bold">{score}</span>
      <span className={`grid h-7 w-7 place-items-center rounded-lg border font-mono text-xs font-bold ${GRADE_CHIP[gradeKey(grade)]}`}>{grade}</span>
    </span>
  );
}

export default async function Account({ searchParams }: { searchParams: { upgraded?: string } }) {
  const user = await getUser();
  if (!user) redirect("/login");
  const plan = planOf(user.plan);

  const monitors = await q<any>(
    `SELECT um.url, um.label, um.min_score, um.webhook_url, m.tool_count, r.score, r.grade, r.drift, r.verdict
       FROM user_monitors um LEFT JOIN monitors m ON m.url = um.url
       LEFT JOIN LATERAL (SELECT score, grade, drift, verdict FROM runs WHERE runs.url = um.url ORDER BY created_at DESC LIMIT 1) r ON true
      WHERE um.user_id = $1 ORDER BY um.created_at DESC`, [user.id]);
  const audits = await q<any>(
    `SELECT ua.url, ua.created_at, a.slug, a.name, a.score, a.grade FROM user_audits ua LEFT JOIN audits a ON a.url = ua.url
      WHERE ua.user_id = $1 ORDER BY ua.created_at DESC LIMIT 50`, [user.id]);
  const keys = await q<any>(`SELECT id, name, prefix, created_at, last_used FROM api_keys WHERE user_id = $1 ORDER BY created_at DESC`, [user.id]);
  const flash = cookies().get("cmcp_newkey")?.value;

  return (
    <div className="py-12">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="font-mono text-xs uppercase tracking-[0.22em] text-primary/80">My space</div>
          <h1 className="mt-2 text-3xl font-extrabold">{user.email}</h1>
        </div>
        <form action={logout}><button className="btn btn-sm btn-ghost" type="submit">Sign out</button></form>
      </div>

      {searchParams?.upgraded && (
        <div role="alert" className="alert mt-5 border-g-a/40 bg-g-a/10">
          <span className="text-g-a">✓ You’re upgraded. Thanks for supporting CheckMCP.</span>
        </div>
      )}

      {/* plan */}
      <div className="card mt-6 border border-base-content/10 bg-base-200/60">
        <div className="card-body flex-row flex-wrap items-center justify-between gap-3 p-4">
          <div>
            <div className="font-mono text-xs uppercase tracking-[0.18em] text-base-content/40">Plan</div>
            <div className="mt-0.5 flex items-center gap-2">
              <span className="text-lg font-extrabold">{plan.name}</span>
              {plan.id === "free" && <span className="badge badge-sm border-base-content/20 font-mono">free</span>}
            </div>
            <div className="mt-1 font-mono text-xs text-base-content/50">
              {monitors.length}/{plan.monitors} monitors · {plan.apiPerDay.toLocaleString("en-US")} API audits/day
              {plan.webhookAlerts ? " · webhooks on" : " · no webhooks"}
            </div>
          </div>
          <div className="flex gap-2">
            {plan.id === "free"
              ? <Link href="/pricing" className="btn btn-primary btn-sm">Upgrade</Link>
              : <form action="/api/billing/portal" method="post"><button className="btn btn-sm" type="submit">Manage subscription</button></form>}
            <Link href="/pricing" className="btn btn-ghost btn-sm">Compare plans</Link>
          </div>
        </div>
      </div>

      {/* follow */}
      <form action={followMonitor} className="card mt-7 border border-base-content/10 bg-base-200/60">
        <div className="card-body flex-row flex-wrap items-center gap-2 p-4">
          <span className="font-mono font-bold text-primary">❯</span>
          <input name="url" required placeholder="https://…/mcp — track a server" spellCheck={false} inputMode="url" aria-label="URL to track"
            className="input input-sm input-bordered min-w-[14rem] flex-1 bg-base-100 font-mono text-sm" />
          <input name="min_score" type="number" min={0} max={100} placeholder="min" title="minimum score" className="input input-sm input-bordered w-20 bg-base-100 font-mono text-sm" />
          <button className="btn btn-primary btn-sm" type="submit">+ Track</button>
        </div>
      </form>

      {/* monitors */}
      <div className="mb-3 mt-9 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-extrabold">My monitors <span className="font-mono text-sm text-base-content/40">({monitors.length})</span></h2>
        <Link href="/fleet" className="btn btn-outline btn-sm">Fleet risk dashboard ›</Link>
      </div>
      {monitors.length === 0 ? (
        <p className="text-base-content/60">No tracked monitors. Add a URL above or click “Track this server” from a report.</p>
      ) : (
        <div className="card overflow-hidden border border-base-content/10 bg-base-200/60">
          <table className="table">
            <tbody>
              {monitors.map((m) => (
                <tr key={m.url} className="align-top hover:bg-base-100/40">
                  <td>
                    <div className="font-semibold">{m.label || m.name || hostOf(m.url)}</div>
                    <div className="font-mono text-xs text-base-content/40">{hostOf(m.url)} · min {m.min_score ?? "—"}</div>
                    {plan.webhookAlerts ? (
                      <form action={setWebhook} className="mt-2 flex flex-wrap items-center gap-1.5">
                        <input type="hidden" name="url" value={m.url} />
                        <input name="webhook_url" type="url" defaultValue={m.webhook_url || ""} placeholder="https://hooks.… (drift & threshold alerts)" spellCheck={false} aria-label="Webhook URL"
                          className="input input-xs input-bordered w-full max-w-xs bg-base-100 font-mono text-xs sm:w-72" />
                        <button className="btn btn-ghost btn-xs" type="submit">{m.webhook_url ? "save" : "+ webhook"}</button>
                      </form>
                    ) : (
                      <Link href="/pricing?reason=webhook" className="mt-1 inline-block font-mono text-[11px] text-base-content/40 hover:text-primary">+ drift webhook (Pro)</Link>
                    )}
                  </td>
                  <td className="hidden sm:table-cell">{m.drift ? <span className="badge badge-sm border-g-d/40 bg-g-d/10 font-mono text-g-d">⚠ {m.verdict || "drift"}</span> : <span className="badge badge-sm border-g-a/35 bg-g-a/10 font-mono text-g-a">stable</span>}</td>
                  <td className="text-right"><Grade score={m.score} grade={m.grade} /></td>
                  <td className="w-12 text-right"><form action={unfollowMonitor}><input type="hidden" name="url" value={m.url} /><button className="btn btn-ghost btn-xs" type="submit" title="Untrack" aria-label="Untrack">✕</button></form></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* API keys */}
      <h2 className="mb-1 mt-10 text-xl font-extrabold">API key</h2>
      <p className="mb-3 text-sm text-base-content/60">For programmatic audits (CI/CD, GitHub Action). The key is shown only once.</p>
      {flash && (
        <div role="alert" className="alert mb-3 border-primary/40 bg-primary/5">
          <div className="w-full">
            <div className="mb-1 font-mono text-xs uppercase tracking-widest text-primary/80">Your new key (copy it now)</div>
            <div className="flex flex-wrap items-center gap-3"><code className="min-w-[15rem] flex-1 break-all font-mono text-primary">{flash}</code><CopyButton text={flash} /></div>
          </div>
        </div>
      )}
      <div className="card border border-base-content/10 bg-base-200/60">
        <div className="card-body gap-3">
          <form action={createApiKey} className="flex gap-2">
            <input name="name" placeholder="name (e.g. ci-prod)" className="input input-sm input-bordered flex-1 bg-base-100 font-mono text-sm" aria-label="Key name" />
            <button className="btn btn-sm" type="submit">+ Generate a key</button>
          </form>
          {keys.map((k) => (
            <div key={k.id} className="flex items-center gap-3 border-t border-base-content/10 pt-3">
              <code className="font-mono text-sm text-base-content/60">{k.prefix}…</code>
              <span className="text-sm text-base-content/50">{k.name}</span>
              <span className="ml-auto font-mono text-xs text-base-content/40">{k.last_used ? "used" : "never used"}</span>
              <form action={deleteApiKey}><input type="hidden" name="id" value={k.id} /><button className="btn btn-ghost btn-xs" type="submit">revoke</button></form>
            </div>
          ))}
        </div>
      </div>

      {/* audit history */}
      <h2 className="mb-3 mt-10 text-xl font-extrabold">My audit history <span className="font-mono text-sm text-base-content/40">({audits.length})</span></h2>
      {audits.length === 0 ? (
        <p className="text-base-content/60">No audits yet. <Link href="/" className="text-primary">Run an audit ›</Link></p>
      ) : (
        <div className="card overflow-hidden border border-base-content/10 bg-base-200/60">
          <table className="table">
            <tbody>
              {audits.map((a) => (
                <tr key={a.url} className="hover:bg-base-100/40">
                  <td><Link href={a.slug ? `/mcp/${a.slug}` : `/report?url=${encodeURIComponent(a.url)}`} className="block"><div className="font-semibold">{a.name || hostOf(a.url)}</div><div className="font-mono text-xs text-base-content/40">{hostOf(a.url)}</div></Link></td>
                  <td className="hidden text-right font-mono text-xs text-base-content/40 sm:table-cell">{new Date(a.created_at).toLocaleDateString("fr-FR")}</td>
                  <td className="text-right"><Grade score={a.score} grade={a.grade} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
