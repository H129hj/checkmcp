"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { q } from "../../lib/db";
import { getUser } from "../../lib/auth";
import { planOf } from "../../lib/plans";

const hosts = (fd: FormData, k: string) =>
  String(fd.get(k) || "").split(/[\s,]+/).map((x) => x.trim().toLowerCase()).filter(Boolean).slice(0, 200);

export async function savePolicy(fd: FormData) {
  const user = await getUser();
  if (!user) redirect("/login");
  if (!planOf(user.plan).privateAudits) redirect("/pricing?reason=webhook"); // governance = Pro+

  const sev = String(fd.get("max_severity"));
  const config = {
    min_score: Math.max(0, Math.min(100, Number(fd.get("min_score")) || 0)),
    max_severity: ["LOW", "MEDIUM", "HIGH", "CRITICAL"].includes(sev) ? sev : "MEDIUM",
    block_floor: fd.get("block_floor") === "on",
    block_lethal_trifecta: fd.get("block_lethal_trifecta") === "on",
    block_malicious_eval: fd.get("block_malicious_eval") === "on",
    require_monitored: fd.get("require_monitored") === "on",
    allowlist_hosts: hosts(fd, "allowlist_hosts"),
    denylist_hosts: hosts(fd, "denylist_hosts"),
  };
  await q(
    `INSERT INTO policies (user_id, config, updated_at) VALUES ($1,$2,now())
     ON CONFLICT (user_id) DO UPDATE SET config=$2, updated_at=now()`,
    [user.id, JSON.stringify(config)]
  );
  revalidatePath("/policy");
}
