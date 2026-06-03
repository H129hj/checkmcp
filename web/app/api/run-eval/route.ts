import { NextResponse } from "next/server";
import { getUser } from "../../../lib/auth";
import { planOf } from "../../../lib/plans";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const API = process.env.CHECKMCP_API || "http://127.0.0.1:8799";

// Pro-only behavioral eval, triggered from the report UI. The browser has a session (not an API key),
// so we authorize here against the plan, then forward to the engine with the shared internal secret.
// Optional target Bearer (for OAuth-gated servers) is passed through.
export async function GET(req: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "auth required" }, { status: 401 });
  if (!planOf(user.plan).privateAudits) {
    return NextResponse.json(
      { error: "behavioral evals require a Pro plan", upgrade: "https://checkmcp.dev/pricing" },
      { status: 402 }
    );
  }
  const target = new URL(req.url).searchParams.get("url");
  if (!target) return NextResponse.json({ error: "url required" }, { status: 400 });

  const headers: Record<string, string> = {
    "X-CheckMCP-Internal": process.env.CHECKMCP_INTERNAL_SECRET || "",
  };
  const incomingAuth = req.headers.get("authorization");
  if (incomingAuth) headers["Authorization"] = incomingAuth; // OAuth target token, if any

  try {
    const r = await fetch(`${API}/api/score?url=${encodeURIComponent(target)}&evals=1`, {
      headers,
      cache: "no-store",
    });
    const body = await r.text();
    return new NextResponse(body, { status: r.status, headers: { "content-type": "application/json" } });
  } catch {
    return NextResponse.json({ error: "engine unreachable" }, { status: 502 });
  }
}
