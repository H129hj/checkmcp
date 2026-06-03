import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { stripe, planForPrice } from "../../../../lib/stripe";
import { q } from "../../../../lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Stripe needs the raw, unparsed body to verify the signature.
export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return new NextResponse("billing not configured", { status: 503 });

  const sig = req.headers.get("stripe-signature") || "";
  const raw = await req.text();
  let event: Stripe.Event;
  try {
    event = stripe().webhooks.constructEvent(raw, sig, secret);
  } catch {
    return new NextResponse("bad signature", { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const s = event.data.object as Stripe.Checkout.Session;
        const userId = (s.metadata?.user_id as string) || (s.client_reference_id as string) || null;
        const customer = (s.customer as string) || null;
        if (s.subscription) {
          const sub = await stripe().subscriptions.retrieve(s.subscription as string);
          await applySubscription(sub, userId, customer);
        } else if (userId) {
          await q("UPDATE users SET stripe_customer_id=COALESCE($2, stripe_customer_id) WHERE id=$1", [userId, customer]);
        }
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        await applySubscription(sub, (sub.metadata?.user_id as string) || null, sub.customer as string);
        break;
      }
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        await q(
          "UPDATE users SET plan='free', plan_status='canceled' WHERE stripe_customer_id=$1 OR id=$2",
          [sub.customer as string, (sub.metadata?.user_id as string) || null]
        );
        break;
      }
    }
  } catch {
    // never 500 back to Stripe for a transient DB hiccup — it would retry forever.
    return NextResponse.json({ received: true, handled: false });
  }

  return NextResponse.json({ received: true });
}

async function applySubscription(sub: Stripe.Subscription, userId: string | null, customer: string | null) {
  const active = sub.status === "active" || sub.status === "trialing";
  const priceId = sub.items.data[0]?.price?.id;
  const plan = active ? planForPrice(priceId) : "free";
  const renews = sub.current_period_end ? new Date(sub.current_period_end * 1000) : null;
  if (userId) {
    await q(
      "UPDATE users SET plan=$2, plan_status=$3, plan_renews_at=$4, stripe_customer_id=COALESCE($5, stripe_customer_id) WHERE id=$1",
      [userId, plan, sub.status, renews, customer]
    );
  } else if (customer) {
    await q(
      "UPDATE users SET plan=$2, plan_status=$3, plan_renews_at=$4 WHERE stripe_customer_id=$1",
      [customer, plan, sub.status, renews]
    );
  }
}
