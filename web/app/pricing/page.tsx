import Link from "next/link";
import { getUser } from "../../lib/auth";
import { PLANS, PLAN_ORDER } from "../../lib/plans";
import { billingEnabled } from "../../lib/stripe";

export const metadata = {
  title: "Pricing — CheckMCP",
  description: "Free, Pro and Team plans for auditing, monitoring and securing your MCP servers. Start free, upgrade for private audits, more monitors and drift webhooks.",
};
export const dynamic = "force-dynamic";

const REASONS: Record<string, string> = {
  monitors: "You’ve reached your monitor limit. Upgrade to track more servers.",
  webhook: "Drift & threshold webhooks are a Pro feature. Upgrade to enable them.",
  keys: "You’ve reached your API-key limit. Upgrade for more keys.",
  canceled: "Checkout canceled — no charge was made.",
  soon: "Billing is being finalized. Reach out and we’ll set you up.",
  error: "Something went wrong starting checkout. Please try again.",
};

export default async function Pricing({ searchParams }: { searchParams: { reason?: string } }) {
  const user = await getUser();
  const current = user?.plan || "free";
  const enabled = billingEnabled();
  const reason = searchParams?.reason ? REASONS[searchParams.reason] : null;

  return (
    <div className="py-12">
      <div className="text-center">
        <div className="font-mono text-xs uppercase tracking-[0.22em] text-primary/80">Pricing</div>
        <h1 className="mt-2 text-4xl font-extrabold">Start free. Scale when you ship.</h1>
        <p className="mx-auto mt-3 max-w-2xl text-base-content/60">
          Auditing any public MCP server is free, forever. Paid plans add private OAuth audits, more monitored
          servers and drift webhooks. Cancel anytime.
        </p>
      </div>

      {reason && (
        <div role="alert" className="alert mx-auto mt-6 max-w-2xl border-primary/40 bg-primary/5">
          <span>{reason}</span>
        </div>
      )}

      <div className="mt-10 grid gap-5 md:grid-cols-3">
        {PLAN_ORDER.map((id) => {
          const p = PLANS[id];
          const isCurrent = current === id;
          const featured = id === "pro";
          return (
            <div
              key={id}
              className={`card border bg-base-200/60 ${featured ? "border-primary/50 shadow-[0_0_0_1px_rgba(204,255,0,0.25)]" : "border-base-content/10"}`}
            >
              <div className="card-body gap-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-extrabold">{p.name}</h2>
                  {featured && <span className="badge badge-primary badge-sm font-mono">popular</span>}
                  {isCurrent && <span className="badge badge-sm border-g-a/40 bg-g-a/10 font-mono text-g-a">current</span>}
                </div>
                <div className="flex items-end gap-1">
                  <span className="text-4xl font-extrabold">${p.priceMonthly}</span>
                  <span className="mb-1 text-base-content/50">/mo</span>
                </div>
                <p className="text-sm text-base-content/60">{p.blurb}</p>
                <ul className="mt-1 space-y-2 text-sm">
                  {p.features.map((f) => (
                    <li key={f} className="flex gap-2">
                      <span className="text-primary">✓</span>
                      <span className="text-base-content/80">{f}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-2">
                  {id === "free" ? (
                    <Link href={user ? "/account" : "/signup"} className="btn btn-block btn-outline btn-sm">
                      {isCurrent ? "Your plan" : "Get started"}
                    </Link>
                  ) : isCurrent ? (
                    <form action="/api/billing/portal" method="post">
                      <button className="btn btn-block btn-sm" type="submit">Manage subscription</button>
                    </form>
                  ) : user ? (
                    <form action="/api/billing/checkout" method="post">
                      <input type="hidden" name="plan" value={id} />
                      <button className={`btn btn-block btn-sm ${featured ? "btn-primary" : ""}`} type="submit" disabled={!enabled}>
                        {enabled ? `Upgrade to ${p.name}` : "Coming soon"}
                      </button>
                    </form>
                  ) : (
                    <Link href={`/signup?next=pricing`} className={`btn btn-block btn-sm ${featured ? "btn-primary" : ""}`}>
                      Sign up to upgrade
                    </Link>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <p className="mt-8 text-center text-xs text-base-content/40">
        Prices in USD. The open-source CLI and GitHub Action are free under MIT — paid plans cover the hosted
        directory, private audits and continuous monitoring.
      </p>
    </div>
  );
}
