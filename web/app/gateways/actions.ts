"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { randomBytes } from "crypto";
import { q, q1 } from "../../lib/db";
import { getUser } from "../../lib/auth";
import { planOf } from "../../lib/plans";

const LIMIT: Record<string, number> = { free: 0, pro: 10, team: 50 };

export async function createGateway(fd: FormData) {
  const user = await getUser();
  if (!user) redirect("/login");
  if (!planOf(user.plan).privateAudits) redirect("/pricing?reason=webhook");
  const backend = String(fd.get("backend_url") || "").trim();
  if (!/^https?:\/\/.+/.test(backend)) return;
  // anti-SSRF (UX) : rejette les backends manifestement privés ; le moteur revérifie au runtime (DNS+IP)
  const host = (() => { try { return new URL(backend).hostname.toLowerCase(); } catch { return ""; } })();
  if (/^(localhost|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|0\.0\.0\.0|\[?::1\]?)/.test(host)) return;
  const label = String(fd.get("label") || "").trim().slice(0, 80) || null;
  const c = await q1<{ n: string }>("SELECT count(*) AS n FROM gateways WHERE user_id=$1", [user.id]);
  if (Number(c?.n || 0) >= (LIMIT[user.plan] ?? 0)) redirect("/pricing?reason=webhook");
  const id = "gw_" + randomBytes(9).toString("base64url");
  const secret = randomBytes(24).toString("base64url");
  await q("INSERT INTO gateways (id, user_id, backend_url, label, secret) VALUES ($1,$2,$3,$4,$5)", [id, user.id, backend, label, secret]);
  revalidatePath("/gateways");
}

export async function setGatewayMode(fd: FormData) {
  const user = await getUser();
  if (!user) redirect("/login");
  if (!planOf(user.plan).privateAudits) redirect("/pricing?reason=webhook");
  const id = String(fd.get("id"));
  const mode = String(fd.get("mode")) === "active" ? "active" : "passive";
  await q("UPDATE gateways SET mode=$3 WHERE id=$1 AND user_id=$2", [id, user.id, mode]);
  revalidatePath("/gateways");
}

export async function deleteGateway(fd: FormData) {
  const user = await getUser();
  if (!user) redirect("/login");
  const id = String(fd.get("id"));
  await q("DELETE FROM gateways WHERE id=$1 AND user_id=$2", [id, user.id]);
  await q("DELETE FROM gateway_calls WHERE gateway_id=$1", [id]);
  revalidatePath("/gateways");
}
