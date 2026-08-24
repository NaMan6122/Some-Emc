import type { Role } from "@prisma/client";
import { prisma } from "@/server/db";
import { audit } from "@/server/audit/service";
import { HttpApiError } from "@/lib/http-error";
import type { SessionUser } from "@/server/auth/guards";
import type { PatchFlagInput } from "@/server/validation/flag";

// spec-016-v1: FR-9 triage workflow. TDD §7 "Flags resolve" row implemented as
// an explicit entityType → role domain map; ADMIN bypasses. Project-level
// flags are resolvable by any of the three domain roles.
const DOMAIN_ROLES: Record<string, Role[]> = {
  Lpo: ["PROCUREMENT"],
  Supplier: ["PROCUREMENT"],
  BudgetLine: ["COMMERCIAL"],
  VariationOrder: ["COMMERCIAL"],
  PaymentCertificate: ["FINANCE"],
  Project: ["PROCUREMENT", "COMMERCIAL", "FINANCE"],
};

function assertTriageRole(actor: SessionUser, entityType: string) {
  if (actor.role === "ADMIN") return;
  const allowed = DOMAIN_ROLES[entityType] ?? [];
  if (!allowed.includes(actor.role)) {
    throw new HttpApiError(
      403,
      "FLAG_DOMAIN_FORBIDDEN",
      `Role ${actor.role} cannot triage ${entityType} flags`,
    );
  }
}

export async function patchFlag(actor: SessionUser, rawId: string, patch: PatchFlagInput) {
  if (!/^\d+$/.test(rawId)) throw new HttpApiError(404, "NOT_FOUND", "Data flag not found");
  const id = BigInt(rawId);

  return prisma.$transaction(async (tx) => {
    const row = await tx.dataFlag.findUnique({ where: { id } });
    if (!row) throw new HttpApiError(404, "NOT_FOUND", "Data flag not found");
    if (row.status !== "OPEN") {
      throw new HttpApiError(422, "INVALID_TRANSITION", `A ${row.status} flag can no longer be triaged`);
    }

    const assigneeChanged = patch.assigneeId !== undefined;
    const statusChange = patch.status;

    if (!statusChange && !assigneeChanged) {
      throw new HttpApiError(422, "VALIDATION_ERROR", "Empty patch");
    }
    if (statusChange) {
      assertTriageRole(actor, row.entityType);
      const note = patch.resolutionNote?.trim();
      if (!note) {
        throw new HttpApiError(422, "VALIDATION_ERROR", `${statusChange} requires a resolution note`, {
          resolutionNote: ["A resolution note is required"],
        });
      }
    }
    if (assigneeChanged && !statusChange) {
      // Assignment follows the same domain gate so read-only roles cannot
      // route work either; ADMIN bypasses inside assertTriageRole.
      assertTriageRole(actor, row.entityType);
      if (patch.assigneeId !== null) {
        const assignee = await tx.user.findUnique({ where: { id: patch.assigneeId! }, select: { id: true } });
        if (!assignee) {
          throw new HttpApiError(422, "VALIDATION_ERROR", "Unknown assignee", {
            assigneeId: ["No such user"],
          });
        }
      }
    }

    const before = {
      status: row.status,
      assigneeId: row.assigneeId,
      resolutionNote: row.resolutionNote,
    };
    const updated = await tx.dataFlag.update({
      where: { id },
      data: {
        ...(statusChange ? { status: statusChange, resolvedAt: new Date() } : {}),
        ...(assigneeChanged ? { assigneeId: patch.assigneeId ?? null } : {}),
        ...(patch.resolutionNote != null && patch.resolutionNote.trim() !== ""
          ? { resolutionNote: patch.resolutionNote.trim() }
          : {}),
      },
    });
    await audit(tx, {
      actorId: actor.id,
      entity: "DataFlag",
      entityId: id,
      action: "UPDATE",
      before,
      after: {
        status: updated.status,
        assigneeId: updated.assigneeId,
        resolutionNote: updated.resolutionNote,
      },
    });
    return updated;
  });
}
