// Single source of truth for CheckMCP plans (mirrored in checkmcp/plans.py for the API).
export type PlanId = "free" | "pro" | "team";

export interface Plan {
  id: PlanId;
  name: string;
  priceMonthly: number; // USD
  monitors: number; // max followed servers
  apiPerDay: number; // hosted API audits per key per day
  privateAudits: boolean; // OAuth-gated (private) audits
  webhookAlerts: boolean; // drift / threshold webhooks
  blurb: string;
  features: string[];
}

export const PLANS: Record<PlanId, Plan> = {
  free: {
    id: "free",
    name: "Free",
    priceMonthly: 0,
    monitors: 3,
    apiPerDay: 50,
    privateAudits: false,
    webhookAlerts: false,
    blurb: "Audit any public MCP server, forever.",
    features: [
      "Unlimited public audits & full reports",
      "Public directory, badges & embeds",
      "Up to 3 monitored servers",
      "CLI & GitHub Action (50 API audits/day)",
    ],
  },
  pro: {
    id: "pro",
    name: "Pro",
    priceMonthly: 19,
    monitors: 50,
    apiPerDay: 2000,
    privateAudits: true,
    webhookAlerts: true,
    blurb: "For teams shipping their own MCP servers.",
    features: [
      "Everything in Free",
      "Private OAuth-gated audits (never cached)",
      "Up to 50 monitored servers",
      "Drift & score-threshold webhook alerts",
      "2,000 API audits/day (CLI & CI)",
    ],
  },
  team: {
    id: "team",
    name: "Team",
    priceMonthly: 99,
    monitors: 500,
    apiPerDay: 20000,
    privateAudits: true,
    webhookAlerts: true,
    blurb: "For platforms auditing MCP at scale.",
    features: [
      "Everything in Pro",
      "Up to 500 monitored servers",
      "20,000 API audits/day",
      "Multiple API keys & priority probing",
      "Continuous rug-pull monitoring",
    ],
  },
};

export const PLAN_ORDER: PlanId[] = ["free", "pro", "team"];

export function planOf(id?: string | null): Plan {
  return PLANS[(id as PlanId) || "free"] || PLANS.free;
}
