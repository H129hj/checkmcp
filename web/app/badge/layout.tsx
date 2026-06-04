import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Badge — embed your MCP Score",
  description: "Generate an SVG badge of your MCP server's CheckMCP Score to embed in your README or docs.",
  alternates: { canonical: "/badge" },
};

export default function BadgeLayout({ children }: { children: React.ReactNode }) {
  return children;
}
