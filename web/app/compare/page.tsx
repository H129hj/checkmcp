import type { Metadata } from "next";
import Link from "next/link";
import { hreflang } from "../../lib/i18n";
import { COMPARISONS } from "../../lib/compare";

export const revalidate = 600;

export const metadata: Metadata = {
  title: "MCP Server Comparisons — Head-to-Head, Audited",
  description:
    "Side-by-side MCP server comparisons: security grade, capabilities and context-cost, scored by the same independent CheckMCP audit. Find which MCP server wins for your use case.",
  alternates: { canonical: "/compare", languages: hreflang("/compare") },
};

export default function CompareIndex() {
  const itemList = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "MCP server comparisons",
    numberOfItems: COMPARISONS.length,
    itemListElement: COMPARISONS.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: `https://checkmcp.dev/compare/${c.slug}`,
      name: c.targetQuery,
    })),
  };

  return (
    <div className="py-14">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemList) }} />
      <div className="font-mono text-xs uppercase tracking-[0.22em] text-primary/80">Comparisons</div>
      <h1 className="mb-2 mt-3 text-4xl font-extrabold">MCP Server Comparisons</h1>
      <p className="mb-8 max-w-2xl text-lg text-base-content/60">
        Head-to-head MCP server match-ups — both sides scored by the same independent{" "}
        <Link href="/learn/mcp-score" className="text-primary hover:underline">CheckMCP</Link> audit, so the numbers are directly comparable.
      </p>

      {COMPARISONS.length === 0 ? (
        <p className="text-base-content/50">Comparisons are being generated. <Link href="/directory" className="text-primary">Browse the directory ›</Link></p>
      ) : (
        <div className="grid gap-2.5 sm:grid-cols-2">
          {COMPARISONS.map((c) => (
            <Link
              key={c.slug}
              href={`/compare/${c.slug}`}
              className="card border border-base-content/10 bg-base-200/60 p-4 transition hover:border-primary/40 hover:bg-base-100/40"
            >
              <div className="font-semibold capitalize">{c.targetQuery}</div>
              <div className="mt-1 font-mono text-xs text-base-content/45">compare ›</div>
            </Link>
          ))}
        </div>
      )}

      <div className="mt-10 text-sm text-base-content/50">
        See also: <Link href="/best" className="text-primary hover:underline">best-of collections</Link> ·{" "}
        <Link href="/directory" className="text-primary hover:underline">full directory</Link>
      </div>
    </div>
  );
}
