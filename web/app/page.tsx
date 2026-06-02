import Link from "next/link";
import AuditInput from "../components/AuditInput";
import { getDirectory } from "../lib/api";
import { GRADE_CHIP, gradeKey, hostOf, PILLARS, PILLAR_ORDER, fmtTokens } from "../lib/format";

export const revalidate = 120;

export default async function Home() {
  const servers = await getDirectory("score", 6);

  return (
    <div className="pb-8 pt-14">
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

      <section id="methodology" className="mt-20 scroll-mt-24">
        <div className="font-mono text-xs uppercase tracking-[0.22em] text-primary/80">Open methodology</div>
        <h2 className="mb-2 mt-3 text-3xl font-extrabold">How the MCP Score is computed</h2>
        <p className="mb-6 max-w-xl text-lg text-base-content/60">
          Seven weighted pillars, hard floors (secret-in-schema → cap D, failed handshake → cap F), and a traceable attribution for every penalty.
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
    </div>
  );
}
