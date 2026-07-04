import Link from "next/link";
import AuditInput from "../components/AuditInput";
import { getDirectory } from "../lib/api";
import { GRADE_CHIP, gradeKey, hostOf, PILLARS, PILLAR_ORDER, fmtTokens } from "../lib/format";
import { COLLECTIONS } from "../lib/collections";

// Curated homepage collections (strong in-body internal links — the homepage is the
// highest-authority page, so these pass the most weight to the /best hub pages).
const FEATURED = [
  "safest-mcp-servers", "best-mcp-servers-overall", "most-popular-mcp-servers",
  "best-mcp-servers-for-databases", "best-mcp-servers-for-web-scraping",
  "best-mcp-servers-for-browser-automation", "best-mcp-servers-for-devops-and-cloud",
  "mcp-servers-to-avoid",
];

export const revalidate = 120;
export const metadata = { alternates: { canonical: "https://checkmcp.dev/" } };

const APP_LD = {
  "@context": "https://schema.org", "@type": "SoftwareApplication",
  name: "CheckMCP", applicationCategory: "SecurityApplication", operatingSystem: "Any",
  url: "https://checkmcp.dev",
  description: "Audit, monitor and gate any MCP server — score, drift alerts and an in-band gateway that blocks tool-poisoning before it reaches your agent.",
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
};

// Answer-engine optimization: visible Q&A + FAQPage schema, single-sourced so they never drift.
const FAQ: { q: string; a: string }[] = [
  {
    q: "What is an MCP Score?",
    a: "The MCP Score is a single, explainable 0–100 grade for the quality, security and context-cost of a Model Context Protocol (MCP) server. CheckMCP computes it from six weighted pillars — security, tool design, schemas, context-cost, compliance and coverage — plus reliability, which it measures and displays but does not yet weight into the score (single-shot latency is low-confidence), and attributes every penalty as measure → mechanism → effect → Δscore, so the score is auditable rather than a black box.",
  },
  {
    q: "How do I check if an MCP server is safe?",
    a: "Paste the server's endpoint URL into checkmcp.dev, or run the CLI. CheckMCP probes the live server, runs an OWASP MCP Top 10 security pass — tool poisoning, hardcoded secrets, command injection, the lethal trifecta — and behaviorally evaluates read-only tools with canary inputs to catch prompt-injection or data exfiltration in tool responses. A secret found in a schema caps the grade at D; a failed handshake caps it at F.",
  },
  {
    q: "How do I audit an MCP server from the command line?",
    a: "Install nothing and run: uvx audit-mcp https://your-mcp.example.com/mcp — it prints an MCP Score /100 with the causal reasons behind it. The CLI is open-source (MIT) and stdlib-only, and it also runs in CI via the GitHub Action (uses: H129hj/checkmcp@v1) to fail a build on a score regression or a rug-pull.",
  },
  {
    q: "What does CheckMCP check for?",
    a: "Live protocol compliance (Streamable HTTP and legacy HTTP+SSE, protocol-version gap, JSON-RPC error conformance, OAuth 2.1 discovery), the OWASP MCP Top 10 security risks, tool-design sprawl, schema and description completeness, the token cost paid on every tools/list call, and coverage of all three MCP primitives (tools, resources, prompts). It also grades the backing repository as a separate Repo-Quality Score /100.",
  },
  {
    q: "How is the MCP Score calculated?",
    a: "Six weighted pillars are scored against the real MCP ecosystem (percentile-calibrated — for example median ~7 tools, p95 ~42) — reliability is measured and shown as a seventh pillar but not yet credited — with hard floors: a secret in a schema caps the grade at D and a failed handshake caps it at F. The methodology is open and every deduction is traceable to a measurable cause.",
  },
  {
    q: "Is CheckMCP free?",
    a: "Yes — auditing and the MCP Score are free, including the open-source CLI and the public directory. Paid Pro and Team plans add continuous monitoring, behavioral evals on demand, and the in-band gateway that blocks tool-poisoning at runtime.",
  },
  {
    q: "Can I continuously monitor an MCP server for rug-pulls and tool drift?",
    a: "Yes. CheckMCP pins a fingerprint of each tracked server's tools and schemas, re-checks and behaviorally re-evaluates them on drift, and alerts you by webhook when a tool silently changes (a rug-pull) or the score crosses a threshold you set.",
  },
  {
    q: "What are tool poisoning and the lethal trifecta?",
    a: "Tool poisoning is a malicious or compromised MCP tool whose description or output manipulates the agent — hidden instructions, data-exfiltration prompts, and the like. The lethal trifecta is the dangerous combination of an agent having access to private data, exposure to untrusted content, and the ability to communicate externally — the precondition for exfiltration. CheckMCP detects both statically and at runtime, and the in-band gateway strips injected or exfiltrating tool responses before your agent ever sees them.",
  },
];

