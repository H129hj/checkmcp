import Link from "next/link";
import { getMonitors, getRuns } from "../../lib/api";
import { GRADE_CHIP, gradeKey, hostOf, GRADE_STROKE, scoreKey } from "../../lib/format";

export const revalidate = 0;
export const metadata = {
  title: "Monitoring — MCP server drift & rug-pull",
  description: "Continuous monitoring of tracked MCP servers: tool-definition drift (rug-pull), score over time.",
};

function Sparkline({ scores }: { scores: number[] }) {
  if (scores.length < 2) return <span className="font-mono text-xs text-base-content/30">—</span>;
  const w = 110, h = 26;
  const pts = scores.map((s, i) => `${((i / (scores.length - 1)) * w).toFixed(1)},${(h - (s / 100) * h).toFixed(1)}`).join(" ");
  return <svg width={w} height={h} aria-hidden><polyline points={pts} fill="none" stroke={GRADE_STROKE[scoreKey(scores[scores.length - 1])]} strokeWidth={1.6} strokeLinejoin="round" strokeLinecap="round" /></svg>;
}

export default async function Dashboard() {
  const monitors = await getMonitors();
  const withRuns = await Promise.all(monitors.map(async (m: any) => ({ m, runs: await getRuns(m.url, 40) })));

  return (
    <div className="py-14">
      <div className="font-mono text-xs uppercase tracking-[0.22em] text-primary/80">Continuous monitoring</div>
      <h1 className="mb-2 mt-3 text-4xl font-extrabold">Drift &amp; rug-pull</h1>
      <p className="mb-6 max-w-2xl text-lg text-base-content/60">
        Tracked servers are re-probed periodically. We pin a hash of the tool definitions (Tool Pinning): any post-approval mutation triggers an alert. {monitors.length} server{monitors.length > 1 ? "s" : ""} monitored.
      </p>

      {withRuns.length === 0 ? (
        <div className="card border border-base-content/10 bg-base-200/60"><div className="card-body items-center"><p className="text-base-content/60">No tracked servers. Open a report and click <b className="text-base-content">+ Track this server</b>, or <Link href="/" className="text-primary">audit a URL ›</Link></p></div></div>
      ) : (
        <div className="card overflow-hidden border border-base-content/10 bg-base-200/60">
          <table className="table">
            <tbody>
              {withRuns.map(({ m, runs }) => {
                const last = runs[0];
                const series = runs.slice().reverse().map((r: any) => r.score).filter((s: any) => typeof s === "number");
                return (
                  <tr key={m.url} className="hover:bg-base-100/40">
                    <td><div className="font-semibold">{m.label || m.name || hostOf(m.url)}</div><div className="font-mono text-xs text-base-content/40">{hostOf(m.url)} · {m.tool_count ?? "?"} pinned tools</div></td>
                    <td className="hidden md:table-cell"><Sparkline scores={series} /></td>
                    <td>{last?.drift ? <span className="badge badge-sm border-g-d/40 bg-g-d/10 font-mono text-g-d">⚠ {last?.verdict || "drift"}</span> : <span className="badge badge-sm border-g-a/35 bg-g-a/10 font-mono text-g-a">stable</span>}</td>
                    <td className="text-right">
                      {typeof last?.score === "number"
                        ? <span className="inline-flex items-center gap-2"><span className="font-mono font-bold">{last.score}</span><span className={`grid h-7 w-7 place-items-center rounded-lg border font-mono text-xs font-bold ${GRADE_CHIP[gradeKey(last.grade)]}`}>{last.grade}</span></span>
                        : <span className="font-mono text-xs text-base-content/40">pending</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
