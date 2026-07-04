// Per-server FAQ generators — answer the long-tail "is <X> MCP server safe / how good is it"
// queries with the actual audited data (no invented facts). Rendered as visible Q&A + FAQPage
// JSON-LD by components/ServerFaq.tsx.
import { fmtTokens, hostOf } from "./format";

export interface FaqItem {
  q: string;
  a: string;
}

function mcpVerdict(grade: string): string {
  switch ((grade || "").toUpperCase()) {
    case "A":
      return "strong — no blocking security or design issues were found";
    case "B":
      return "good — only minor issues";
    case "C":
      return "moderate — some quality or security gaps worth reviewing";
    case "D":
      return "weak — significant issues; review the findings before trusting it with sensitive data or tools";
    default:
      return "failing — serious problems were found (e.g. a failed handshake, an exposed secret, or unsafe tool behavior); not recommended without remediation";
  }
}

export function mcpFaq(res: any): FaqItem[] {
  const name = res?.server?.name || hostOf(res?.url || "");
  const f = res?.facts || {};
  const items: FaqItem[] = [
    {
      q: `Is the ${name} MCP server safe to use?`,
      a: `CheckMCP audited ${name} and gave it an MCP Score of ${res.score}/100 (grade ${res.grade}) — ${mcpVerdict(res.grade)}. The audit runs an OWASP MCP Top 10 security pass (tool poisoning, hardcoded secrets, command injection, the lethal trifecta) against the live endpoint; see the per-pillar breakdown and the "why this score" attribution on this page, and re-audit anytime at checkmcp.dev.`,
    },
    {
      q: `What is the MCP Score of ${name}?`,
      a: `${name} scores ${res.score}/100 (grade ${res.grade}) on CheckMCP's vendor-neutral audit across six weighted pillars — security, tool design, schemas, context-cost, compliance and coverage — with reliability measured and shown but not yet credited.`,
    },
  ];
  if (typeof f.tools === "number") {
    items.push({
      q: `How many tools does ${name} expose, and what is its context cost?`,
      a: `${name} exposes ${f.tools} tool${f.tools === 1 ? "" : "s"}, and its tools/list response costs roughly ${fmtTokens(f.tools_list_tokens)} tokens — paid on every request your agent makes to it. Lower is better for your context budget.`,
    });
  }
  items.push({
    q: `How was ${name} scored?`,
    a: `By probing the live MCP endpoint (${res.url}), inspecting its tools, schemas and protocol compliance, running an OWASP MCP Top 10 security pass, and measuring the token cost of tools/list — then attributing every penalty as measure → mechanism → effect. The methodology is open: checkmcp.dev/#methodology.`,
  });
  return items;
}

export function repoFaq(r: any): FaqItem[] {
  const name = r?.name || r?.repo;
  const f = r?.facts || {};
  const items: FaqItem[] = [
    {
      q: `Is the ${name} MCP repository well-maintained?`,
      a:
        `CheckMCP's Repo-Quality Score for ${r.repo} is ${r.score}/100 (grade ${r.grade}), graded on maintenance, license, adoption and documentation.` +
        (f.pushed_days != null ? ` Last pushed ${f.pushed_days} days ago, ${f.stars ?? 0} stars, ${f.license || "no license"}.` : "") +
        (f.archived ? " The repository is archived." : "") +
        (r.floor ? ` The score is capped (floor: ${r.floor}).` : ""),
    },
    {
      q: `What is the Repo-Quality Score of ${r.repo}?`,
      a: `${r.repo} scores ${r.score}/100 (grade ${r.grade}) — a vendor-neutral grade of the backing GitHub repository across four pillars: maintenance, license, adoption and documentation.`,
    },
    {
      q: `Where can I find or install the ${name} MCP server?`,
      a: `The source is at github.com/${r.repo}.` + (r.mcpizy_slug ? ` It can be installed via mcpizy: mcpizy.com/marketplace/${r.mcpizy_slug}.` : ""),
    },
  ];
  if (Array.isArray(r.findings) && r.findings.length) {
    const top = r.findings[0];
    items.push({
      q: `Why did ${r.repo} score ${r.score}?`,
      a: `The biggest deduction: ${top.measured} → ${top.mechanism} → ${top.effect} (−${top.delta}). Every penalty is attributed this way; see the full breakdown on this page.`,
    });
  }
  return items;
}
