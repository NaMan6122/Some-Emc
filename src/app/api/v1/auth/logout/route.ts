import { apiHandler } from "@/lib/http-error";
import { clearSessionCookie } from "@/server/auth/jwt";

// spec-003-v2: POST /api/v1/auth/logout — clears the session cookie.
// Idempotent: safe to call without a session (no 401).
export const POST = apiHandler(async () => {
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "content-type": "application/json", "set-cookie": clearSessionCookie() },
  });
});
