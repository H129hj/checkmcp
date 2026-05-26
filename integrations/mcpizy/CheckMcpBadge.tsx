import { repoSignal } from "@/lib/checkmcp";
import { ShieldCheck, ShieldAlert } from "lucide-react";

// Badge de confiance CheckMCP affiché sur la fiche d'un serveur (maintenance/licence).
export default async function CheckMcpBadge({ githubUrl }: { githubUrl?: string | null }) {
  const s = await repoSignal(githubUrl);
  if (!s) return null;
  const issues = s.findings?.length ?? 0;
  const ok = issues === 0;
  const age =
    s.pushed_days == null ? "?" : s.pushed_days === 0 ? "aujourd'hui" : `${s.pushed_days}j`;
  return (
    <div
      className={`inline-flex items-center gap-2 rounded-md border px-2.5 py-1 text-[11px] ${
        ok ? "border-emerald-500/30 text-emerald-300" : "border-amber-500/30 text-amber-300"
      }`}
      title="Signal de confiance CheckMCP (maintenance, licence, provenance)"
    >
      {ok ? <ShieldCheck size={13} /> : <ShieldAlert size={13} />}
      <span className="font-semibold">CheckMCP</span>
      <span className="text-[#8888A0]">·</span>
      <span>{s.license || "sans licence"}</span>
      <span className="text-[#8888A0]">· push {age}</span>
      {typeof s.stars === "number" && <span className="text-[#8888A0]">· ⭐{s.stars.toLocaleString()}</span>}
      {!ok && <span className="text-amber-300">· ⚠{issues}</span>}
      {s.archived && <span className="text-amber-300">· archivé</span>}
    </div>
  );
}
