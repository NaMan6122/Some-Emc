import { randomBytes } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/server/db";
import { audit } from "@/server/audit/service";
import { HttpApiError } from "@/lib/http-error";
import { hashPassword } from "@/server/auth/password-hash";
import type { CreateUserInput, PatchUserInput } from "@/server/validation/user-admin";

// spec-024-v1: user lifecycle administration (ADMIN only, enforced at route).
// No hard deletes — `active` preserves audit attribution. Every rights or
// credential change bumps tokenVersion for instant session revocation.
// One-time passwords are returned to the caller exactly once and are never
// stored in clear nor written to the audit log.

export function generateOneTimePassword(): string {
  return randomBytes(12).toString("base64url"); // ~72 bits, URL-safe for copy/paste
}

export async function listUsersForAdmin() {
  return prisma.user.findMany({
    select: { id: true, name: true, email: true, role: true, active: true, createdAt: true },
    orderBy: [{ active: "desc" }, { name: "asc" }],
  });
}

/** Count of OTHER active admins — used by the LAST_ADMIN guardrail. */
async function otherActiveAdmins(tx: Prisma.TransactionClient, userId: number): Promise<number> {
  return tx.user.count({ where: { role: "ADMIN", active: true, id: { not: userId } } });
}

export async function createUser(actorId: number, input: CreateUserInput) {
  const email = input.email.trim().toLowerCase();
  const oneTimePassword = input.password ?? generateOneTimePassword();
  if (oneTimePassword.length < 10) throw new HttpApiError(422, "VALIDATION_ERROR", "Password must be at least 10 characters");
  const passwordHash = await hashPassword(oneTimePassword);

  const user = await prisma.user
    .create({
      data: { email, name: input.name, role: input.role, passwordHash },
      select: { id: true, email: true, name: true, role: true, active: true, createdAt: true },
    })
    .catch((e: unknown) => {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        throw new HttpApiError(409, "EMAIL_TAKEN", "A user with this email already exists");
      }
      throw e;
    });

  await audit(prisma, {
    actorId,
    entity: "User",
    entityId: user.id,
    action: "CREATE",
    after: { email: user.email, name: user.name, role: user.role }, // never password material
  });

  return { user, oneTimePassword };
}

export async function patchUser(
  actorId: number,
  rawId: string,
  patch: PatchUserInput,
): Promise<{ user: Record<string, unknown>; oneTimePassword?: string }> {
  const id = /^\d+$/.test(rawId) ? Number(rawId) : null;
  if (!id) throw new HttpApiError(404, "NOT_FOUND", "User not found");

  return prisma.$transaction(async (tx) => {
    const target = await tx.user.findUnique({ where: { id }, select: { id: true, email: true, role: true, active: true, tokenVersion: true } });
    if (!target) throw new HttpApiError(404, "NOT_FOUND", "User not found");

    // Guardrail 1: admins manage others via this endpoint; self-service stays
    // on /auth/password.
    if (target.id === actorId && (patch.active !== undefined || resetPassword(patch) || (patch.role !== undefined && patch.role !== target.role))) {
      throw new HttpApiError(422, "CANNOT_MODIFY_SELF", "Use the account menu to change your own role, status or password");
    }
    // Guardrail 2: never strand the workspace without an ACTIVE admin.
    if (
      target.role === "ADMIN" &&
      target.active &&
      ((patch.role !== undefined && patch.role !== "ADMIN") || patch.active === false)
    ) {
      const others = await otherActiveAdmins(tx, target.id);
      if (others === 0) throw new HttpApiError(422, "LAST_ADMIN", "Cannot remove the last active administrator");
    }

    const revoking = resetPassword(patch) || patch.active === false || (patch.role !== undefined && patch.role !== target.role);
    let oneTimePassword: string | undefined;
    const data: Record<string, unknown> = {};
    if (patch.role !== undefined) data.role = patch.role;
    if (patch.active !== undefined) data.active = patch.active;
    if (resetPassword(patch)) {
      oneTimePassword = generateOneTimePassword();
      data.passwordHash = await hashPassword(oneTimePassword);
    }
    if (revoking) data.tokenVersion = target.tokenVersion + 1;

    const updated = await tx.user.update({
      where: { id },
      data,
      select: { id: true, email: true, name: true, role: true, active: true, createdAt: true },
    });

    await audit(tx, {
      actorId,
      entity: "User",
      entityId: id,
      action: "UPDATE",
      before: { role: target.role, active: target.active },
      after: {
        role: updated.role,
        active: updated.active,
        ...(resetPassword(patch) ? { passwordReset: true } : {}),
        ...(revoking ? { sessionsRevoked: true } : {}),
      },
    });

    return { user: updated, ...(oneTimePassword ? { oneTimePassword } : {}) };
  });
}

function resetPassword(patch: PatchUserInput): boolean {
  return patch.resetPassword === true;
}
