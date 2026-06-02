import type { MetadataRoute } from "next";
import { getDirectory, getRepos } from "../lib/api";

export const revalidate = 600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = "https://checkmcp.dev";
  const [servers, repos] = await Promise.all([getDirectory("recent", 500), getRepos("recent", 500)]);
  const stat = ["", "/directory", "/badge", "/dashboard"].map((p) => ({
    url: `${base}${p}`,
    changeFrequency: "daily" as const,
    priority: p === "" ? 1 : 0.7,
  }));
  const live = servers.map((s) => ({
    url: `${base}/mcp/${s.slug}`,
    lastModified: s.updated_at ? new Date(s.updated_at) : undefined,
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }));
  const repoPages = repos.map((r) => ({
    url: `${base}/repo/${r.slug}`,
    changeFrequency: "weekly" as const,
    priority: 0.6,
  }));
  return [...stat, ...live, ...repoPages];
}
