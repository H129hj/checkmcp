"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";

export async function addMonitor(formData: FormData) {
  const url = String(formData.get("url") || "").trim();
  const min_score = Number(formData.get("min_score") || 70);
  if (!url) return;
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  await supabase.from("checkmcp_monitors").upsert(
    { user_id: user.id, url, min_score, is_active: true },
    { onConflict: "user_id,url" }
  );
  // Épingle la baseline initiale via l'API CheckMCP (best-effort).
  try {
    await fetch(`${process.env.CHECKMCP_API}/api/monitor?url=${encodeURIComponent(url)}&user_id=${user.id}&pin=1`, {
      signal: AbortSignal.timeout(20000),
    });
  } catch { /* l'utilisateur pourra re-pin plus tard */ }
  revalidatePath("/dashboard");
}

export async function signOut() {
  const supabase = await supabaseServer();
  await supabase.auth.signOut();
  redirect("/login");
}
