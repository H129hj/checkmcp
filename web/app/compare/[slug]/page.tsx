import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import ServerFaq from "../../../components/ServerFaq";
import { GRADE_CHIP, gradeKey, fmtTokens } from "../../../lib/format";
import { hreflang } from "../../../lib/i18n";
import { COMPARISONS, getComparison, resolveComparison, comparisonFaq, type CmpSide } from "../../../lib/compare";

export const revalidate = 600;

export function generateStaticParams() {
  return COMPARISONS.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const c = getComparison(params.slug);
  if (!c) return { title: "Comparison not found" };
  const rc = await resolveComparison(c);
  if (!rc) return { title: "Comparison not found" };
  const desc = `${rc.a.name} vs ${rc.b.name}: side-by-side MCP Score, security grade and capabilities, audited by CheckMCP. ${rc.a.name} ${rc.a.score}/100 vs ${rc.b.name} ${rc.b.score}/100.`;
  return {
    title: `${rc.a.name} vs ${rc.b.name} — MCP Server Comparison`,
    description: desc,
    alternates: { canonical: `/compare/${c.slug}`, languages: hreflang(`/compare/${c.slug}`) },
    openGraph: { title: `${rc.a.name} vs ${rc.b.name} (MCP comparison)`, description: desc, url: `https://checkmcp.dev/compare/${c.slug}`, type: "website" },
  };
}

function Gem({ score, grade }: { score: number; grade: string }) {
  const gk = gradeKey(grade);
  return (
    <div className="flex items-center gap-2">
      <span className="font-mono text-2xl font-bold">{score}</span>
      <span className={`grid h-9 w-9 place-items-center rounded-lg border font-mono font-bold ${GRADE_CHIP[gk]}`}>{grade}</span>
    </div>
  );
}

function Side({ s, win }: { s: CmpSide; win: boolean }) {
  return (
    <div className={`card border bg-base-200/60 p-5 ${win ? "border-primary/50" : "border-base-content/10"}`}>
      {win && <div className="mb-2 inline-block w-fit rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest text-primary">higher score</div>}
      <Link href={s.href} className="block">
        <div className="text-lg font-bold hover:text-primary">{s.name}</div>
        <div className="font-mono text-xs text-base-content/40">{s.host}</div>
      </Link>
      <div className="mt-3"><Gem score={s.score} grade={s.grade} /></div>
      <div className="mt-4 flex flex-wrap gap-1.5">
        <span className="badge badge-outline badge-sm font-mono">{s.kind === "server" ? "● live endpoint" : "◆ repo / stdio"}</span>
        {s.kind === "server" ? (
          <>
            <span className="badge badge-outline badge-sm font-mono">{s.facts?.tools ?? "?"} tools</span>
            <span className="badge badge-outline badge-sm font-mono">~{fmtTokens(s.facts?.tools_list_tokens)} tok</span>
            {s.facts?.lethal_trifecta ? <span className="badge badge-sm border-g-f/40 bg-g-f/10 font-mono text-g-f">lethal trifecta</span> : null}
          </>
        ) : (
          <>
            <span className="badge badge-outline badge-sm font-mono">★ {s.facts?.stars ?? 0}</span>
            <span className="badge badge-outline badge-sm font-mono">{s.facts?.license || "no license"}</span>
            {s.facts?.archived ? <span className="badge badge-sm border-g-f/40 bg-g-f/10 font-mono text-g-f">archived</span> : null}
          </>
        )}
      </div>
      <Link href={s.href} className="mt-4 inline-block font-mono text-xs text-primary hover:underline">full audit ›</Link>
    </div>
  );
}

export default async function ComparePage({ params }: { params: { slug: string } }) {
  const c = getComparison(params.slug);
  if (!c) notFound();
  const rc = await resolveComparison(c);
  if (!rc) notFound();
  const { a, b, winner } = rc;
  const faq = comparisonFaq(rc);

  const breadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Comparisons", item: "https://checkmcp.dev/compare" },
      { "@type": "ListItem", position: 2, name: `${a.name} vs ${b.name}`, item: `https://checkmcp.dev/compare/${c.slug}` },
    ],
  };

  return (
    <div className="py-14">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }} />
      <Link href="/compare" className="mb-4 inline-block font-mono text-xs text-base-content/50 hover:text-base-content">‹ all comparisons</Link>
      <div className="font-mono text-xs uppercase tracking-[0.22em] text-primary/80">Head-to-head</div>
      <h1 className="mb-2 mt-3 text-4xl font-extrabold">{a.name} <span className="text-base-content/40">vs</span> {b.name}</h1>
      <p className="mb-6 max-w-2xl text-lg text-base-content/60">
        Side-by-side MCP audit — security grade, capabilities and context-cost, scored by the same independent{" "}
        <Link href="/learn/mcp-score" className="text-primary hover:underline">CheckMCP</Link> audit so the numbers are directly comparable.
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        <Side s={a} win={winner === "a"} />
        <Side s={b} win={winner === "b"} />
      </div>

      <div className="mt-5 card border border-base-content/10 bg-base-200/60 p-5">
        <div className="font-mono text-xs uppercase tracking-widest text-primary/80">Verdict</div>
        <p className="mt-2 text-sm leading-relaxed text-base-content/70">{faq[0].a}</p>
      </div>

      {/* Single FAQPage: ServerFaq renders every Q&A visibly and emits the only FAQPage JSON-LD.
          faq[0] also appears as the Verdict card above — visible, so no hidden-answer schema. */}
      <ServerFaq items={faq} heading="Comparison FAQ" />

      <div className="mt-8 text-sm text-base-content/50">
        More: <Link href="/compare" className="text-primary hover:underline">all comparisons</Link> ·{" "}
        <Link href="/best" className="text-primary hover:underline">best-of collections</Link> ·{" "}
        <Link href="/directory" className="text-primary hover:underline">full directory</Link>
      </div>
    </div>
  );
}
