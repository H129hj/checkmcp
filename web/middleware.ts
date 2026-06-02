import { NextResponse, type NextRequest } from "next/server";

// Garde légère : présence du cookie de session. La vérif réelle (DB) se fait dans /account.
export function middleware(req: NextRequest) {
  if (!req.cookies.get("cmcp_session")) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = { matcher: ["/account/:path*"] };
