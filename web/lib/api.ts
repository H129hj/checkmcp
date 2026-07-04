// Fetch helpers côté serveur (SSR). L'API interne est sur le VPS (CHECKMCP_API),
// le navigateur, lui, appelle /api/* en same-origin (proxy nginx).

const API = process.env.CHECKMCP_API || "http://127.0.0.1:8799";

async function getJSON<T>(path: string, revalidate = 60): Promise<T | null> {
  try {
    const r = await fetch(`${API}${path}`, { next: { revalidate } });
    if (!r.ok) return null;
    return (await r.json()) as T;
  } catch {
    return null;
  }
}

export interface DirRow {
  url: string; slug: string; name?: string; score: number; grade: string;
  floor?: string | null; pillars?: Record<string, number>; facts?: any; updated_at?: string;
}

export const getDirectory = (order = "score", limit = 200) =>
  getJSON<{ servers: DirRow[] }>(`/api/directory?order=${order}&limit=${limit}`, 60).then((d) => d?.servers ?? []);

// cached=true → reads the stored audit from DB without re-probing (fast; for SEO pages / OG images)
export const getScore = (url: string, cached = false) =>
  getJSON<any>(`/api/score?url=${encodeURIComponent(url)}${cached ? "&cached=1" : ""}`, 300);

export const getMonitors = () =>
  getJSON<{ monitors: any[] }>(`/api/monitors`, 0).then((d) => d?.monitors ?? []);

export const getRuns = (url: string, limit = 60) =>
  getJSON<{ runs: any[] }>(`/api/runs?url=${encodeURIComponent(url)}&limit=${limit}`, 0).then((d) => d?.runs ?? []);

export interface RepoRow {
  repo: string; slug: string; name?: string; score: number; grade: string;
  floor?: string | null; pillars?: Record<string, number>; facts?: any; homepage?: string; source?: string;
}

export const getRepos = (order = "score", limit = 300, source?: string) =>
  getJSON<{ repos: RepoRow[] }>(`/api/repos?order=${order}&limit=${limit}${source ? `&source=${source}` : ""}`, 60).then((d) => d?.repos ?? []);

// Error-aware variants: null = upstream/API failure (fetch threw or non-2xx), [] would mean a
// genuinely empty but reachable result. Lets callers tell "API down" from "no data" and avoid
// rendering a false-empty page that would emit a 404 (see resolveCollection/resolveComparison).
export const getDirectoryOrNull = (order = "score", limit = 200) =>
  getJSON<{ servers: DirRow[] }>(`/api/directory?order=${order}&limit=${limit}`, 60).then((d) => d?.servers ?? null);

export const getReposOrNull = (order = "score", limit = 300, source?: string) =>
  getJSON<{ repos: RepoRow[] }>(`/api/repos?order=${order}&limit=${limit}${source ? `&source=${source}` : ""}`, 60).then((d) => d?.repos ?? null);

export const getRepo = (slug: string) =>
  getJSON<any>(`/api/repo?slug=${encodeURIComponent(slug)}`, 300);
