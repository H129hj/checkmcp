// Lazy Stripe client — reads keys from env so the app boots even before billing is configured.
import "server-only";
import Stripe from "stripe";
import type { PlanId } from "./plans";

let _stripe: Stripe | null = null;

export function stripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
  if (!_stripe) _stripe = new Stripe(key, { apiVersion: "2024-06-20" });
  return _stripe;
}

export function billingEnabled(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_PRICE_PRO);
}

export const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://checkmcp.dev";

// Map plan → Stripe price id (set these in the env once the products exist).
export function priceIdFor(plan: PlanId): string | null {
  if (plan === "pro") return process.env.STRIPE_PRICE_PRO || null;
  if (plan === "team") return process.env.STRIPE_PRICE_TEAM || null;
  return null;
}

// Map Stripe price id back to a plan (used by the webhook).
export function planForPrice(priceId?: string | null): PlanId {
  if (priceId && priceId === process.env.STRIPE_PRICE_TEAM) return "team";
  if (priceId && priceId === process.env.STRIPE_PRICE_PRO) return "pro";
  return "free";
}
