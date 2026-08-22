import { z } from "zod";
import { prisma } from "@/server/db";
import { apiHandler, HttpApiError } from "@/lib/http-error";
import { apiError } from "@/lib/api-envelope";
import { requireAuth } from "@/server/auth/guards";
import { hashPassword, verifyPassword } from "@/server/auth/password-hash";
import { signSessionToken, serializeSetCookie } from "@/server/auth/jwt";

const bodySchema = z.object({
  currentPassword: z.string().min(1).max(200),
  // PRD FR-1 password policy: min length 10.
  newPassword: z.string().min(10).max(200),
});

// spec-003-v2: POST /api/v1/auth/password
// Verifies the current password, stores the new argon2id hash and bumps
// tokenVersion in one transaction — every previously issued token dies hereafter.
export const POST = apiHandler(async (request) => {
  const session = await requireAuth(request);

  let parsed: z.infer<typeof bodySchema>;
  try {
    parsed = bodySchema.parse(await request.json());
  } catch {
    return Response.json(
      apiError("VALIDATION_ERROR", "Invalid payload", {
        newPassword: "required, min length 10",
      }),
      { status: 422 },
    );
  }

  const user = await prisma.user.findUniqueOrThrow({ where: { id: session.id } });
  const currentOk = await verifyPassword(user.passwordHash, parsed.currentPassword);
  if (!currentOk) throw new HttpApiError(400, "WRONG_PASSWORD", "Current password is incorrect");

  const newPasswordHash = await hashPassword(parsed.newPassword);
  const updated = await prisma.$transaction(async (tx) =>
    tx.user.update({
      where: { id: user.id },
      data: { passwordHash: newPasswordHash, tokenVersion: { increment: 1 } },
      select: { id: true, tokenVersion: true },
    }),
  );

  // Re-issue a fresh cookie so the caller stays logged in; all older tokens are dead.
  const token = await signSessionToken({ uid: updated.id, role: session.role, tv: updated.tokenVersion });
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "content-type": "application/json", "set-cookie": serializeSetCookie(token) },
  });
});
