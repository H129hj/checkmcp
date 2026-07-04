import type { Metadata } from "next";
import Link from "next/link";
import { hreflang } from "../../lib/i18n";
import { COLLECTIONS } from "../../lib/collections";

export const revalidate = 600;

export const metadata: Metadata = {
  title: "Best MCP Servers by Category — Audited & Ranked",
  description:
    "Curated, independently-audited rankings of the best and safest MCP servers — by use case (databases, web scraping, browser automation, search, GitHub…) and by quality. Every server scored 0–100 by CheckMCP.",
  alternates: { canonical: "/best", languages: hreflang("/best") },
};

export default function BestIndex() {
  const itemList = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "MCP server collections",
    numberOfItems: COLLECTIONS.length,
    itemListElement: COLLECTIONS.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: `https://checkmcp.dev/best/${c.slug}`,
      name: c.title,
    })),
  };

  return (
    <div className="py-14">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemList) }} />
      <div className="font-mono text-xs uppercase tracking-[0.22em] text-primary/80">Collections</div>
      <h1 className="mb-2 mt-3 text-4xl font-extrabold">Best MCP Servers, by Category</h1>
      <p className="mb-8 max-w-2xl text-lg text-base-content/60">
        Independently-audited rankings of MCP servers — grouped by use case and by quality. Every server is scored 0–100 by{" "}
        <Link href="/learn/mcp-score" className="text-primary hover:underline">CheckMCP</Link>; no vendor pays for placement.
      </p>

      {COLLECTIONS.length === 0 ? (
        <p className="text-base-content/50">Collections are being generated. <Link href="/directory" className="text-primary">Browse the full directory ›</Link></p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {COLLECTIONS.map((c) => (
            <Link
              key={c.slug}
              href={`/best/${c.slug}`}
              className="card border border-base-content/10 bg-base-200/60 p-5 transition hover:border-primary/40 hover:bg-base-100/40"
            >
              <div className="font-bold">{c.title}</div>
              <div className="mt-1 text-sm text-base-content/55">{c.blurb}</div>
              <div className="mt-3 font-mono text-xs text-primary/70">{c.serverSlugs.length + c.repoSlugs.length} servers ›</div>
            </Link>
          ))}
        </div>
      )}

      <div className="mt-10 text-sm text-base-content/50">
        See also: <Link href="/compare" className="text-primary hover:underline">head-to-head comparisons</Link> ·{" "}
        <Link href="/directory" className="text-primary hover:underline">full directory</Link> ·{" "}
        <Link href="/learn" className="text-primary hover:underline">MCP security concepts</Link>
      </div>
    </div>
  );
}
