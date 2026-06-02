"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { q, q1 } from "../../lib/db";
import { hashPassword, verifyPassword, createSession, destroySession, getUser, newApiKey } from "../../lib/auth";

const API = process.env.CHECKMCP_API || "http://127.0.0.1:8799";
const emailOk = (e: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e);

export type FormState = { error?: string } | undefined;

export async function signup(_prev: FormState, fd: FormData): Promise<FormState> {
  const email = String(fd.get("email") || "").trim().toLowerCase();
  const pw = String(fd.get("password") || "");
  if (!emailOk(email)) return { error: "Email invalide." };
  if (pw.length < 8) return { error: "Mot de passe : 8 caractères minimum." };
  const exists = await q1("SELECT 1 FROM users WHERE email=$1", [email]);
  if (exists) return { error: "Un compte existe déjà avec cet email." };
  const u = await q1<{ id: string }>(
    "INSERT INTO users (email, pass_hash) VALUES ($1,$2) RETURNING id",
    [email, hashPassword(pw)]
  );
  await createSession(u!.id);
  redirect("/account");
}

export async function login(_prev: FormState, fd: FormData): Promise<FormState> {
  const email = String(fd.get("email") || "").trim().toLowerCase();
  const pw = String(fd.get("password") || "");
  const u = await q1<{ id: string; pass_hash: string }>("SELECT id, pass_hash FROM users WHERE email=$1", [email]);
  if (!u || !verifyPassword(pw, u.pass_hash)) return { error: "Email ou mot de passe incorrect." };
  await createSession(u.id);
  redirect("/account");
}

export async function logout() {
  await destroySession();
  redirect("/");
}

export async function followMonitor(fd: FormData) {
  const user = await getUser();
  if (!user) redirect("/login");
  const url = String(fd.get("url") || "").trim();
  if (!url) return;
  // s'assure qu'une baseline globale existe (le moteur Python épingle le fingerprint)
  try { await fetch(`${API}/api/monitor?url=${encodeURIComponent(url)}&pin=1`, { cache: "no-store" }); } catch {}
  await q(
    `INSERT INTO user_monitors (user_id, url, min_score) VALUES ($1,$2,$3)
     ON CONFLICT (user_id, url) DO UPDATE SET min_score=EXCLUDED.min_score`,
    [user!.id, url, Number(fd.get("min_score")) || null]
  );
  revalidatePath("/account");
}

export async function unfollowMonitor(fd: FormData) {
  const user = await getUser();
  if (!user) redirect("/login");
  await q("DELETE FROM user_monitors WHERE user_id=$1 AND url=$2", [user!.id, String(fd.get("url"))]);
  revalidatePath("/account");
}

export async function createApiKey(fd: FormData) {
  const user = await getUser();
  if (!user) redirect("/login");
  const { key, hash, prefix } = newApiKey();
  await q("INSERT INTO api_keys (user_id, name, key_hash, prefix) VALUES ($1,$2,$3,$4)", [
    user!.id, String(fd.get("name") || "default"), hash, prefix,
  ]);
  // la clé en clair n'est montrée qu'une fois, via cookie flash lu par /account
  const { cookies } = await import("next/headers");
  cookies().set("cmcp_newkey", key, { httpOnly: true, secure: true, sameSite: "lax", path: "/account", maxAge: 30 });
  revalidatePath("/account");
}

export async function deleteApiKey(fd: FormData) {
  const user = await getUser();
  if (!user) redirect("/login");
  await q("DELETE FROM api_keys WHERE id=$1 AND user_id=$2", [String(fd.get("id")), user!.id]);
  revalidatePath("/account");
}

// Enregistre un audit dans l'historique de l'utilisateur connecté (no-op si anonyme).
export async function trackAudit(url: string) {
  const user = await getUser();
  if (!user || !url) return;
  await q(
    `INSERT INTO user_audits (user_id, url) VALUES ($1,$2)
     ON CONFLICT (user_id, url) DO UPDATE SET created_at = now()`,
    [user.id, url]
  );
}
