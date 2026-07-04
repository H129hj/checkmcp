// Collection / category pages ("Best/Safest MCP servers for X") — the head-term capture
// + internal-linking hubs that surface all 244 audited entities to crawlers. Data-driven:
// the membership lists come from the checkmcp-progseo workflow (collections-data.ts); this
// module resolves slugs against the live audit API and ranks by score.
import { getDirectoryOrNull, getReposOrNull } from "./api";
import { hostOf } from "./format";
import type { FaqItem } from "./faq";
import { COLLECTIONS_DATA } from "./collections-data";
import { COLLECTIONS_EXTRA } from "./collections-extra";

export interface CollectionData {
  slug: string;
  title: string;       // H1, e.g. "Best MCP Servers for Databases"
  targetQuery: string; // the US search query this page targets
  blurb: string;       // 1-2 sentence intro
  serverSlugs: string[];
  repoSlugs: string[];
}

export const COLLECTIONS: CollectionData[] = [...COLLECTIONS_DATA, ...COLLECTIONS_EXTRA];
export const getCollection = (slug: string) => COLLECTIONS.find((c) => c.slug === slug);

export interface ColEntity {
  kind: "server" | "repo";
  slug: string;
  name: string;
  host: string;
  score: number;
  grade: string;
  href: string;
  meta: string;        // "12 tools" | "★ 6.7k"
  stars: number;
}

// Per-collection ranking/filter overrides, keyed by slug. Kept here (not in the generated
// data files) so the progseo regenerator can't clobber them, and so a page never contradicts
// its own premise: "Most GitHub Stars" ranks by stars, an "avoid" list reads worst-first, and
// grade-scoped lists only show members whose CURRENT live grade still matches.
const STARS_SORTED = new Set<string>(["most-popular-mcp-servers"]);
const SCORE_ASC = new Set<string>(["mcp-servers-to-avoid"]);
const GRADE_OK: Record<string, (grade: string) => boolean> = {
  "safest-mcp-servers": (g) => g === "A",
  "a-grade-mcp-servers": (g) => g === "A",
  "mcp-servers-to-avoid": (g) => g === "D" || g === "F",
};

// What a collection is ranked by — surfaced to the page so its subheading stays honest.
export const rankBasis = (slug: string): "stars" | "score" => (STARS_SORTED.has(slug) ? "stars" : "score");

// Resolve a collection's slugs against the live API, filter to the collection's grade premise,
// and rank it. Throws if the audit API is unreachable (rather than resolving to [] and letting
// the page emit a false 404 across every collection at once).
export async function resolveCollection(c: CollectionData): Promise<ColEntity[]> {
  const [servers, repos] = await Promise.all([getDirectoryOrNull("score", 500), getReposOrNull("score", 500)]);
  if (servers === null || repos === null) {
    throw new Error("checkmcp: audit API unavailable while resolving collection — refusing to render a false-empty (404) page");
  }
  const sMap = new Map(servers.map((s) => [s.slug, s]));
  const rMap = new Map(repos.map((r) => [r.slug, r]));
  const out: ColEntity[] = [];
  for (const slug of c.serverSlugs) {
    const s = sMap.get(slug);
    if (s) out.push({ kind: "server", slug, name: s.name || hostOf(s.url), host: hostOf(s.url), score: s.score, grade: s.grade, href: `/mcp/${slug}`, meta: `${s.facts?.tools ?? "?"} tools`, stars: 0 });
  }
  for (const slug of c.repoSlugs) {
    const r = rMap.get(slug);
    if (r) out.push({ kind: "repo", slug, name: r.name || r.repo, host: r.repo, score: r.score, grade: r.grade, href: `/repo/${slug}`, meta: `★ ${fmtStars(r.facts?.stars)}`, stars: r.facts?.stars ?? 0 });
  }
  const gradeOk = GRADE_OK[c.slug];
  const cmp = STARS_SORTED.has(c.slug)
    ? (a: ColEntity, b: ColEntity) => b.stars - a.stars || b.score - a.score  // popularity → stars
    : SCORE_ASC.has(c.slug)
      ? (a: ColEntity, b: ColEntity) => a.score - b.score || a.stars - b.stars // "avoid" → worst first
      : (a: ColEntity, b: ColEntity) => b.score - a.score || b.stars - a.stars; // default → best score
  // filter to the collection's grade premise, de-dupe (an entity is listed once), then rank
  const seen = new Set<string>();
  return out
    .filter((e) => (gradeOk ? gradeOk(e.grade) : true))
    .filter((e) => (seen.has(e.href) ? false : (seen.add(e.href), true)))
    .sort(cmp);
}

function fmtStars(n?: number): string {
  if (!n) return "0";
  return n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : String(n);
}

// Build a grammatical FAQ question from a collection title, e.g.
//   "Best MCP Servers for Databases"           → "What is the best MCP server for databases?"
//   "Safest MCP Servers (Grade A, No Flags)"   → "What is the safest MCP server?"
//   "MCP Servers to Avoid (…)"                 → null (no superlative → skip this question)
function collectionQuestion(title: string): string | null {
  const base = title.replace(/\s*\(.*?\)\s*/g, " ").replace(/\s+/g, " ").trim();
  const m = base.match(/^(best|safest|most popular|a-grade)\s+mcp servers?\b(.*)$/i);
  if (!m) return null;
  const QUAL: Record<string, string> = { best: "best", safest: "safest", "most popular": "most popular", "a-grade": "best A-grade" };
  const qualifier = QUAL[m[1].toLowerCase()] ?? m[1].toLowerCase();
  const tail = m[2].trim().toLowerCase(); // "for databases", "overall", ""
  return `What is the ${qualifier} MCP server${tail ? " " + tail : ""}?`;
}

// Collection-page FAQ (answer-engine + long-tail), built from the ranked result.
export function collectionFaq(c: CollectionData, ranked: ColEntity[]): FaqItem[] {
  const top = ranked[0];
  const items: FaqItem[] = [];
  const q0 = collectionQuestion(c.title);
  if (top && q0) {
    items.push({
      q: q0,
      a: `By CheckMCP's audit, ${top.name} ranks highest in "${c.title}" with an MCP Score of ${top.score}/100 (grade ${top.grade}). This page ranks ${ranked.length} audited MCP ${ranked.length === 1 ? "server" : "servers"} by their vendor-neutral CheckMCP score (security, tool design, reliability, context-cost). Re-audit any of them at checkmcp.dev.`,
    });
  }
  items.push({
    q: `How are these MCP servers ranked?`,
    a: `Every server on this page is independently audited by CheckMCP and scored 0–100 across weighted pillars — for live endpoints: security (OWASP MCP Top 10), tool design, schemas, reliability and context-cost; for repos: maintenance, license, adoption and documentation. Ordering reflects the audit (popularity lists are ordered by GitHub stars instead) — no vendor pays for placement.`,
  });
  items.push({
    q: `Are these MCP servers safe to use?`,
    a: `Each listing links to a full CheckMCP report showing its grade, per-pillar breakdown and any security findings (tool poisoning, hardcoded secrets, the lethal trifecta). Grade A/B servers passed with no or only minor issues; check the individual report before connecting any server to sensitive data or tools.`,
  });
  return items;
}
