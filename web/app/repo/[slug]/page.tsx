import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import ScoreRing from "../../../components/ScoreRing";
import CopyButton from "../../../components/CopyButton";
import { getRepo } from "../../../lib/api";
import { GRADE_CHIP, gradeKey, REPO_PILLARS, REPO_PILLAR_ORDER } from "../../../lib/format";

export const revalidate = 300;

const progClass = (pct: number) => (pct >= 80 ? "progress-success" : pct >= 55 ? "progress-warning" : "progress-error");

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const r = await getRepo(params.slug);
  if (!r || r.error) return { title: "Unknown MCP repo" };
  const desc = `Repo-Quality Score for ${r.repo}: ${r.score}/100 (grade ${r.grade}). Maintenance, license, adoption, documentation — CheckMCP audit.`;
  return { title: `${r.name || r.repo} — Repo Score ${r.score}/${r.grade}`, description: desc, alternates: { canonical: `https://checkmcp.dev/repo/${params.slug}` }, openGraph: { title: `${r.repo} — Repo Score ${r.score}`, description: desc, url: `https://checkmcp.dev/repo/${params.slug}`, type: "website" } };
}

export default async function RepoPage({ params }: { params: { slug: string } }) {
  const r = await getRepo(params.slug);
  if (!r || r.error) notFound();   // real 404 for unknown repos
  const f = r.facts || {};
  const gk = gradeKey(r.grade);
  const badgeUrl = `/badge/repo/${params.slug}.svg`;
  const badgeMd = `[![Repo Score](https://checkmcp.dev${badgeUrl})](https://checkmcp.dev/repo/${params.slug})`;
  const ld = { "@context": "https://schema.org", "@type": "SoftwareSourceCode", name: r.name || r.repo, codeRepository: `https://github.com/${r.repo}`, aggregateRating: { "@type": "AggregateRating", ratingValue: Math.round((r.score / 20) * 10) / 10, bestRating: 5, worstRating: 0, ratingCount: 1, reviewCount: 1 } };

  return (
    <div className="py-9">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />
      <Link href="/directory?kind=repo" className="mb-4 inline-block font-mono text-xs text-base-content/50 hover:text-base-content">‹ repos</Link>

      <div className="grid animate-rise gap-5">
        <section className="card border border-base-content/10 bg-base-200/60">
          <div className="card-body flex-col gap-6 sm:flex-row sm:items-center">
            <ScoreRing score={r.score} label="REPO SCORE" />
            <div className="min-w-0 flex-1">
              <div className="mb-1 flex flex-wrap items-center gap-3">
                <span className={`grid h-12 w-12 place-items-center rounded-xl border text-2xl font-extrabold font-mono ${GRADE_CHIP[gk]}`}>{r.grade}</span>
                <h1 className="text-3xl font-extrabold">{r.name || r.repo}</h1>
              </div>
              <div className="flex flex-wrap items-center gap-4">
                <a className="font-mono text-xs text-base-content/50 hover:text-base-content" href={`https://github.com/${r.repo}`} target="_blank" rel="noreferrer">github.com/{r.repo} ↗</a>
                {r.mcpizy_slug && <a className="font-mono text-xs text-primary hover:underline" href={`https://mcpizy.com/marketplace/${r.mcpizy_slug}`} target="_blank" rel="noreferrer">📦 install via mcpizy ↗</a>}
              </div>
              {f.description && <p className="mt-2 text-sm text-base-content/60">{f.description}</p>}
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="badge badge-outline badge-sm font-mono">★ {f.stars ?? 0}</span>
                <span className="badge badge-outline badge-sm font-mono">⑂ {f.forks ?? 0}</span>
                <span className="badge badge-outline badge-sm font-mono">{f.license || "no license"}</span>
                <span className="badge badge-outline badge-sm font-mono">push {f.pushed_days ?? "?"}d</span>
                {f.archived && <span className="badge badge-sm border-g-f/40 bg-g-f/10 font-mono text-g-f">archived</span>}
              </div>
              {r.floor && <div role="alert" className="alert alert-error mt-3 py-2 text-sm">⚠️ Score capped — <b>floor: {r.floor}</b>.</div>}
            </div>
          </div>
        </section>

        <section className="card border border-base-content/10 bg-base-200/60">
          <div className="card-body">
            <h2 className="font-mono text-xs uppercase tracking-widest text-primary/80">Score by pillar</h2>
            <div className="mt-2">
              {REPO_PILLAR_ORDER.filter((k) => k in (r.pillars || {})).map((k) => {
                const pct = (r.pillars[k] / REPO_PILLARS[k].weight) * 100;
                return (
                  <div key={k} className="grid grid-cols-[8rem_1fr_3rem] items-center gap-3 py-1.5">
                    <span className="font-mono text-xs text-base-content/60">{REPO_PILLARS[k].label} <span className="text-base-content/30">·{REPO_PILLARS[k].weight}</span></span>
                    <progress className={`progress ${progClass(pct)} h-1.5`} value={pct} max={100} />
                    <span className="text-right font-mono text-sm">{r.pillars[k]}/{REPO_PILLARS[k].weight}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {r.findings && r.findings.length > 0 && (
          <section className="card border border-base-content/10 bg-base-200/60">
            <div className="card-body">
              <h2 className="font-mono text-xs uppercase tracking-widest text-primary/80">Why this score — attribution</h2>
              <div className="mt-2 grid gap-3">
                {r.findings.map((x: any, i: number) => (
                  <div key={i} className="rounded-box border border-base-content/10 border-l-2 border-l-primary/50 bg-base-100/40 p-4">
                    <div className="mb-1.5 flex items-center justify-between gap-2">
                      <span className="badge badge-sm badge-ghost font-mono">{REPO_PILLARS[x.pillar]?.label || x.pillar} · {x.severity}</span>
                      <span className="font-mono font-bold text-g-f">−{x.delta}</span>
                    </div>
                    <p className="text-sm text-base-content/70"><b className="text-base-content">{x.measured}</b> → {x.mechanism} → <span className="text-g-d">{x.effect}</span></p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        <section className="card border border-base-content/10 bg-base-200/60">
          <div className="card-body">
            <h2 className="font-mono text-xs uppercase tracking-widest text-primary/80">Repo Score badge</h2>
            <div className="flex flex-wrap items-center gap-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={badgeUrl} alt={`Repo Score badge — ${r.repo}`} height={20} className="h-5" />
              <code className="min-w-[15rem] flex-1 break-all font-mono text-xs text-base-content/50">{badgeMd}</code>
              <CopyButton text={badgeMd} label="Copy markdown" />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
