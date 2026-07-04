// Hand-curated collections that aren't derived from the progseo classification:
// "remote MCP servers" (every live HTTP endpoint we audit) and "official MCP servers"
// (first-party servers shipped by the vendor itself). Kept separate from the
// auto-generated collections-data.ts so a regen never clobbers them. Slugs validated
// against the live dataset at build time by resolveCollection().
import type { CollectionData } from "./collections";

export const COLLECTIONS_EXTRA: CollectionData[] = [
  {
    slug: "remote-mcp-servers",
    title: "Remote MCP Servers (Live Hosted Endpoints)",
    targetQuery: "remote mcp servers",
    blurb:
      "Remote MCP servers you connect to over HTTP — no install, no local process. These are live, hosted endpoints CheckMCP audits by probing the real server, so the score reflects the actual running service (security, tool design, reliability, context-cost), not a repository.",
    serverSlugs: [
      "mcp-exa-ai", "learn-microsoft-com", "huggingface-co", "mcp-context7-com", "mcp-deepwiki-com",
      "docs-mcp-cloudflare-com", "mcp-docs-astro-build", "mcp-roundtable-now", "chainflip-broker-io",
      "gitmcp-io-facebook-react", "gitmcp-io-vercel-next-js", "gitmcp-io-modelcontextprotocol-servers",
      "gitmcp-io-microsoft-typescript", "gitmcp-io-django-django", "gitmcp-io-tiangolo-fastapi",
      "gitmcp-io-kubernetes-kubernetes", "gitmcp-io-rust-lang-rust", "gitmcp-io-golang-go",
      "gitmcp-io-python-cpython", "gitmcp-io-nodejs-node", "gitmcp-io-denoland-deno",
      "gitmcp-io-supabase-supabase", "gitmcp-io-prisma-prisma", "gitmcp-io-redis-redis",
      "gitmcp-io-pytorch-pytorch", "gitmcp-io-huggingface-transformers", "gitmcp-io-langchain-ai-langchain",
      "gitmcp-io-pandas-dev-pandas", "gitmcp-io-numpy-numpy", "gitmcp-io-vuejs-core",
      "gitmcp-io-sveltejs-svelte", "gitmcp-io-expressjs-express", "gitmcp-io-tailwindlabs-tailwindcss",
      "gitmcp-io-oven-sh-bun", "gitmcp-io-vitejs-vite", "gitmcp-io-pallets-flask", "gitmcp-io-docs",
    ],
    repoSlugs: [],
  },
  {
    slug: "official-mcp-servers",
    title: "Official MCP Servers (First-Party, Vendor-Maintained)",
    targetQuery: "official mcp servers",
    blurb:
      "MCP servers shipped by the vendor whose product they connect to — Stripe, Microsoft, AWS, Notion, Cloudflare, MongoDB, Grafana and more. First-party doesn't automatically mean safe: every server here is independently audited by CheckMCP, with its grade shown so you can see which official servers are actually well-built.",
    serverSlugs: ["mcp-exa-ai", "learn-microsoft-com", "docs-mcp-cloudflare-com", "mcp-context7-com", "huggingface-co"],
    repoSlugs: [
      "stripe-agent-toolkit", "microsoft-playwright-mcp", "microsoft-azure-devops-mcp", "awslabs-mcp",
      "hashicorp-terraform-mcp-server", "makenotion-notion-mcp-server", "mendableai-firecrawl-mcp-server",
      "elevenlabs-elevenlabs-mcp", "grafana-mcp-grafana", "mongodb-js-mongodb-mcp-server",
      "neondatabase-mcp-server-neon", "googlecloudplatform-cloud-run-mcp", "googleapis-genai-toolbox",
      "oxylabs-oxylabs-mcp", "apify-actors-mcp-server", "dbt-labs-dbt-mcp", "tavily-ai-tavily-mcp",
      "zapier-zapier-mcp", "taskade-mcp", "makeplane-plane-mcp-server", "line-line-bot-mcp-server",
      "norman-finance-norman-mcp-server", "cloudflare-mcp-server-cloudflare", "clickhouse-mcp-clickhouse",
      "elastic-mcp-server-elasticsearch", "buildkite-buildkite-mcp-server", "railsware-mailtrap-mcp",
      "mailgun-mailgun-mcp-server", "activecampaign-postmark-mcp", "sonarsource-sonarqube-mcp-server",
      "square-square-mcp-server",
    ],
  },
];
