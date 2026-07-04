import type { Metadata } from "next";
import Link from "next/link";
import { LEARN } from "../../lib/learn";

export const metadata: Metadata = {
  title: "Learn — MCP security & quality concepts | CheckMCP",
  description:
    "Plain-English guides to MCP server security and quality: tool poisoning, the lethal trifecta, rug pulls, context cost, the MCP Score, and more.",
  alternates: { canonical: "https://checkmcp.dev/learn" },
};

const LIST_LD = {
  "@context": "https://schema.org",
  "@type": "ItemList",
  itemListElement: LEARN.map((p, i) => ({
    "@type": "ListItem",
    position: i + 1,
    name: p.term,
    url: `https://checkmcp.dev/learn/${p.slug}`,
  })),
};

export default function LearnIndex() {
  return (
    <div className="py-9">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(LIST_LD) }} />
      <div className="max-w-2xl animate-rise">
        <div className="font-mono text-xs uppercase tracking-[0.22em] text-primary/80">Learn</div>
        <h1 className="mt-3 text-[clamp(2rem,5vw,3.25rem)] font-extrabold leading-tight">MCP security &amp; quality, explained</h1>
        <p className="mt-4 text-lg text-base-content/60">
          The concepts behind the MCP Score — what they mean, why they matter, and how CheckMCP measures them.
        </p>
      </div>
      <div className="mt-8 grid gap-3 sm:grid-cols-2">
        {LEARN.map((p) => (
          <Link key={p.slug} href={`/learn/${p.slug}`} className="card border border-base-content/10 bg-base-200/60 transition hover:border-primary/40">
            <div className="card-body p-5">
              <h2 className="text-lg font-extrabold">{p.term}</h2>
              <p className="text-sm leading-relaxed text-base-content/60">{p.answer}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
