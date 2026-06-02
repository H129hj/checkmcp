// Auth self-hostée : email + mot de passe (scrypt), sessions par cookie httpOnly, clés API.
import "server-only";
import { cookies } from "next/headers";
import { randomBytes, scryptSync, timingSafeEqual, createHash } from "crypto";
import { q, q1 } from "./db";

const COOKIE = "cmcp_session";
const SESSION_DAYS = 30;

// ---------- mots de passe (scrypt, sel par hash) ----------
export function hashPassword(pw: string): string {
  const salt = randomBytes(16);
  const dk = scryptSync(pw, salt, 64);
  return `scrypt$${salt.toString("hex")}$${dk.toString("hex")}`;
}

export function verifyPassword(pw: string, stored: string): boolean {
  try {
    const [, saltHex, hashHex] = stored.split("$");
    const dk = scryptSync(pw, Buffer.from(saltHex, "hex"), 64);
    return timingSafeEqual(dk, Buffer.from(hashHex, "hex"));
  } catch {
    return false;
  }
}

export interface User { id: string; email: string }

// ---------- sessions ----------
export async function createSession(userId: string) {
  const token = randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + SESSION_DAYS * 864e5);
  await q("INSERT INTO sessions (token, user_id, expires_at) VALUES ($1,$2,$3)", [token, userId, expires]);
  cookies().set(COOKIE, token, {
    httpOnly: true, secure: true, sameSite: "lax", path: "/", expires,
  });
}

export async function destroySession() {
  const token = cookies().get(COOKIE)?.value;
  if (token) await q("DELETE FROM sessions WHERE token=$1", [token]).catch(() => {});
  cookies().delete(COOKIE);
}

export async function getUser(): Promise<User | null> {
  const token = cookies().get(COOKIE)?.value;
  if (!token) return null;
  return q1<User>(
    `SELECT u.id, u.email FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token = $1 AND s.expires_at > now()`,
    [token]
  );
}

// ---------- clés API ----------
export function hashKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

export function newApiKey(): { key: string; hash: string; prefix: string } {
  const key = "cmcp_" + randomBytes(24).toString("base64url");
  return { key, hash: hashKey(key), prefix: key.slice(0, 12) };
}
