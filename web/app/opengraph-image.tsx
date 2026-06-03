import { ImageResponse } from "next/og";

export const runtime = "nodejs";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "CheckMCP — quality, security & context-cost score for MCP servers";

export default function OG() {
  return new ImageResponse(
    (
      <div style={{ height: "100%", width: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#0a0a0c", padding: "72px 80px", color: "#e9e9ec" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 30, fontWeight: 800 }}>
          <div style={{ width: 22, height: 22, borderRadius: 999, background: "#ccff00" }} />
          CheckMCP
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ display: "flex", flexWrap: "wrap", fontSize: 64, fontWeight: 800, lineHeight: 1.1, maxWidth: 960 }}>
            <span>Score the quality, security &amp;&nbsp;</span>
            <span style={{ color: "#ccff00" }}>context-cost&nbsp;</span>
            <span>of your MCP servers.</span>
          </div>
          <div style={{ fontSize: 28, color: "#9a9aa3" }}>One explainable MCP Score /100 — vendor-neutral.</div>
        </div>
        <div style={{ fontSize: 24, color: "#6b6b75" }}>checkmcp.dev</div>
      </div>
    ),
    { ...size }
  );
}
