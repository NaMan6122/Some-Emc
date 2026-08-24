import { z } from "zod";
import { prisma } from "@/server/db";
import { apiHandler } from "@/lib/http-error";
import { apiError } from "@/lib/api-envelope";
import { signSessionToken, serializeSetCookie } from "@/server/auth/jwt";
import { checkRateLimit, clearFailures, rateLimitKey, recordFailure } from "@/server/auth/rate-limit";
import { verifyPassword } from "@/server/auth/password-hash";

const bodySchema = z.object({
  email: z.string().email().max(200),
  password: z.string().min(1).max(200),
});

function clientIp(request: Request): string {
  const fwd = request.headers.get("x-forwarded-for");
  return fwd ? fwd.split(",")[0].trim() : "local";
}

// spec-003-v2: POST /api/v1/auth/login
export const POST = apiHandler(async (request) => {
  let parsed: z.infer<typeof bodySchema>;
  try {
    parsed = bodySchema.parse(await request.json());
  } catch {
    return Response.json(apiError("VALIDATION_ERROR", "Invalid login payload"), { status: 422 });
  }

  const email = parsed.email.trim().toLowerCase();
  const key = rateLimitKey(clientIp(request), email);

  const limit = checkRateLimit(key);
  if (limit.limited) {
    return Response.json(apiError("RATE_LIMITED", "Too many failed attempts"), {
      status: 429,
      headers: { "Retry-After": String(limit.retryAfterSeconds) },
    });
  }

  const user = await prisma.user.findUnique({ where: { email } });
  const valid = user ? await verifyPassword(user.passwordHash, parsed.password) : false;
  if (!user || !valid) {
    recordFailure(key);
    return Response.json(apiError("INVALID_CREDENTIALS", "Invalid email or password"), { status: 401 });
  }
  // spec-024-v1: deactivated accounts are locked out with a distinct signal.
  if (!user.active) {
    return Response.json(apiError("USER_INACTIVE", "This account has been deactivated — contact an administrator"), { status: 403 });
  }

  clearFailures(key);
  const token = await signSessionToken({ uid: user.id, role: user.role, tv: user.tokenVersion });
  const body = JSON.stringify({
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
  });
  return new Response(body, {
    status: 200,
    headers: { "content-type": "application/json", "set-cookie": serializeSetCookie(token) },
  });
});
