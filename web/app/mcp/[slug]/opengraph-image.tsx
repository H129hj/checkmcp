import { ImageResponse } from "next/og";
import { getDirectory, getScore } from "../../../lib/api";
import { GRADE_STROKE, gradeKey, hostOf, fmtTokens } from "../../../lib/format";

export const runtime = "nodejs";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "MCP Score by CheckMCP";

export default async function OG({ params }: { params: { slug: string } }) {
  const dir = await getDirectory("recent", 500);
  const row = dir.find((d) => d.slug === params.slug);
  const res = row ? await getScore(row.url, true) : null;   // cached: no live re-probe (fast OG image)
  const ok = res && !res.error;
  const score = ok ? res.score : 0;
  const grade = ok ? res.grade : "?";
  const name = (ok && (res.server?.name || hostOf(res.url))) || "MCP server";
  const color = GRADE_STROKE[gradeKey(grade)] || "#9a9aa3";
  const f = (ok && res.facts) || {};

  return new ImageResponse(
    (
      <div style={{ height: "100%", width: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#0a0a0c", padding: "64px 72px", color: "#e9e9ec" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ display: "flex", width: 18, height: 18, borderRadius: 999, background: "#ccff00" }} />
          <span style={{ fontSize: 28, fontWeight: 800, color: "#9a9aa3" }}>CheckMCP</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 56 }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", border: `12px solid ${color}`, borderRadius: 999, width: 260, height: 260 }}>
            <span style={{ fontSize: 120, fontWeight: 800, color, lineHeight: 1 }}>{score}</span>
            <span style={{ fontSize: 22, color: "#9a9aa3", letterSpacing: 4 }}>MCP SCORE</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 640 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
              <span style={{ display: "flex", fontSize: 48, fontWeight: 800, color, border: `4px solid ${color}`, borderRadius: 16, padding: "2px 22px" }}>{grade}</span>
              <span style={{ fontSize: 52, fontWeight: 800 }}>{name}</span>
            </div>
            <span style={{ fontSize: 26, color: "#9a9aa3" }}>{`${f.tools ?? 0} tools · ~${fmtTokens(f.tools_list_tokens)} tokens / request · proto ${f.proto || "?"}`}</span>
          </div>
        </div>
        <span style={{ fontSize: 24, color: "#6b6b75" }}>checkmcp.dev — vendor-neutral MCP audit</span>
      </div>
    ),
    { ...size }
  );
}
