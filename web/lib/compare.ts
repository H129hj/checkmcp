// Head-to-head comparison pages ("A vs B MCP server") — long-tail, high-intent. Data-driven:
// the curated pairs come from the checkmcp-progseo workflow (compare-data.ts); this module
// resolves each side against the live audit API and computes a verdict.
import { getDirectoryOrNull, getReposOrNull } from "./api";
import { hostOf } from "./format";
import type { FaqItem } from "./faq";
import { COMPARISONS_DATA } from "./compare-data";

export interface ComparisonData {
  slug: string;        // "${aSlug}-vs-${bSlug}"
  aSlug: string;
  bSlug: string;
  aType: "server" | "repo";
  bType: "server" | "repo";
  targetQuery: string;
  rationale: string;
}

export const COMPARISONS: ComparisonData[] = COMPARISONS_DATA;
export const getComparison = (slug: string) => COMPARISONS.find((c) => c.slug === slug);

export interface CmpSide {
  kind: "server" | "repo";
  slug: string;
  name: string;
  host: string;
  score: number;
  grade: string;
  href: string;
  facts: any;
  pillars: Record<string, number>;
}

async function resolveSide(slug: string, type: "server" | "repo", servers: any[], repos: any[]): Promise<CmpSide | null> {
  if (type === "server") {
    const s = servers.find((x) => x.slug === slug);
    if (!s) return null;
    return { kind: "server", slug, name: s.name || hostOf(s.url), host: hostOf(s.url), score: s.score, grade: s.grade, href: `/mcp/${slug}`, facts: s.facts || {}, pillars: s.pillars || {} };
  }
  const r = repos.find((x) => x.slug === slug);
  if (!r) return null;
  return { kind: "repo", slug, name: r.name || r.repo, host: r.repo, score: r.score, grade: r.grade, href: `/repo/${slug}`, facts: r.facts || {}, pillars: r.pillars || {} };
}

export interface ResolvedComparison {
  a: CmpSide;
  b: CmpSide;
  winner: "a" | "b" | "tie";
}

export async function resolveComparison(c: ComparisonData): Promise<ResolvedComparison | null> {
  const [servers, repos] = await Promise.all([getDirectoryOrNull("score", 500), getReposOrNull("score", 500)]);
  if (servers === null || repos === null) {
    // Upstream audit API unreachable — throw so the page errors (ISR serves stale) instead of
    // returning null → notFound() → a false 404 on every comparison at once.
    throw new Error("checkmcp: audit API unavailable while resolving comparison — refusing to render a false 404");
  }
  const [a, b] = await Promise.all([resolveSide(c.aSlug, c.aType, servers, repos), resolveSide(c.bSlug, c.bType, servers, repos)]);
  if (!a || !b) return null;
  const winner = a.score === b.score ? "tie" : a.score > b.score ? "a" : "b";
  return { a, b, winner };
}

export function comparisonFaq(rc: ResolvedComparison): FaqItem[] {
  const { a, b, winner } = rc;
  const hi = winner === "a" ? a : b;
  const lo = winner === "a" ? b : a;
  const verdict =
    winner === "tie"
      ? `${a.name} and ${b.name} score the same (${a.score}/100) on CheckMCP's audit — pick based on the per-pillar breakdown and feature fit.`
      : `${hi.name} scores higher — ${hi.score}/100 (grade ${hi.grade}) vs ${lo.name} at ${lo.score}/100 (grade ${lo.grade}) — on CheckMCP's vendor-neutral audit. Higher isn't automatically "better for you": check which one wins on the pillars you care about (security vs reliability vs context-cost).`;
  return [
    { q: `${a.name} vs ${b.name}: which MCP server is better?`, a: verdict },
    {
      q: `Is ${a.name} or ${b.name} safer?`,
      a: `CheckMCP audits both for the OWASP MCP Top 10 (tool poisoning, hardcoded secrets, command injection, the lethal trifecta). ${a.name} graded ${a.grade}; ${b.name} graded ${b.grade}. Open each report below for the exact security findings before connecting either to sensitive data or tools.`,
    },
    {
      q: `How is this comparison made?`,
      a: `Both servers are scored 0–100 by the same independent CheckMCP audit, so the numbers are directly comparable. This page is generated from live audit data and updates as each server is re-audited — no vendor influence.`,
    },
  ];
}
