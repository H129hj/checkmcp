// CheckMCP — signal de confiance (maintenance/licence/provenance) via l'API locale CheckMCP.
// Appel SERVEUR uniquement (l'API tourne sur l'hôte Contabo, joignable via le gateway docker).
const API = process.env.CHECKMCP_API || "http://172.17.0.1:8799";

export type CheckMcpRepo = {
  repo?: string;
  pushed_days?: number | null;
  license?: string | null;
  archived?: boolean;
  stars?: number;
  findings?: { severity: string; measured: string }[];
  error?: string;
};

export async function repoSignal(githubUrl?: string | null): Promise<CheckMcpRepo | null> {
  if (!githubUrl) return null;
  try {
    const r = await fetch(`${API}/api/repo?repo=${encodeURIComponent(githubUrl)}`, {
      next: { revalidate: 21600 }, signal: AbortSignal.timeout(6000), // cache 6h, jamais bloquant
    });
    if (!r.ok) return null;
    const d = (await r.json()) as CheckMcpRepo;
    return d.error ? null : d;
  } catch {
    return null;
  }
}
