import ScoreRing from "./ScoreRing";
import CopyButton from "./CopyButton";
import FollowButton from "./FollowButton";
import { AuditResult, GRADE_CHIP, gradeKey, scoreKey, PILLARS, PILLAR_ORDER, fmtTokens, hostOf } from "../lib/format";

const progClass = (v: number) => (v >= 80 ? "progress-success" : v >= 55 ? "progress-warning" : "progress-error");

function Pillar({ k, v }: { k: string; v: number }) {
  const meta = PILLARS[k] || { label: k, weight: 0 };
  return (
    <div className="grid grid-cols-[7.5rem_1fr_2.5rem] items-center gap-3 py-1.5">
      <span className="truncate font-mono text-xs text-base-content/60">{meta.label} <span className="text-base-content/30">·{meta.weight}</span></span>
      <progress className={`progress ${progClass(v)} h-1.5`} value={v} max={100} />
      <span className="text-right font-mono text-sm">{v}</span>
    </div>
  );
}

export default function Report({ res }: { res: AuditResult }) {
  const f = res.facts || {};
  const name = res.server?.name || hostOf(res.url);
  const gk = gradeKey(res.grade);
  const sugg = res.optimize?.suggestions || [];
  const split = sugg.find((s: any) => s.type === "split-trifecta");
  const others = sugg.filter((s: any) => s.type !== "split-trifecta");
  const owasp: any[] = f.owasp || [];
  const slug = hostOf(res.url).replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  const badgeUrl = `/badge/${slug}.svg?url=${encodeURIComponent(res.url)}`;
  const badgeMd = `[![MCP Score](https://checkmcp.dev${badgeUrl})](https://checkmcp.dev/report?url=${encodeURIComponent(res.url)})`;

  return (
    <div className="grid animate-rise gap-5">
      <section className="card border border-base-content/10 bg-base-200/60">
        <div className="card-body flex-col gap-6 sm:flex-row sm:items-center">
          <ScoreRing score={res.score} />
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex flex-wrap items-center gap-3">
              <span className={`grid h-12 w-12 place-items-center rounded-xl border text-2xl font-extrabold font-mono ${GRADE_CHIP[gk]}`}>{res.grade}</span>
              <h1 className="text-3xl font-extrabold">{name}</h1>
            </div>
            <div className="break-all font-mono text-xs text-base-content/50">{res.url}</div>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="badge badge-outline badge-sm font-mono">{f.tools ?? 0} tools</span>
              {f.resources ? <span className="badge badge-outline badge-sm font-mono">{f.resources} resources</span> : null}
              {f.prompts ? <span className="badge badge-outline badge-sm font-mono">{f.prompts} prompts</span> : null}
              <span className="badge badge-outline badge-sm font-mono">~{fmtTokens(f.tools_list_tokens)} tok/req</span>
              <span className="badge badge-outline badge-sm font-mono">{f.annotations_pct ?? 0}% annot.</span>
              <span className="badge badge-outline badge-sm font-mono">proto {f.proto || "?"}</span>
            </div>
            {res.floor ? (
              <div role="alert" className="alert alert-error mt-3 py-2 text-sm">⚠️ Score capped — <b>floor: {res.floor}</b> (a hard risk limited the grade).</div>
            ) : null}
          </div>
          {!res.private && (
            <div className="flex w-full flex-col gap-2 sm:w-44">
              <FollowButton url={res.url} />
              <a className="btn btn-sm btn-ghost" href={`/api/score?url=${encodeURIComponent(res.url)}&cached=1`} target="_blank" rel="nofollow noreferrer">Raw JSON ›</a>
            </div>
          )}
        </div>
      </section>

      <div className="grid gap-5 md:grid-cols-2">
        <section className="card border border-base-content/10 bg-base-200/60">
          <div className="card-body">
            <h2 className="font-mono text-xs uppercase tracking-widest text-primary/80">Score by pillar</h2>
            <div className="mt-2">
              {PILLAR_ORDER.filter((k) => k in (res.pillars || {})).map((k) => <Pillar key={k} k={k} v={res.pillars[k]} />)}
            </div>
            {res.reliability_confidence && <p className="mt-2 font-mono text-[11px] text-base-content/40">reliability: {res.reliability_confidence}</p>}
          </div>
        </section>

        <section className="card border border-base-content/10 bg-base-200/60">
          <div className="card-body">
            <h2 className="font-mono text-xs uppercase tracking-widest text-primary/80">Context-cost</h2>
            <div className="flex items-baseline gap-2">
              <span className={`font-mono text-5xl font-extrabold ${scoreKey(res.pillars?.token) === "A" || scoreKey(res.pillars?.token) === "B" ? "text-g-a" : "text-g-d"}`}>{fmtTokens(f.tools_list_tokens)}</span>
              <span className="text-base-content/60">tokens for <code className="text-primary">tools/list</code></span>
            </div>
            <p className="text-sm text-base-content/60">
              Paid <b className="text-base-content">on every request</b>. {f.tools > 42
                ? `With ${f.tools} tools (>p95), a tool-sprawl signal that degrades tool selection.`
                : `Lean footprint for ${f.tools} tools.`}
            </p>
            <div className="mt-auto"><span className="badge badge-ghost badge-sm font-mono">ecosystem median ≈ 3k</span></div>
          </div>
        </section>
      </div>

      <section className="card border border-base-content/10 bg-base-200/60">
        <div className="card-body">
          <div className="flex items-baseline justify-between">
            <h2 className="font-mono text-xs uppercase tracking-widest text-primary/80">MCP primitive coverage</h2>
            <span className="font-mono text-[11px] text-base-content/40">the quality score covers tools</span>
          </div>
          <div className="mt-2 grid grid-cols-3 gap-3">
            {[{ k: "Tools", v: f.tools ?? 0, on: true }, { k: "Resources", v: f.resources ?? 0, on: (f.resources ?? 0) > 0 }, { k: "Prompts", v: f.prompts ?? 0, on: (f.prompts ?? 0) > 0 }].map((p) => (
              <div key={p.k} className="rounded-box border border-base-content/10 bg-base-100/50 p-4">
                <div className={`font-mono text-3xl font-extrabold ${p.on ? "text-primary" : "text-base-content/25"}`}>{p.v}</div>
                <div className="mt-1 font-mono text-xs text-base-content/60">{p.k}{!p.on && <span className="text-base-content/30"> · none</span>}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {res.findings && res.findings.length > 0 && (
        <section className="card border border-base-content/10 bg-base-200/60">
          <div className="card-body">
            <h2 className="font-mono text-xs uppercase tracking-widest text-primary/80">Why this score — causal attribution</h2>
            <p className="mb-2 text-sm text-base-content/50">Each penalty: <span className="font-mono">measure → mechanism → effect → Δscore</span>.</p>
            <div className="grid gap-3">
              {res.findings.slice(0, 10).map((x, i) => (
                <div key={i} className="rounded-box border border-base-content/10 border-l-2 border-l-primary/50 bg-base-100/40 p-4">
                  <div className="mb-1.5 flex items-center justify-between gap-2">
                    <span className="badge badge-sm badge-ghost font-mono">{PILLARS[x.pillar]?.label || x.pillar} · {x.severity}</span>
                    <span className="font-mono font-bold text-g-f">−{x.delta}</span>
                  </div>
                  <p className="text-sm text-base-content/70"><b className="text-base-content">{x.measured}</b> → {x.mechanism} → <span className="text-g-d">{x.effect}</span></p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {(owasp.length > 0 || f.lethal_trifecta) && (
        <section className="card border border-base-content/10 bg-base-200/60">
          <div className="card-body">
            <h2 className="font-mono text-xs uppercase tracking-widest text-primary/80">Security — OWASP MCP Top 10</h2>
            {f.lethal_trifecta && (
              <div role="alert" className="alert alert-error mt-2 flex-col items-start text-sm">
                <b className="text-base">⚠️ Lethal trifecta detected</b>
                <p>Combines untrusted-content ingestion ({f.sec_capabilities?.untrusted_content ?? 0}), sensitive-data access ({f.sec_capabilities?.sensitive_data ?? 0}) and exfiltration/destruction ({(f.sec_capabilities?.exfil ?? 0) + (f.sec_capabilities?.destructive ?? 0)}). A prompt-injection could read a secret then exfiltrate it.</p>
                {split && <p><b>Fix:</b> {split.proposed}.</p>}
              </div>
            )}
            {owasp.length > 0 && (
              <div className="mt-2 grid gap-1.5">
                {owasp.slice(0, 10).map((o, i) => (
                  <div key={i} className="flex items-center gap-3 text-sm">
                    <span className="badge badge-sm border-g-f/40 bg-g-f/10 font-mono text-g-f">{o.id}</span>
                    <span className="text-base-content/50">{o.sev}</span>
                    <code className="text-base-content">{o.tool}</code>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {others.length > 0 && (
        <section className="card border border-base-content/10 bg-base-200/60">
          <div className="card-body">
            <h2 className="font-mono text-xs uppercase tracking-widest text-primary/80">Suggested composite optimizations</h2>
            <div className="mt-1 grid gap-2 text-sm">
              {others.slice(0, 6).map((s: any, i: number) => (
                <div key={i}><span className="text-base-content/50">{(s.tools || []).slice(0, 4).join(", ")}</span> → <code className="text-primary">{s.proposed}</code></div>
              ))}
            </div>
          </div>
        </section>
      )}

      {!res.private && (
        <section className="card border border-base-content/10 bg-base-200/60">
          <div className="card-body">
            <h2 className="font-mono text-xs uppercase tracking-widest text-primary/80">Badge — paste it in your README</h2>
            <div className="flex flex-wrap items-center gap-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={badgeUrl} alt={`MCP Score badge — ${name}`} height={20} className="h-5" />
              <code className="min-w-[15rem] flex-1 break-all font-mono text-xs text-base-content/50">{badgeMd}</code>
              <CopyButton text={badgeMd} label="Copy markdown" />
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
