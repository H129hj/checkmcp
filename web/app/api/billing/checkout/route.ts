import { NextResponse } from "next/server";
import { getUser } from "../../../../lib/auth";
import { q } from "../../../../lib/db";
import { stripe, billingEnabled, priceIdFor, BASE_URL } from "../../../../lib/stripe";
import type { PlanId } from "../../../../lib/plans";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const user = await getUser();
  if (!user) return NextResponse.redirect(`${BASE_URL}/login`, 303);
  if (!billingEnabled()) return NextResponse.redirect(`${BASE_URL}/pricing?reason=soon`, 303);

  const form = await req.formData().catch(() => null);
  const plan = String(form?.get("plan") || "pro") as PlanId;
  const price = priceIdFor(plan);
  if (!price) return NextResponse.redirect(`${BASE_URL}/pricing?reason=soon`, 303);

  // Re-use an existing Stripe customer if we have one.
  const row = await q<{ stripe_customer_id: string | null }>(
    "SELECT stripe_customer_id FROM users WHERE id=$1",
    [user.id]
  );
  let customer = row[0]?.stripe_customer_id || undefined;

  try {
    if (!customer) {
      const c = await stripe().customers.create({ email: user.email, metadata: { user_id: user.id } });
      customer = c.id;
      await q("UPDATE users SET stripe_customer_id=$2 WHERE id=$1", [user.id, customer]);
    }
    const session = await stripe().checkout.sessions.create({
      mode: "subscription",
      customer,
      line_items: [{ price, quantity: 1 }],
      success_url: `${BASE_URL}/account?upgraded=1`,
      cancel_url: `${BASE_URL}/pricing?reason=canceled`,
      allow_promotion_codes: true,
      client_reference_id: user.id,
      metadata: { user_id: user.id, plan },
      subscription_data: { metadata: { user_id: user.id, plan } },
      // TVA / sales tax : nécessite "Stripe Tax" activé dans le dashboard. Collecte l'adresse + le n° de TVA.
      ...(process.env.STRIPE_TAX === "0"
        ? {}
        : {
            automatic_tax: { enabled: true },
            tax_id_collection: { enabled: true },
            billing_address_collection: "required" as const,
            customer_update: { address: "auto" as const, name: "auto" as const },
          }),
    });
    return NextResponse.redirect(session.url!, 303);
  } catch (e: any) {
    return NextResponse.redirect(`${BASE_URL}/pricing?reason=error`, 303);
  }
}
