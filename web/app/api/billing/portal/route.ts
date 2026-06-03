import { NextResponse } from "next/server";
import { getUser } from "../../../../lib/auth";
import { q } from "../../../../lib/db";
import { stripe, billingEnabled, BASE_URL } from "../../../../lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const user = await getUser();
  if (!user) return NextResponse.redirect(`${BASE_URL}/login`, 303);
  if (!billingEnabled()) return NextResponse.redirect(`${BASE_URL}/account`, 303);

  const row = await q<{ stripe_customer_id: string | null }>(
    "SELECT stripe_customer_id FROM users WHERE id=$1",
    [user.id]
  );
  const customer = row[0]?.stripe_customer_id;
  if (!customer) return NextResponse.redirect(`${BASE_URL}/pricing`, 303);

  try {
    const portal = await stripe().billingPortal.sessions.create({
      customer,
      return_url: `${BASE_URL}/account`,
    });
    return NextResponse.redirect(portal.url, 303);
  } catch {
    return NextResponse.redirect(`${BASE_URL}/account`, 303);
  }
}
