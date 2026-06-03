import { redirect } from "next/navigation";
import Link from "next/link";
import { getUser } from "../../lib/auth";
import { q } from "../../lib/db";
import { GRADE_CHIP, gradeKey, hostOf } from "../../lib/format";
import { planOf } from "../../lib/plans";

export const metadata = { title: "MCP fleet — risk posture" };
export const dynamic = "force-dynamic";

function Spark({ scores }: { scores: number[] }) {
  if (!scores || scores.length < 2) return <span className="font-mono text-xs text-base-content/30">—</span>;
  const w = 96, h = 26, max = 100, min = 0;
  const pts = scores.map((s, i) => {
    const x = (i / (scores.length - 1)) * w;
    const y = h - ((s - min) / (max - min)) * h;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  const last = scores[scores.length - 1];
  const col = last >= 80 ? "#22c55e" : last >= 70 ? "#eab308" : last >= 55 ? "#f97316" : "#ef4444";
  return (
    <svg width={w} height={h} className="overflow-visible">
      <polyline points={pts} fill="none" stroke={col} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function EvalBadge({ v }: { v?: string | null }) {
  if (!v || v === "clean") return null;
  const map: Record<string, string> = {
    malicious: "border-g-f/40 bg-g-f/10 text-g-f",
    suspicious: "border-g-c/40 bg-g-c/10 text-g-c",
    inconclusive: "border-base-content/20 text-base-content/50",
  };
  return <span className={`badge badge-sm font-mono ${map[v] || map.inconclusive}`}>eval: {v}</span>;
}

export default async function Fleet() {
  const user = await getUser();
  if (!user) redirect("/login");
  const plan = planOf(user.plan);

  const rows = await q<any>(
    `SELECT um.url, um.label, um.min_score, um.webhook_url,
            m.tool_count, m.last_eval_verdict,
            r.score, r.grade, r.drift, r.verdict, r.created_at AS last_run,
            a.name, a.slug
       FROM user_monitors um
       LEFT JOIN monitors m ON m.url = um.url
       LEFT JOIN audits a ON a.url = um.url
       LEFT JOIN LATERAL (SELECT score, grade, drift, verdict, created_at FROM runs WHERE runs.url = um.url ORDER BY created_at DESC LIMIT 1) r ON true
      WHERE um.user_id = $1 ORDER BY um.created_at DESC`, [user.id]);

  const urls = rows.map((r) => r.url);
  const hist = urls.length
    ? await q<any>(`SELECT url, score FROM runs WHERE url = ANY($1) AND score IS NOT NULL ORDER BY created_at ASC`, [urls])
    : [];
  const sparks: Record<string, number[]> = {};
  for (const h of hist) (sparks[h.url] ||= []).push(Number(h.score));

  const eff = (r: any) => (typeof r.score === "number" ? r.score : (typeof r.a_score === "number" ? r.a_score : null));
  const grOf = (r: any) => r.grade || null;
  const atRisk = rows.filter((r) => ["D", "F"].includes(grOf(r)) || r.drift || r.last_eval_verdict === "malicious").length;
  const drifted = rows.filter((r) => r.drift).length;
  const malicious = rows.filter((r) => r.last_eval_verdict === "malicious").length;

  return (
    <div className="py-12">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="font-mono text-xs uppercase tracking-[0.22em] text-primary/80">Fleet</div>
          <h1 className="mt-2 text-3xl font-extrabold">MCP fleet — risk posture</h1>
          <p className="mt-1 text-sm text-base-content/60">Continuous monitoring of the MCP servers you depend on. Re-checked every ~30 min; behavioral re-eval on drift.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/gateways" className="btn btn-outline btn-sm">Gateway ›</Link>
          <Link href="/policy" className="btn btn-outline btn-sm">Governance ›</Link>
          <Link href="/account" className="btn btn-ghost btn-sm">My space ›</Link>
        </div>
      </div>

      {/* summary */}
      <div className="mt-7 grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { k: "Tracked", v: rows.length, sub: `${rows.length}/${plan.monitors} on ${plan.name}`, tone: "" },
          { k: "At risk", v: atRisk, sub: "grade D/F, drift or malicious", tone: atRisk ? "text-g-d" : "text-g-a" },
          { k: "Drifted", v: drifted, sub: "tool set changed since baseline", tone: drifted ? "text-g-d" : "text-g-a" },
          { k: "Malicious (runtime)", v: malicious, sub: "behavioral eval flagged", tone: malicious ? "text-g-f" : "text-g-a" },
        ].map((c) => (
          <div key={c.k} className="card border border-base-content/10 bg-base-200/60">
            <div className="card-body gap-1 p-4">
              <div className="font-mono text-xs uppercase tracking-widest text-base-content/40">{c.k}</div>
              <div className={`text-3xl font-extrabold ${c.tone}`}>{c.v}</div>
              <div className="text-xs text-base-content/40">{c.sub}</div>
            </div>
          </div>
        ))}
      </div>

      {/* table */}
      <h2 className="mb-3 mt-9 text-xl font-extrabold">Servers</h2>
      {rows.length === 0 ? (
        <p className="text-base-content/60">No tracked servers. Add one from your <Link href="/account" className="text-primary">space</Link> or any report (“Track this server”).</p>
      ) : (
        <div className="card overflow-hidden border border-base-content/10 bg-base-200/60">
          <table className="table">
            <thead>
              <tr className="text-xs uppercase text-base-content/40">
                <th>Server</th><th className="hidden sm:table-cell">Status</th><th className="hidden md:table-cell">History</th><th className="text-right">Score</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.url} className="hover:bg-base-100/40">
                  <td>
                    <Link href={r.slug ? `/mcp/${r.slug}` : `/report?url=${encodeURIComponent(r.url)}`} className="block">
                      <div className="font-semibold">{r.label || r.name || hostOf(r.url)}</div>
                      <div className="font-mono text-xs text-base-content/40">{hostOf(r.url)} · min {r.min_score ?? "—"}{r.webhook_url ? " · 🔔" : ""}</div>
                    </Link>
                  </td>
                  <td className="hidden sm:table-cell">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {r.drift
                        ? <span className="badge badge-sm border-g-d/40 bg-g-d/10 font-mono text-g-d">⚠ {r.verdict || "drift"}</span>
                        : <span className="badge badge-sm border-g-a/35 bg-g-a/10 font-mono text-g-a">stable</span>}
                      <EvalBadge v={r.last_eval_verdict} />
                    </div>
                  </td>
                  <td className="hidden md:table-cell"><Spark scores={sparks[r.url] || []} /></td>
                  <td className="text-right">
                    {typeof r.score === "number"
                      ? <span className="inline-flex items-center gap-2"><span className="font-mono font-bold">{r.score}</span><span className={`grid h-7 w-7 place-items-center rounded-lg border font-mono text-xs font-bold ${GRADE_CHIP[gradeKey(r.grade)]}`}>{r.grade}</span></span>
                      : <span className="font-mono text-xs text-base-content/40">pending</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
