import { redirect } from "next/navigation";
import Link from "next/link";
import { getUser } from "../../lib/auth";
import { q, q1 } from "../../lib/db";
import { planOf } from "../../lib/plans";
import { savePolicy } from "./actions";
import CopyButton from "../../components/CopyButton";

export const metadata = { title: "Governance policy — CheckMCP" };
export const dynamic = "force-dynamic";

const DEFAULTS = {
  min_score: 70, max_severity: "MEDIUM", block_floor: true, block_lethal_trifecta: true,
  block_malicious_eval: true, require_monitored: false, allowlist_hosts: [], denylist_hosts: [],
};

export default async function PolicyPage() {
  const user = await getUser();
  if (!user) redirect("/login");
  const plan = planOf(user.plan);
  const canEdit = plan.privateAudits;

  const row = await q1<{ config: any }>("SELECT config FROM policies WHERE user_id=$1", [user.id]);
  const p = { ...DEFAULTS, ...(row?.config || {}) };
  const keyRow = await q1<{ prefix: string }>("SELECT prefix FROM api_keys WHERE user_id=$1 ORDER BY created_at DESC LIMIT 1", [user.id]);

  const SEV = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
  const Toggle = ({ name, label, checked, desc }: any) => (
    <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-base-content/10 bg-base-100/40 p-3">
      <input type="checkbox" name={name} defaultChecked={checked} disabled={!canEdit} className="checkbox checkbox-sm checkbox-primary mt-0.5" />
      <span><span className="font-semibold">{label}</span><span className="block text-xs text-base-content/50">{desc}</span></span>
    </label>
  );

  return (
    <div className="py-12">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="font-mono text-xs uppercase tracking-[0.22em] text-primary/80">Governance</div>
          <h1 className="mt-2 text-3xl font-extrabold">MCP usage policy</h1>
          <p className="mt-1 max-w-2xl text-sm text-base-content/60">Define which MCP servers your agents are allowed to use. Your CI, agents or gateway call <code className="text-primary">/policy/check</code> before connecting to a server and get an allow/deny verdict with reasons.</p>
        </div>
        <Link href="/fleet" className="btn btn-ghost btn-sm">Fleet ›</Link>
      </div>

      {!canEdit && (
        <div role="alert" className="alert mt-6 border-primary/40 bg-primary/5">
          <span>Governance policies are a <b>Pro</b> feature. You can preview the defaults below. <Link href="/pricing?reason=webhook" className="text-primary">Upgrade ›</Link></span>
        </div>
      )}

      <form action={savePolicy} className="mt-7 grid gap-5 lg:grid-cols-2">
        <div className="card border border-base-content/10 bg-base-200/60">
          <div className="card-body gap-4">
            <h2 className="text-lg font-extrabold">Thresholds</h2>
            <label className="form-control">
              <span className="label-text mb-1 text-sm">Minimum MCP Score</span>
              <input name="min_score" type="number" min={0} max={100} defaultValue={p.min_score} disabled={!canEdit} className="input input-bordered input-sm w-28 bg-base-100 font-mono" />
            </label>
            <label className="form-control">
              <span className="label-text mb-1 text-sm">Max allowed security finding severity</span>
              <select name="max_severity" defaultValue={p.max_severity} disabled={!canEdit} className="select select-bordered select-sm w-40 bg-base-100 font-mono">
                {SEV.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
          </div>
        </div>

        <div className="card border border-base-content/10 bg-base-200/60">
          <div className="card-body gap-2">
            <h2 className="mb-1 text-lg font-extrabold">Hard rules</h2>
            <Toggle name="block_floor" label="Block on security hard-floor" checked={p.block_floor} desc="secret-in-schema, failed handshake, etc." />
            <Toggle name="block_lethal_trifecta" label="Block lethal trifecta" checked={p.block_lethal_trifecta} desc="untrusted content + sensitive data + exfil/destructive" />
            <Toggle name="block_malicious_eval" label="Block on malicious runtime eval" checked={p.block_malicious_eval} desc="behavioral eval confirmed injection/exfiltration" />
            <Toggle name="require_monitored" label="Require a pinned baseline" checked={p.require_monitored} desc="only allow servers under continuous monitoring" />
          </div>
        </div>

        <div className="card border border-base-content/10 bg-base-200/60">
          <div className="card-body gap-2">
            <h2 className="text-lg font-extrabold">Allowlist <span className="font-mono text-xs text-base-content/40">(hosts, optional)</span></h2>
            <p className="text-xs text-base-content/50">If set, ONLY these hosts pass. One host per line.</p>
            <textarea name="allowlist_hosts" defaultValue={(p.allowlist_hosts || []).join("\n")} disabled={!canEdit} rows={4} placeholder="mcp.deepwiki.com" className="textarea textarea-bordered bg-base-100 font-mono text-sm" />
          </div>
        </div>
        <div className="card border border-base-content/10 bg-base-200/60">
          <div className="card-body gap-2">
            <h2 className="text-lg font-extrabold">Denylist <span className="font-mono text-xs text-base-content/40">(hosts)</span></h2>
            <p className="text-xs text-base-content/50">These hosts are always blocked. One host per line.</p>
            <textarea name="denylist_hosts" defaultValue={(p.denylist_hosts || []).join("\n")} disabled={!canEdit} rows={4} placeholder="sketchy-mcp.example.com" className="textarea textarea-bordered bg-base-100 font-mono text-sm" />
          </div>
        </div>

        <div className="lg:col-span-2">
          <button className="btn btn-primary btn-sm" type="submit" disabled={!canEdit}>Save policy</button>
        </div>
      </form>

      {/* API docs */}
      <h2 className="mb-2 mt-10 text-xl font-extrabold">Use the verdict API</h2>
      <p className="mb-3 text-sm text-base-content/60">Authenticate with your API key (header <code>X-CheckMCP-Key</code>). Counts against your plan’s daily API quota.</p>
      <div className="card border border-base-content/10 bg-base-200/60">
        <div className="card-body gap-3">
          <div className="flex items-center gap-3">
            <code className="min-w-0 flex-1 overflow-x-auto whitespace-pre rounded-lg bg-base-300/60 p-3 font-mono text-xs">{`curl -H "X-CheckMCP-Key: ${keyRow?.prefix || "cmcp_…"}…" \\
  "https://checkmcp.dev/policy/check?url=https://mcp.example.com/mcp"`}</code>
            <CopyButton text={`curl -H "X-CheckMCP-Key: <YOUR_KEY>" "https://checkmcp.dev/policy/check?url=https://mcp.example.com/mcp"`} />
          </div>
          <pre className="overflow-x-auto rounded-lg bg-base-300/40 p-3 font-mono text-xs text-base-content/70">{`{ "allowed": false, "score": 69, "grade": "D",
  "reasons": ["MCP Score 69 below minimum 70",
              "security hard-floor: SECURITY_RISK"] }`}</pre>
          {!keyRow && <p className="text-xs text-base-content/50">No API key yet — create one in <Link href="/account" className="text-primary">your space</Link>.</p>}
        </div>
      </div>
    </div>
  );
}
