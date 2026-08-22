import type { Role } from "@prisma/client";
import { prisma } from "@/server/db";
import { readSessionCookie, verifySessionToken } from "./jwt";
import { HttpApiError } from "@/lib/http-error";

// Node-runtime session guards. Middleware (edge) does the coarse JWT gate;
// these guards additionally verify the user still exists and tokenVersion matches,
// which is what makes password-change revocation immediate (spec-003-v2 AC).

export type SessionUser = { id: number; email: string; name: string; role: Role };

export async function getSession(request: Request): Promise<SessionUser | null> {
  const token = readSessionCookie(request);
  if (!token) return null;
  const claims = await verifySessionToken(token);
  if (!claims) return null;
  const user = await prisma.user.findUnique({
    where: { id: claims.uid },
    select: { id: true, email: true, name: true, role: true, tokenVersion: true },
  });
  if (!user || user.tokenVersion !== claims.tv) return null;
  return { id: user.id, email: user.email, name: user.name, role: user.role };
}

export async function requireAuth(request: Request): Promise<SessionUser> {
  const session = await getSession(request);
  if (!session) throw new HttpApiError(401, "UNAUTHENTICATED", "Authentication required");
  return session;
}

export async function requireRole(request: Request, ...roles: Role[]): Promise<SessionUser> {
  const session = await requireAuth(request);
  if (!roles.includes(session.role)) {
    throw new HttpApiError(403, "FORBIDDEN", "Insufficient role");
  }
  return session;
}
