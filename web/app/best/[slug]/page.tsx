import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import ServerFaq from "../../../components/ServerFaq";
import { GRADE_CHIP, gradeKey } from "../../../lib/format";
import { hreflang } from "../../../lib/i18n";
import { COLLECTIONS, getCollection, resolveCollection, collectionFaq, rankBasis } from "../../../lib/collections";

export const revalidate = 600;

export function generateStaticParams() {
  return COLLECTIONS.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const c = getCollection(params.slug);
  if (!c) return { title: "Collection not found" };
  const desc = `${c.blurb} Ranked by CheckMCP's independent MCP Score (security, quality, context-cost). Updated continuously.`;
  return {
    title: `${c.title} (Audited & Ranked)`,
    description: desc,
    alternates: { canonical: `/best/${c.slug}`, languages: hreflang(`/best/${c.slug}`) },
    openGraph: { title: c.title, description: desc, url: `https://checkmcp.dev/best/${c.slug}`, type: "website" },
  };
}

function ScoreCell({ score, grade }: { score: number; grade: string }) {
  const gk = gradeKey(grade);
  return (
    <div className="inline-flex items-center gap-2">
      <span className="font-mono font-bold">{score}</span>
      <span className={`grid h-8 w-8 place-items-center rounded-lg border font-mono text-sm font-bold ${GRADE_CHIP[gk]}`}>{grade}</span>
    </div>
  );
}

export default async function CollectionPage({ params }: { params: { slug: string } }) {
  const c = getCollection(params.slug);
  if (!c) notFound();
  const ranked = await resolveCollection(c);
  if (!ranked.length) notFound(); // no soft-404 for an empty list
  const faq = collectionFaq(c, ranked);
  const basis = rankBasis(c.slug);

  const itemList = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: c.title,
    description: c.blurb,
    numberOfItems: ranked.length,
    itemListElement: ranked.map((e, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: `https://checkmcp.dev${e.href}`,
      name: e.name,
    })),
  };
  const breadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Collections", item: "https://checkmcp.dev/best" },
      { "@type": "ListItem", position: 2, name: c.title, item: `https://checkmcp.dev/best/${c.slug}` },
    ],
  };

  return (
    <div className="py-14">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemList) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }} />

      <Link href="/best" className="mb-4 inline-block font-mono text-xs text-base-content/50 hover:text-base-content">‹ all collections</Link>
      <div className="font-mono text-xs uppercase tracking-[0.22em] text-primary/80">Ranked collection</div>
      <h1 className="mb-2 mt-3 text-4xl font-extrabold">{c.title}</h1>
      <p className="mb-5 max-w-2xl text-lg text-base-content/60">{c.blurb}</p>
      <p className="mb-6 max-w-2xl text-sm text-base-content/50">
        {ranked.length} {ranked.length === 1 ? "server" : "servers"}, ranked by{" "}
        {basis === "stars" ? (
          "GitHub stars"
        ) : (
          <>independent <Link href="/learn/mcp-score" className="text-primary hover:underline">MCP Score</Link></>
        )}. Click any to see its full security &amp; quality audit.
      </p>

      <div className="card overflow-hidden border border-base-content/10 bg-base-200/60">
        <table className="table">
          <tbody>
            {ranked.map((e, i) => (
              <tr key={e.href} className="hover:bg-base-100/40">
                <td className="w-10 font-mono text-base-content/30">{String(i + 1).padStart(2, "0")}</td>
                <td>
                  <Link href={e.href} className="block">
                    <div className="font-semibold">{e.name}</div>
                    <div className="font-mono text-xs text-base-content/40">{e.host}</div>
                  </Link>
                </td>
                <td className="hidden md:table-cell">
                  <div className="flex flex-wrap gap-1.5">
                    <span className="badge badge-outline badge-sm font-mono">{e.kind === "server" ? "● live" : "◆ repo"}</span>
                    <span className="badge badge-outline badge-sm font-mono">{e.meta}</span>
                  </div>
                </td>
                <td className="text-right"><ScoreCell score={e.score} grade={e.grade} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ServerFaq items={faq} heading={`${c.title} — FAQ`} />

      <div className="mt-8 text-sm text-base-content/50">
        Browse more: <Link href="/best" className="text-primary hover:underline">all collections</Link> ·{" "}
        <Link href="/directory" className="text-primary hover:underline">full directory</Link> ·{" "}
        <Link href="/compare" className="text-primary hover:underline">head-to-head comparisons</Link>
      </div>
    </div>
  );
}
