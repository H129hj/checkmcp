// Helpers d'affichage — classes Tailwind STATIQUES (présentes en clair pour ne pas être purgées).

export type Pillars = Record<string, number>;
export interface AuditResult {
  url: string;
  score: number;
  grade: string;
  floor?: string | null;
  pillars: Pillars;
  reliability_confidence?: string;
  findings?: Array<{ pillar: string; severity: string; measured: string; mechanism: string; effect: string; delta: number }>;
  facts?: any;
  optimize?: { suggestions?: Array<any> };
  server?: { name?: string };
  error?: string;
  auth_required?: boolean;
  private?: boolean;
}

// chip complet (texte + bordure + fond) par grade
export const GRADE_CHIP: Record<string, string> = {
  A: "text-g-a border-g-a/40 bg-g-a/10",
  B: "text-g-b border-g-b/40 bg-g-b/10",
  C: "text-g-c border-g-c/40 bg-g-c/10",
  D: "text-g-d border-g-d/40 bg-g-d/10",
  F: "text-g-f border-g-f/40 bg-g-f/10",
};
export const GRADE_TEXT: Record<string, string> = { A: "text-g-a", B: "text-g-b", C: "text-g-c", D: "text-g-d", F: "text-g-f" };
export const GRADE_STROKE: Record<string, string> = { A: "#22c55e", B: "#65a30d", C: "#d99e00", D: "#ea580c", F: "#ef4444" };

export function gradeKey(g?: string): "A" | "B" | "C" | "D" | "F" {
  const k = (g || "F").trim().charAt(0).toUpperCase();
  return (["A", "B", "C", "D", "F"].includes(k) ? k : "F") as any;
}
export function scoreKey(s?: number): "A" | "B" | "C" | "D" | "F" {
  if (s == null) return "F";
  if (s >= 90) return "A";
  if (s >= 80) return "B";
  if (s >= 70) return "C";
  if (s >= 55) return "D";
  return "F";
}

export const PILLARS: Record<string, { label: string; weight: number }> = {
  security:    { label: "Security",      weight: 20 },
  tool_design: { label: "Tool design",   weight: 18 },
  desc_schema: { label: "Schemas / desc", weight: 16 },
  reliability: { label: "Reliability",   weight: 14 },
  token:       { label: "Context-cost",  weight: 12 },
  compliance:  { label: "Compliance",    weight: 12 },
  use_case:    { label: "Coverage",      weight: 8 },
};
export const PILLAR_ORDER = ["security", "tool_design", "desc_schema", "reliability", "token", "compliance", "use_case"];

export const REPO_PILLARS: Record<string, { label: string; weight: number }> = {
  maintenance:   { label: "Maintenance",   weight: 40 },
  license:       { label: "License",       weight: 25 },
  adoption:      { label: "Adoption",      weight: 20 },
  documentation: { label: "Documentation", weight: 15 },
};
export const REPO_PILLAR_ORDER = ["maintenance", "license", "adoption", "documentation"];

export function fmtTokens(n?: number): string {
  if (!n) return "0";
  return n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : String(n);
}
export function hostOf(url: string): string {
  try { return new URL(url).host; } catch { return (url || "").replace(/^https?:\/\//, "").split("/")[0]; }
}
