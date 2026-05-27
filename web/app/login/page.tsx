"use client";
import { useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

export default function Login() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    const supabase = supabaseBrowser();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${location.origin}/auth/callback` },
    });
    if (error) setErr(error.message);
    else setSent(true);
  }

  return (
    <main>
      <h1>CheckMCP</h1>
      <p style={{ color: "#8888A0" }}>Surveille la qualité, la sécurité et le context-cost de tes serveurs MCP.</p>
      {sent ? (
        <p>✅ Lien magique envoyé à <b>{email}</b>. Vérifie ta boîte mail.</p>
      ) : (
        <form onSubmit={send} style={{ display: "flex", gap: 8, marginTop: 16 }}>
          <input type="email" required placeholder="ton@email.com" value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{ flex: 1, padding: 10, borderRadius: 6, border: "1px solid #333", background: "#16161f", color: "#fff" }} />
          <button type="submit" style={{ padding: "10px 16px", borderRadius: 6, border: 0, background: "#2ea44f", color: "#fff", fontWeight: 600 }}>
            Recevoir le lien
          </button>
        </form>
      )}
      {err && <p style={{ color: "#e05d44" }}>{err}</p>}
    </main>
  );
}
