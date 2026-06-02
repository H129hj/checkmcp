"use client";
import { useState } from "react";
import CopyButton from "../../components/CopyButton";

function slugOf(url: string) {
  return url.replace(/^https?:\/\//, "").split("/")[0].replace(/[^a-z0-9]+/gi, "-").toLowerCase();
}

export default function BadgePage() {
  const [url, setUrl] = useState("");
  const ready = url.trim().length > 4;
  const badge = ready ? `/badge/${slugOf(url)}.svg?url=${encodeURIComponent(url.trim())}` : "";
  const full = ready ? `https://checkmcp.dev${badge}` : "";
  const link = ready ? `https://checkmcp.dev/report?url=${encodeURIComponent(url.trim())}` : "";
  const md = ready ? `[![MCP Score](${full})](${link})` : "";
  const html = ready ? `<a href="${link}"><img src="${full}" alt="MCP Score" height="20"></a>` : "";

  return (
    <div className="max-w-2xl py-14">
      <div className="font-mono text-xs uppercase tracking-[0.22em] text-primary/80">Badge</div>
      <h1 className="mb-2 mt-3 text-4xl font-extrabold">Show your MCP Score</h1>
      <p className="mb-6 text-lg text-base-content/60">A live SVG badge (periodically recomputed) to drop into your MCP server&apos;s README.</p>

      <div className="join mb-6 w-full">
        <span className="join-item flex items-center border border-base-content/15 border-r-0 bg-base-200 px-4 font-mono font-bold text-primary">❯</span>
        <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…/mcp" spellCheck={false} inputMode="url" aria-label="MCP server URL"
          className="input input-bordered join-item w-full border-l-0 bg-base-200 font-mono text-sm" />
      </div>

      {ready && (
        <div className="grid animate-rise gap-4">
          <div className="card border border-base-content/10 bg-base-200/60">
            <div className="card-body items-center">
              <span className="font-mono text-xs uppercase tracking-widest text-primary/80">Preview</span>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={badge} alt="MCP Score badge preview" height={22} className="mt-2 h-[22px]" />
            </div>
          </div>
          {[{ t: "Markdown", v: md }, { t: "HTML", v: html }, { t: "Badge URL", v: full }].map((s) => (
            <div key={s.t} className="card border border-base-content/10 bg-base-200/60">
              <div className="card-body">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs uppercase tracking-widest text-primary/80">{s.t}</span>
                  <CopyButton text={s.v} />
                </div>
                <code className="break-all font-mono text-xs text-base-content/50">{s.v}</code>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
