import Link from "next/link";
import { getDirectory, getRepos } from "../../lib/api";
import { GRADE_CHIP, gradeKey, hostOf, fmtTokens } from "../../lib/format";
import { hreflang } from "../../lib/i18n";

export const revalidate = 60;
export const metadata = {
  title: "MCP Server Directory & Registry — Audited & Ranked",
  description:
    "The MCP server directory and registry: Model Context Protocol servers independently audited and ranked — live MCP Score for endpoints, Repo-Quality Score for repo/stdio. Browse the full list by security, quality and popularity.",
  alternates: { canonical: "/directory", languages: hreflang("/directory") },
};

function ScoreCell({ score, grade }: { score: number; grade: string }) {
  const gk = gradeKey(grade);
  return (
    <div className="inline-flex items-center gap-2">
      <span className="font-mono font-bold">{score}</span>
      <span className={`grid h-8 w-8 place-items-center rounded-lg border font-mono text-sm font-bold ${GRADE_CHIP[gk]}`}>{grade}</span>
    </div>
  );
}

export default async function Directory({ searchParams }: { searchParams: { order?: string; kind?: string } }) {
  const order = searchParams.order === "recent" ? "recent" : searchParams.order === "stars" ? "stars" : "score";
  const kind = searchParams.kind === "repo" ? "repo" : "live";
  const live = kind === "live" ? await getDirectory(order === "stars" ? "score" : order, 300) : [];
  const repos = kind === "repo" ? await getRepos(order, 300) : [];
  const count = kind === "live" ? live.length : repos.length;
  const tab = (k: string, label: string) => <Link href={`/directory?kind=${k}`} role="tab" className={`tab ${kind === k ? "tab-active" : ""}`}>{label}</Link>;
  const ord = (o: string, label: string) => <Link href={`/directory?kind=${kind}&order=${o}`} className={`badge ${order === o ? "badge-primary" : "badge-outline"} badge-sm font-mono`}>{label}</Link>;

  return (
    <div className="py-14">
      <div className="font-mono text-xs uppercase tracking-[0.22em] text-primary/80">Public directory</div>
      <h1 className="mb-2 mt-3 text-4xl font-extrabold">Audited MCP servers</h1>
      <p className="mb-5 max-w-2xl text-lg text-base-content/60">
        {kind === "live"
          ? "Live MCP Score — servers with a reachable remote endpoint, audited by probe (quality, security, context-cost)."
          : "Repo-Quality Score — servers shipped as repo/stdio (npx), scored on repository quality (maintenance, license, adoption, docs)."}{" "}
        {count} {count === 1 ? "entry" : "entries"}.
      </p>

      <div role="tablist" className="tabs tabs-boxed mb-4 w-fit bg-base-200/60">
        {tab("live", "● Live (endpoints)")}
        {tab("repo", "◆ Repos (mcpizy)")}
      </div>
      <div className="mb-5 flex flex-wrap gap-2">
        {ord("score", "by score")}
        {ord("recent", "recent")}
        {kind === "repo" && ord("stars", "by stars")}
      </div>

      {count === 0 ? (
        <div className="card border border-base-content/10 bg-base-200/60"><div className="card-body items-center"><p className="text-base-content/50">No audits here. <Link href="/" className="text-primary">Run an audit ›</Link></p></div></div>
      ) : (
        <div className="card overflow-hidden border border-base-content/10 bg-base-200/60">
          <table className="table">
            <tbody>
              {kind === "live"
                ? live.map((s, i) => (
                    <tr key={s.url} className="hover:bg-base-100/40">
                      <td className="w-10 font-mono text-base-content/30">{String(i + 1).padStart(2, "0")}</td>
                      <td><Link href={`/mcp/${s.slug}`} className="block"><div className="font-semibold">{s.name || hostOf(s.url)}</div><div className="font-mono text-xs text-base-content/40">{hostOf(s.url)}</div></Link></td>
                      <td className="hidden md:table-cell">
                        <div className="flex flex-wrap gap-1.5">
                          <span className="badge badge-outline badge-sm font-mono">{s.facts?.tools ?? "?"} tools</span>
                          <span className="badge badge-outline badge-sm font-mono">~{fmtTokens(s.facts?.tools_list_tokens)} tok</span>
                          {s.floor ? <span className="badge badge-sm border-g-f/40 bg-g-f/10 font-mono text-g-f">floor</span> : null}
                        </div>
                      </td>
                      <td className="text-right"><ScoreCell score={s.score} grade={s.grade} /></td>
                    </tr>
                  ))
                : repos.map((s, i) => (
                    <tr key={s.repo} className="hover:bg-base-100/40">
                      <td className="w-10 font-mono text-base-content/30">{String(i + 1).padStart(2, "0")}</td>
                      <td><Link href={`/repo/${s.slug}`} className="block"><div className="font-semibold">{s.name || s.repo}</div><div className="font-mono text-xs text-base-content/40">{s.repo}</div></Link></td>
                      <td className="hidden md:table-cell">
                        <div className="flex flex-wrap gap-1.5">
                          <span className="badge badge-outline badge-sm font-mono">★ {s.facts?.stars ?? 0}</span>
                          <span className="badge badge-outline badge-sm font-mono">{s.facts?.license || "no license"}</span>
                          {s.floor ? <span className="badge badge-sm border-g-f/40 bg-g-f/10 font-mono text-g-f">{s.floor}</span> : null}
                        </div>
                      </td>
                      <td className="text-right"><ScoreCell score={s.score} grade={s.grade} /></td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
