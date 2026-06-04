export const metadata = { title: "Privacy Policy — CheckMCP", description: "How CheckMCP collects, uses and protects your data — GDPR/CCPA rights, sub-processors and retention.", alternates: { canonical: "/privacy" } };

const ENTITY = process.env.LEGAL_ENTITY || "[LEGAL ENTITY NAME]";
const EMAIL = process.env.LEGAL_EMAIL || "[contact@checkmcp.dev]";

export default function Privacy() {
  return (
    <div className="prose prose-invert max-w-3xl py-12 prose-headings:font-extrabold prose-a:text-primary">
      <h1>Privacy Policy</h1>
      <p className="text-sm text-base-content/50">Last updated: 2026-06-03. {ENTITY} (“we”) is the data controller for CheckMCP.</p>

      <div className="not-prose my-4 rounded-lg border border-g-c/40 bg-g-c/10 p-3 text-sm text-g-c">
        ⚠️ Template — have it reviewed and complete the entity details before launch (GDPR/CCPA compliance is your responsibility).
      </div>

      <h2>1. Data we collect</h2>
      <ul>
        <li><b>Account</b>: your email and a hashed password (scrypt). Sessions via an httpOnly cookie.</li>
        <li><b>Billing</b>: handled by <a href="https://stripe.com">Stripe</a> — we store a Stripe customer id, plan and status, not your card details.</li>
        <li><b>Usage</b>: MCP server URLs you audit/monitor, scores, findings, API-key usage counts, and gateway call logs (method/tool/verdict/timestamps).</li>
        <li><b>Technical</b>: IP address (for rate-limiting/abuse prevention) and basic request logs.</li>
      </ul>
      <p>Public audits of public MCP servers may appear in the public directory. Private (token) audits are never cached or published. The self-hosted gateway processes tool traffic inside <i>your</i> infrastructure — that data does not reach us.</p>

      <h2>2. Why we use it (legal bases)</h2>
      <p>To provide the Service and your account (contract), to bill you (contract), to secure the Service and prevent abuse (legitimate interest), and to comply with legal obligations. We do not sell your personal data.</p>

      <h2>3. Sub-processors</h2>
      <ul>
        <li>Stripe (payments), the hosting provider (Contabo/VPS), Cloudflare (CDN/proxy). Each processes data to provide their part of the Service.</li>
      </ul>

      <h2>4. Retention</h2>
      <p>Account data is kept while your account is active. Logs and usage data are kept for a limited period for security and analytics, then deleted or anonymised. You can request deletion of your account.</p>

      <h2>5. Your rights</h2>
      <p>If you are in the EU/EEA (GDPR) or California (CCPA), you can request access, correction, deletion, portability, or object to certain processing. Contact {EMAIL}. You may also lodge a complaint with your data-protection authority.</p>

      <h2>6. Cookies</h2>
      <p>We use a strictly-necessary session cookie for authentication and a theme preference stored locally. We do not use third-party advertising cookies.</p>

      <h2>7. Security</h2>
      <p>Passwords are hashed (scrypt), API keys are stored hashed, transport is over HTTPS. No method is perfectly secure; we work to protect your data but cannot guarantee absolute security.</p>

      <h2>8. Contact</h2>
      <p>Privacy questions or requests: {EMAIL}.</p>
    </div>
  );
}
