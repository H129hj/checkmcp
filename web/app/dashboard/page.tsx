import { supabaseServer } from "@/lib/supabase/server";
import { addMonitor, signOut } from "./actions";

const GRADE_COLOR: Record<string, string> = { A: "#2ea44f", B: "#7fbf3f", C: "#dfb317", D: "#fe7d37", F: "#e05d44" };

export default async function Dashboard() {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: monitors } = await supabase
    .from("checkmcp_monitors")
    .select("id,url,label,min_score,is_active")
    .eq("user_id", user!.id)
    .order("created_at", { ascending: false });
  // dernier run par URL
  const { data: runs } = await supabase
    .from("checkmcp_runs")
    .select("url,score,grade,drift,verdict,created_at")
    .eq("user_id", user!.id)
    .order("created_at", { ascending: false });
  const latest = new Map<string, any>();
  (runs || []).forEach((r) => { if (!latest.has(r.url)) latest.set(r.url, r); });

  return (
    <main>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1>CheckMCP — mes monitors</h1>
        <form action={signOut}><button style={{ background: "transparent", color: "#8888A0", border: "1px solid #333", borderRadius: 6, padding: "6px 12px" }}>Déconnexion</button></form>
      </div>
      <p style={{ color: "#8888A0" }}>{user?.email}</p>

      <form action={addMonitor} style={{ display: "flex", gap: 8, margin: "16px 0" }}>
        <input name="url" required placeholder="https://mon-mcp.example.com/mcp"
          style={{ flex: 1, padding: 10, borderRadius: 6, border: "1px solid #333", background: "#16161f", color: "#fff" }} />
        <input name="min_score" type="number" defaultValue={70} min={0} max={100} title="Score minimum (alerte)"
          style={{ width: 80, padding: 10, borderRadius: 6, border: "1px solid #333", background: "#16161f", color: "#fff" }} />
        <button style={{ padding: "10px 16px", borderRadius: 6, border: 0, background: "#2ea44f", color: "#fff", fontWeight: 600 }}>+ Surveiller</button>
      </form>

      {(monitors || []).length === 0 && <p style={{ color: "#8888A0" }}>Aucun monitor. Ajoute l'URL d'un serveur MCP ci-dessus.</p>}
      <ul style={{ listStyle: "none", padding: 0 }}>
        {(monitors || []).map((m) => {
          const r = latest.get(m.url);
          return (
            <li key={m.id} style={{ border: "1px solid #222", borderRadius: 8, padding: 14, marginBottom: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontWeight: 600 }}>{m.label || m.url}</div>
                <div style={{ color: "#8888A0", fontSize: 12 }}>{m.url} · seuil {m.min_score}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                {r ? (
                  <>
                    {typeof r.score === "number" && <span style={{ background: GRADE_COLOR[r.grade] || "#555", color: "#fff", borderRadius: 5, padding: "2px 8px", fontWeight: 700 }}>{r.score} {r.grade}</span>}
                    <div style={{ color: r.drift ? "#fe7d37" : "#8888A0", fontSize: 12, marginTop: 4 }}>{r.drift ? `⚠ ${r.verdict}` : "stable"}</div>
                  </>
                ) : <span style={{ color: "#8888A0", fontSize: 12 }}>baseline épinglée — en attente du 1er check</span>}
              </div>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
