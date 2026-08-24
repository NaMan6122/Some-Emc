import { SignJWT, jwtVerify } from "jose";
import { authSecret } from "@/server/env";

// Edge-safe session primitives (no Prisma import here) — used by middleware and guards.
export const SESSION_COOKIE = "procare_session";
const SEVEN_DAYS_S = 7 * 24 * 60 * 60;

export type SessionClaims = { uid: number; role: string; tv: number };

function secret(): Uint8Array {
  return authSecret();
}

export async function signSessionToken(claims: SessionClaims): Promise<string> {
  return new SignJWT({ ...claims })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SEVEN_DAYS_S}s`)
    .sign(secret());
}

export async function verifySessionToken(token: string): Promise<SessionClaims | null> {
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ["HS256"] });
    const { uid, role, tv } = payload as Record<string, unknown>;
    if (typeof uid !== "number" || typeof role !== "string" || typeof tv !== "number") return null;
    return { uid, role, tv };
  } catch {
    return null;
  }
}

export function sessionCookieOptions(maxAgeSeconds: number = SEVEN_DAYS_S) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: maxAgeSeconds,
  };
}

export function serializeSetCookie(token: string, maxAgeSeconds: number = SEVEN_DAYS_S): string {
  const o = sessionCookieOptions(maxAgeSeconds);
  // Manual serialization so route handlers stay plain-Response testable.
  const parts = [
    `${SESSION_COOKIE}=${token}`,
    `Path=${o.path}`,
    `Max-Age=${o.maxAge}`,
    "HttpOnly",
    "SameSite=Lax",
  ];
  if (o.secure) parts.push("Secure");
  return parts.join("; ");
}

export function clearSessionCookie(): string {
  return serializeSetCookie("", 0);
}

export function readSessionCookie(request: Request): string | undefined {
  const header = request.headers.get("cookie");
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === SESSION_COOKIE) return rest.join("=");
  }
  return undefined;
}
