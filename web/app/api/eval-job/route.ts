import { NextResponse } from "next/server";
import { getUser } from "../../../lib/auth";
import { planOf } from "../../../lib/plans";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const API = process.env.CHECKMCP_API || "http://127.0.0.1:8799";

// Async behavioral-eval proxy (Pro). GET ?url= creates a job (202 + {id}); GET ?id= polls it.
// Session-aware: authorizes on plan here, forwards to the engine with the internal secret.
export async function GET(req: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "auth required" }, { status: 401 });
  if (!planOf(user.plan).privateAudits) {
    return NextResponse.json(
      { error: "behavioral evals require a Pro plan", upgrade: "https://checkmcp.dev/pricing" },
      { status: 402 }
    );
  }
  const sp = new URL(req.url).searchParams;
  const id = sp.get("id");
  const url = sp.get("url");
  if (!id && !url) return NextResponse.json({ error: "url or id required" }, { status: 400 });

  const headers: Record<string, string> = { "X-CheckMCP-Internal": process.env.CHECKMCP_INTERNAL_SECRET || "" };
  const incomingAuth = req.headers.get("authorization");
  if (incomingAuth) headers["Authorization"] = incomingAuth;

  const qs = id ? `id=${encodeURIComponent(id)}` : `url=${encodeURIComponent(url!)}`;
  try {
    const r = await fetch(`${API}/api/eval-job?${qs}`, { headers, cache: "no-store" });
    const body = await r.text();
    return new NextResponse(body, { status: r.status, headers: { "content-type": "application/json" } });
  } catch {
    return NextResponse.json({ error: "engine unreachable" }, { status: 502 });
  }
}
