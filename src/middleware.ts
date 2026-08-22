import type { NextRequest } from "next/server";
import { guard } from "@/server/auth/middleware-guard";

export async function middleware(request: NextRequest) {
  return guard(request);
}

export const config = {
  // Run on everything except static assets and Next internals.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
