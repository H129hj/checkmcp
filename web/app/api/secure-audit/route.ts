import { NextResponse } from "next/server";
import { getUser } from "../../../lib/auth";
import { planOf } from "../../../lib/plans";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const API = process.env.CHECKMCP_API || "http://127.0.0.1:8799";

// Server-side private (OAuth) audit proxy. The browser hits this same-origin route with the TARGET
// Bearer token; we verify the logged-in user's plan here, then forward to the engine with the shared
// internal secret (which the browser never sees). This is what makes the Pro gate enforceable —
// the raw engine endpoint refuses Bearer audits without this secret or a Pro API key.
export async function GET(req: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "auth required" }, { status: 401 });
  if (!planOf(user.plan).privateAudits) {
    return NextResponse.json(
      { error: "private OAuth audits require a Pro plan", upgrade: "https://checkmcp.dev/pricing" },
      { status: 402 }
    );
  }
  const target = new URL(req.url).searchParams.get("url");
  if (!target) return NextResponse.json({ error: "url required" }, { status: 400 });
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return NextResponse.json({ error: "token required" }, { status: 400 });

  try {
    const r = await fetch(`${API}/api/score?url=${encodeURIComponent(target)}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "X-CheckMCP-Internal": process.env.CHECKMCP_INTERNAL_SECRET || "",
      },
      cache: "no-store",
    });
    const body = await r.text();
    return new NextResponse(body, { status: r.status, headers: { "content-type": "application/json" } });
  } catch {
    return NextResponse.json({ error: "engine unreachable" }, { status: 502 });
  }
}
