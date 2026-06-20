import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Next 16 renamed "middleware" to "proxy". This runs before routes and gates
// access: unauthenticated requests are redirected to /login (pages) or 401'd
// (APIs). The cookie is only checked for presence here — the actual signature
// is verified in the API route handlers (Node runtime), which is where the
// data lives. So a forged cookie still can't read anything.
const PUBLIC = ["/login", "/api/login", "/api/logout"];

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return NextResponse.next();
  }
  if (req.cookies.has("dn_session")) {
    return NextResponse.next();
  }
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  return NextResponse.redirect(url);
}

export const config = {
  // Run on everything except Next internals and static asset files.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|ico|webmanifest)$).*)"],
};
