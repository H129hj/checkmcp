export const metadata = { title: "Terms of Service — CheckMCP" };

const ENTITY = process.env.LEGAL_ENTITY || "[LEGAL ENTITY NAME]";
const EMAIL = process.env.LEGAL_EMAIL || "[contact@checkmcp.dev]";
const JURIS = process.env.LEGAL_JURISDICTION || "[France]";

export default function Terms() {
  return (
    <div className="prose prose-invert max-w-3xl py-12 prose-headings:font-extrabold prose-a:text-primary">
      <h1>Terms of Service</h1>
      <p className="text-sm text-base-content/50">Last updated: 2026-06-03. These are the terms governing your use of CheckMCP (the “Service”) operated by {ENTITY}.</p>

      <div className="not-prose my-4 rounded-lg border border-g-c/40 bg-g-c/10 p-3 text-sm text-g-c">
        ⚠️ Template — have these terms reviewed by a qualified lawyer and fill the entity/jurisdiction details before taking payments.
      </div>

      <h2>1. The Service</h2>
      <p>CheckMCP provides auditing, scoring, monitoring and a security gateway for Model Context Protocol (MCP) servers, via the website, API, CLI and self-hosted gateway. The Service is provided “as is”; scores and security findings are informational and do not constitute a security guarantee.</p>

      <h2>2. Accounts</h2>
      <p>You are responsible for the security of your account, API keys and gateway secrets, and for all activity under them. You must provide accurate information and be at least 18 years old (or the age of majority in your jurisdiction).</p>

      <h2>3. Plans, billing & taxes</h2>
      <ul>
        <li>Paid plans (Pro, Team) are billed monthly in advance via Stripe. Prices are shown on the pricing page in USD and exclude applicable taxes (VAT/sales tax), which are added at checkout where required.</li>
        <li>Your subscription renews automatically each month until cancelled. You authorise recurring charges to your payment method.</li>
        <li>You can cancel anytime from the billing portal; access continues until the end of the current paid period.</li>
      </ul>

      <h2>4. Refunds & cancellation</h2>
      <p>Except where required by law, payments are non-refundable and we do not provide refunds or credits for partial periods. EU/EEA consumers may have a statutory right of withdrawal; by starting to use a paid feature you may be agreeing to begin the service immediately and waive that right where permitted. Cancelling stops future renewals.</p>

      <h2>5. Acceptable use</h2>
      <p>You may only audit, monitor or proxy MCP servers you own or are authorised to test. You must not use the Service to attack, overload, or gain unauthorised access to systems, to violate any law, or to resell the Service without permission. We may rate-limit, suspend or terminate accounts that abuse the Service.</p>

      <h2>6. The behavioral gateway</h2>
      <p>The gateway (hosted or self-hosted) inspects and, in active mode, may block or alter MCP tool traffic. It is a best-effort safeguard and may produce false positives or miss threats. You remain responsible for your agents and the servers you connect.</p>

      <h2>7. Intellectual property</h2>
      <p>The Service and its content are owned by {ENTITY}. The open-source CLI and gateway are licensed under their stated open-source licence (MIT). Your audit data remains yours; you grant us a licence to process it to provide the Service.</p>

      <h2>8. Disclaimers & liability</h2>
      <p>To the maximum extent permitted by law, the Service is provided without warranties of any kind, and our aggregate liability is limited to the amounts you paid in the 12 months before the claim. We are not liable for indirect or consequential damages, nor for security incidents arising from servers you audit or proxy.</p>

      <h2>9. Changes & termination</h2>
      <p>We may modify the Service or these terms; material changes will be notified. We may suspend or terminate the Service for breach. You may stop using the Service at any time.</p>

      <h2>10. Governing law</h2>
      <p>These terms are governed by the laws of {JURIS}, and disputes are subject to its competent courts, without prejudice to mandatory consumer-protection rights.</p>

      <h2>11. Contact</h2>
      <p>Questions: {EMAIL}.</p>
    </div>
  );
}
