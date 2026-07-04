import type { MetadataRoute } from "next";
import { getDirectory, getRepos } from "../lib/api";
import { LEARN } from "../lib/learn";
import { COLLECTIONS } from "../lib/collections";
import { COMPARISONS } from "../lib/compare";

export const revalidate = 600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = "https://checkmcp.dev";
  const [servers, repos] = await Promise.all([getDirectory("recent", 500), getRepos("recent", 500)]);

  const stat = ["", "/directory", "/best", "/compare", "/learn", "/badge", "/dashboard", "/download", "/pricing", "/gateways", "/fleet", "/policy", "/report", "/contact"].map((p) => ({
    url: `${base}${p}`,
    changeFrequency: "daily" as const,
    priority: p === "" ? 1 : p === "/directory" || p === "/best" ? 0.8 : 0.7,
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
  const learn = LEARN.map((p) => ({
    url: `${base}/learn/${p.slug}`,
    changeFrequency: "monthly" as const,
    priority: 0.7,
  }));
  const collections = COLLECTIONS.map((c) => ({
    url: `${base}/best/${c.slug}`,
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }));
  const comparisons = COMPARISONS.map((c) => ({
    url: `${base}/compare/${c.slug}`,
    changeFrequency: "weekly" as const,
    priority: 0.6,
  }));

  return [...stat, ...collections, ...comparisons, ...learn, ...live, ...repoPages];
}
