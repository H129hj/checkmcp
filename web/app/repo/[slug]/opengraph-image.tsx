import { ImageResponse } from "next/og";
import { getRepo } from "../../../lib/api";
import { GRADE_STROKE, gradeKey } from "../../../lib/format";

export const runtime = "nodejs";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Repo-Quality Score by CheckMCP";

export default async function OG({ params }: { params: { slug: string } }) {
  const r = await getRepo(params.slug);
  const ok = r && !r.error;
  const score = ok ? r.score : 0;
  const grade = ok ? r.grade : "?";
  const name = (ok && (r.name || r.repo)) || "MCP repo";
  const color = GRADE_STROKE[gradeKey(grade)] || "#9a9aa3";
  const f = (ok && r.facts) || {};

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
            <span style={{ fontSize: 20, color: "#9a9aa3", letterSpacing: 3 }}>REPO SCORE</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 640 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
              <span style={{ display: "flex", fontSize: 48, fontWeight: 800, color, border: `4px solid ${color}`, borderRadius: 16, padding: "2px 22px" }}>{grade}</span>
              <span style={{ fontSize: 48, fontWeight: 800 }}>{name}</span>
            </div>
            <span style={{ fontSize: 26, color: "#9a9aa3" }}>{`★ ${f.stars ?? 0} · ${f.license || "no license"} · maintenance, license, adoption, docs`}</span>
          </div>
        </div>
        <span style={{ fontSize: 24, color: "#6b6b75" }}>checkmcp.dev — vendor-neutral MCP audit</span>
      </div>
    ),
    { ...size }
  );
}
