import { NextResponse, type NextRequest } from "next/server";

// Rychlá brána: bez session cookie (a bez API tokenu) rovnou na přihlášení. Platnost session
// ověřuje až server (src/server/auth.ts) – sem DB nepatří.
const PUBLIC = ["/prihlaseni", "/_next", "/favicon.ico", "/robots.txt"];

export function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const res = PUBLIC.some((p) => pathname.startsWith(p)) || pathname.startsWith("/api/") || hasAuth(req)
    ? NextResponse.next()
    : NextResponse.redirect(new URL(`/prihlaseni/?next=${encodeURIComponent(pathname + search)}`, req.url));
  res.headers.set("X-Robots-Tag", "noindex, nofollow");
  return res;
}

function hasAuth(req: NextRequest) {
  return req.cookies.has("rodokmen_session") || req.headers.get("authorization")?.startsWith("Bearer ");
}

export const config = {
  // _next (chunky, HMR, dev nástroje) ani statické soubory přes bránu nejdou
  matcher: "/((?!_next|__nextjs|favicon.ico|robots.txt).*)",
};
