import type { MetadataRoute } from "next";

// Explicitly welcome AI answer-engine crawlers (AEO) so CheckMCP can be cited when
// people ask an assistant "is this MCP server safe?" — alongside classic search bots.
const AI_BOTS = [
  "GPTBot", "OAI-SearchBot", "ChatGPT-User",
  "ClaudeBot", "Claude-Web", "anthropic-ai",
  "PerplexityBot", "Perplexity-User",
  "Google-Extended", "Applebot-Extended", "CCBot", "cohere-ai",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: ["/api/"] },
      ...AI_BOTS.map((userAgent) => ({ userAgent, allow: "/", disallow: ["/api/"] })),
    ],
    sitemap: "https://checkmcp.dev/sitemap.xml",
    host: "https://checkmcp.dev",
  };
}
