import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import Report from "../../../components/Report";
import ServerFaq from "../../../components/ServerFaq";
import { getDirectory, getScore } from "../../../lib/api";
import { mcpFaq } from "../../../lib/faq";
import { fmtTokens, hostOf } from "../../../lib/format";

export const revalidate = 300;

async function resolve(slug: string) {
  const dir = await getDirectory("recent", 500);
  const row = dir.find((d) => d.slug === slug);
  if (!row) return null;
  const res = await getScore(row.url, true);   // cached: read stored audit, no live re-probe
  return res && !res.error ? res : null;
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const res = await resolve(params.slug);
  if (!res) return { title: "Unknown MCP server" };
  const name = res.server?.name || hostOf(res.url);
  const desc = `MCP Score for ${name}: ${res.score}/100 (grade ${res.grade}). ${res.facts?.tools} tools, ~${fmtTokens(res.facts?.tools_list_tokens)} context tokens. Quality/security/cost audit by CheckMCP.`;
  return {
    title: `${name} — MCP Score ${res.score}/${res.grade}`,
    description: desc,
    alternates: { canonical: `https://checkmcp.dev/mcp/${params.slug}` },
    openGraph: { title: `${name} — MCP Score ${res.score}`, description: desc, url: `https://checkmcp.dev/mcp/${params.slug}`, type: "website" },
  };
}

export default async function McpPage({ params }: { params: { slug: string } }) {
  const res = await resolve(params.slug);
  if (!res) notFound();   // real 404 for unknown/removed servers (no soft-404, not indexable)
  const name = res.server?.name || hostOf(res.url);
  const ld = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: `${name} (serveur MCP)`,
    applicationCategory: "DeveloperApplication",
    operatingSystem: "MCP",
    url: res.url,
    aggregateRating: { "@type": "AggregateRating", ratingValue: Math.round((res.score / 20) * 10) / 10, bestRating: 5, worstRating: 0, ratingCount: 1, reviewCount: 1 },
  };
  return (
    <div className="py-9">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />
      <Link href="/directory" className="mb-4 inline-block font-mono text-xs text-base-content/50 hover:text-base-content">‹ directory</Link>
      <Report res={res} />
      <ServerFaq items={mcpFaq(res)} heading={`About ${name} — FAQ`} />
    </div>
  );
}
