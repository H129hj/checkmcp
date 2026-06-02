"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

const EXAMPLES = [
  { label: "deepwiki", url: "https://mcp.deepwiki.com/mcp" },
  { label: "context7", url: "https://mcp.context7.com/mcp" },
];

export default function AuditInput({ autofocus = false }: { autofocus?: boolean }) {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const go = (u?: string) => {
    const t = (u ?? url).trim();
    if (t) router.push(`/report?url=${encodeURIComponent(t)}`);
  };
  return (
    <div className="w-full">
      <div className="join w-full shadow-lg shadow-primary/5">
        <span className="join-item flex items-center bg-base-200 pl-4 pr-1 font-mono font-bold text-primary border border-base-content/15 border-r-0">❯</span>
        <input
          autoFocus={autofocus}
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && go()}
          placeholder="paste an MCP server URL — https://…/mcp"
          spellCheck={false}
          inputMode="url"
          aria-label="MCP server URL to audit"
          className="input input-bordered join-item w-full border-l-0 bg-base-200 font-mono text-sm focus:outline-none"
        />
        <button className="btn btn-primary join-item" onClick={() => go()}>Audit</button>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="font-mono text-xs text-base-content/40">try:</span>
        {EXAMPLES.map((e) => (
          <button key={e.url} onClick={() => go(e.url)} className="badge badge-outline badge-sm gap-1 font-mono hover:border-primary hover:text-primary">{e.label}</button>
        ))}
      </div>
    </div>
  );
}