const FAQ_LD = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQ.map((f) => ({
    "@type": "Question",
    name: f.q,
    acceptedAnswer: { "@type": "Answer", text: f.a },
  })),
};

export default async function Home() {
  const all = await getDirectory("score", 300);
  const servers = all.slice(0, 6);
  const auditedCount = Math.max(all.length, 6);

  return (
    <div className="pb-8 pt-14">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(APP_LD) }} />
      <section className="max-w-3xl animate-rise">
        <div className="font-mono text-xs uppercase tracking-[0.22em] text-primary/80">The vendor-neutral MCP quality standard</div>
        <h1 className="mt-5 text-[clamp(2.5rem,7vw,4.75rem)] font-extrabold leading-[1.04]">
          Score the quality, security<br />and <span className="text-primary">context-cost</span> of your MCP servers.
        </h1>
        <p className="mt-5 max-w-xl text-lg leading-relaxed text-base-content/60">
          One unified audit → an explainable <b className="text-base-content">MCP Score /100</b>, with causal attribution
          (“why this score”) and actionable fixes. No registry required — just paste a URL.
        </p>
        <div className="mt-8 max-w-xl"><AuditInput autofocus /></div>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Link href="/signup" className="btn btn-primary btn-sm">Get started — free ›</Link>
          <Link href="/pricing" className="btn btn-ghost btn-sm">See pricing</Link>
        </div>
        {/* social proof — real, verifiable */}
        <p className="mt-6 font-mono text-xs text-base-content/40">
          ★ <b className="text-base-content/70">{auditedCount}+ MCP servers</b> already scored · OWASP MCP Top 10 · official spec 2025-11-25 · open-source CLI (MIT)
        </p>
      </section>

      <section className="mt-16 grid gap-4 sm:grid-cols-3">
        {[
          { k: "30–50%", v: "of context eaten by schema bloat — the #1 pain of 2026, that nobody scores + fixes." },
          { k: "7 pillars", v: "security · tool design · schemas · reliability · context-cost · compliance · coverage." },
          { k: "OWASP MCP", v: "tool poisoning, rug-pull, lethal-trifecta, exfiltration — detected and explained." },
        ].map((s) => (
          <div key={s.k} className="card border border-base-content/10 bg-base-200/60">
            <div className="card-body p-6">
              <div className="font-mono text-2xl font-extrabold text-primary">{s.k}</div>
              <p className="text-sm text-base-content/60">{s.v}</p>
            </div>
          </div>
        ))}
      </section>

      {/* protection layer — the moat (gateway + monitoring + evals) */}
      <section id="gateway" className="mt-20 scroll-mt-24">
        <div className="font-mono text-xs uppercase tracking-[0.22em] text-primary/80">Beyond the score</div>
        <h2 className="mb-2 mt-3 text-[clamp(1.75rem,4vw,2.75rem)] font-extrabold leading-tight">
          Auditing flags the risk. The gateway <span className="text-primary">stops it</span> reaching your agent.
        </h2>
        <p className="mb-7 max-w-2xl text-lg text-base-content/60">
          A score is a snapshot — production needs more. Catch runtime tool-poisoning, watch for rug-pulls,
          and gate every MCP call in real time. Hosted, or self-hosted in your own VPC.
        </p>
        <div className="grid gap-4 md:grid-cols-3">
          {[
            { tag: "runtime", t: "Behavioral evals", d: "We actually invoke read-only tools with canary inputs and inspect the responses for tool-output prompt-injection, exfiltration and secret leakage — what static analysis can’t see." },
            { tag: "always-on", t: "Continuous monitoring", d: "Tracked servers are re-checked and behaviorally re-evaluated on drift. Tool-pinning catches rug-pulls; you get drift & score-threshold alerts via webhook." },
            { tag: "enforce", t: "In-band gateway", d: "Put CheckMCP between your agent and the MCP server. Passive observes & logs; active blocks policy violations and strips injected/exfiltrating tool responses before your agent ever sees them." },
          ].map((c) => (
            <div key={c.t} className="card border border-base-content/10 bg-base-200/60">
              <div className="card-body gap-2 p-6">
                <span className="badge badge-sm w-fit border-primary/40 bg-primary/10 font-mono text-primary">{c.tag}</span>
                <h3 className="text-lg font-extrabold">{c.t}</h3>
                <p className="text-sm text-base-content/60">{c.d}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/gateways" className="btn btn-primary btn-sm">Deploy a gateway ›</Link>
          <Link href="/pricing" className="btn btn-ghost btn-sm">See plans ›</Link>
        </div>
      </section>

      {servers.length > 0 && (
        <section className="mt-16">
          <div className="mb-4 flex items-baseline justify-between">
            <h2 className="text-2xl font-extrabold">Audited servers</h2>
            <Link href="/directory" className="font-mono text-sm text-primary hover:underline">full directory ›</Link>
          </div>
          <div className="card overflow-hidden border border-base-content/10 bg-base-200/60">
            <table className="table">
              <tbody>
                {servers.map((s, i) => {
                  const gk = gradeKey(s.grade);
                  return (
                    <tr key={s.url} className="hover:bg-base-100/40">
                      <td className="w-10 font-mono text-base-content/30">{String(i + 1).padStart(2, "0")}</td>
                      <td>
                        <Link href={`/mcp/${s.slug}`} className="block">
                          <div className="font-semibold">{s.name || hostOf(s.url)}</div>
                          <div className="font-mono text-xs text-base-content/40">{hostOf(s.url)}</div>
                        </Link>
                      </td>
                      <td className="hidden text-right font-mono text-xs text-base-content/50 sm:table-cell">~{fmtTokens(s.facts?.tools_list_tokens)} tok</td>
                      <td className="text-right">
                        <div className="inline-flex items-center gap-2">
                          <span className="font-mono font-bold">{s.score}</span>
                          <span className={`grid h-8 w-8 place-items-center rounded-lg border font-mono text-sm font-bold ${GRADE_CHIP[gk]}`}>{s.grade}</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="mt-16">
        <div className="mb-4 flex items-baseline justify-between">
          <h2 className="text-2xl font-extrabold">Browse by category</h2>
          <Link href="/best" className="font-mono text-sm text-primary hover:underline">all collections ›</Link>
        </div>
        <p className="mb-4 max-w-2xl text-base-content/60">
          Independently-audited rankings of the best and safest MCP servers by use case — and head-to-head{" "}
          <Link href="/compare" className="text-primary hover:underline">comparisons</Link>.
        </p>
        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURED.map((slug) => {
            const c = COLLECTIONS.find((x) => x.slug === slug);
            if (!c) return null;
            return (
              <Link
                key={slug}
                href={`/best/${slug}`}
                className="card border border-base-content/10 bg-base-200/60 p-4 transition hover:border-primary/40 hover:bg-base-100/40"
              >
                <div className="text-sm font-bold leading-snug">{c.title}</div>
                <div className="mt-2 font-mono text-xs text-primary/70">{c.serverSlugs.length + c.repoSlugs.length} servers ›</div>
              </Link>
            );
          })}
        </div>
      </section>

      <section id="methodology" className="mt-20 scroll-mt-24">
        <div className="font-mono text-xs uppercase tracking-[0.22em] text-primary/80">Open methodology</div>
        <h2 className="mb-2 mt-3 text-3xl font-extrabold">How the MCP Score is computed</h2>
        <p className="mb-6 max-w-xl text-lg text-base-content/60">
          Six weighted pillars (reliability shown but not yet credited), hard floors (secret-in-schema → cap D, failed handshake → cap F), and a traceable attribution for every penalty.
        </p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {PILLAR_ORDER.map((k) => (
            <div key={k} className="card border border-base-content/10 bg-base-200/60">
              <div className="card-body flex-row items-baseline justify-between p-5">
                <h3 className="text-base font-bold">{PILLARS[k].label}</h3>
                <span className="font-mono text-sm text-primary">/{PILLARS[k].weight}</span>
              </div>
            </div>
          ))}
        </div>
        <p className="mt-6 font-mono text-xs text-base-content/40">
          Calibrated on the real MCP ecosystem · official spec 2025-11-25 · annotations, OAuth 2.1/PKCE, cursor pagination, JSON-RPC errors.
        </p>
      </section>

      <section id="faq" className="mt-20 scroll-mt-24">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(FAQ_LD) }} />
        <div className="font-mono text-xs uppercase tracking-[0.22em] text-primary/80">Answers</div>
        <h2 className="mb-2 mt-3 text-3xl font-extrabold">MCP security &amp; auditing — FAQ</h2>
        <p className="mb-6 max-w-xl text-lg text-base-content/60">
          Common questions about checking, scoring and protecting Model Context Protocol servers.
        </p>
        <div className="space-y-3">
          {FAQ.map((f) => (
            <details key={f.q} className="group card border border-base-content/10 bg-base-200/60">
              <summary className="flex cursor-pointer items-center justify-between gap-3 p-5 text-base font-bold">
                <span>{f.q}</span>
                <span className="font-mono text-primary transition group-open:rotate-45">+</span>
              </summary>
              <div className="px-5 pb-5 text-sm leading-relaxed text-base-content/60">{f.a}</div>
            </details>
          ))}
        </div>
        <Link href="/learn" className="mt-5 inline-block font-mono text-sm text-primary hover:underline">Browse all MCP security &amp; quality concepts ›</Link>
      </section>
    </div>
  );
}
