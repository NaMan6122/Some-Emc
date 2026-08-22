import { NextResponse, type NextRequest } from "next/server";
import { readSessionCookie, verifySessionToken } from "./jwt";

// Edge-runtime coarse gate (spec-003-v2). No DB access here — tokenVersion
// revocation is enforced per-request by src/server/auth/guards.ts.
//
//  - Public paths pass through: /login, /api/v1/auth/*
//  - Unauthenticated API (/api/v1/**) → 401 envelope JSON
//  - Unauthenticated pages → redirect to /login
//  - Authenticated visitors of /login → redirect to /

const PUBLIC_PREFIXES = ["/login", "/api/v1/auth/", "/api/health"];

export async function guard(request: NextRequest): Promise<NextResponse | undefined> {
  const { pathname } = request.nextUrl;
  if (PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) {
    // Signed-in users skip the login page; auth API stays open for everyone.
    if (pathname === "/login" && (await isValid(request))) {
      return NextResponse.redirect(new URL("/", request.url));
    }
    return undefined;
  }

  if (!(await isValid(request))) {
    if (pathname.startsWith("/api")) {
      return NextResponse.json(
        { error: { code: "UNAUTHENTICATED", message: "Authentication required" } },
        { status: 401 },
      );
    }
    // Preserve the deep link so login can return the user to their target (spec-009 AC).
    const target = pathname + request.nextUrl.search;
    const loginUrl = new URL(`/login?next=${encodeURIComponent(target)}`, request.url);
    return NextResponse.redirect(loginUrl);
  }
  return undefined;
}

async function isValid(request: NextRequest): Promise<boolean> {
  const token = readSessionCookie(request);
  if (!token) return false;
  return (await verifySessionToken(token)) !== null;
}
