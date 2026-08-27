import { updateSession } from "@/lib/supabase/middleware";
import { NextRequest, NextResponse } from "next/server";
import { isLocal } from "./lib/isLocal";

// Opt-in origin lock. The origin answers anyone who knows its IP, which
// lets a caller skip Cloudflare entirely and spoof cf-connecting-ip
// (every per-IP rate limit keys on it). When ORIGIN_TOKEN is set, a
// Cloudflare Transform Rule adds `x-origin-token: <same value>` to every
// proxied request and anything without it is refused here. Unset means
// no change in behaviour, so local dev and the current deploy are
// unaffected until the rule is in place.
//
// Edge runtime: no node crypto, so the compare is a hand-rolled
// constant-time XOR over equal-length strings.
function tokenMatches(given: string | null, expected: string): boolean {
  if (!given || given.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= given.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0;
}

// The compose healthcheck (and anyone curling inside the container)
// arrives as Host: localhost:3000, never through Cloudflare.
function isLoopbackHost(request: NextRequest): boolean {
  const host = (request.headers.get("host") ?? "").split(":")[0];
  return host === "localhost" || host === "127.0.0.1" || host === "[::1]";
}

export async function middleware(request: NextRequest) {
  const originToken = process.env.ORIGIN_TOKEN;
  if (originToken && !isLoopbackHost(request)) {
    if (!tokenMatches(request.headers.get("x-origin-token"), originToken)) {
      return new NextResponse(null, { status: 403 });
    }
  }

  if (isLocal()) {
    return NextResponse.next();
  }
  // update user's auth session
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * Feel free to modify this pattern to include more paths.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
