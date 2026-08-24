import { Prisma } from "@prisma/client";
import { prisma } from "@/server/db";
import { audit } from "@/server/audit/service";
import { HttpApiError } from "@/lib/http-error";
import type { CreateAllocationInput } from "@/server/validation/lpo-allocation";

// spec-022-v1 (FR-4 P1): percentage allocation of an LPO's cost to another
// project. ADMIN+COMMERCIAL write per TDD §7 Budgets-row convention;
// immutable-on-edit like other financial records — corrections are DELETE +
// re-create, both audited. Σpct per LPO must stay ≤ 100.

function assertId(rawId: string, label: string): bigint {
  if (!/^\d+$/.test(rawId)) throw new HttpApiError(404, "NOT_FOUND", `${label} not found`);
  return BigInt(rawId);
}

export async function listAllocations(rawLpoId: string) {
  const lpoId = assertId(rawLpoId, "LPO");
  const lpo = await prisma.lpo.findUnique({ where: { id: lpoId }, select: { id: true, projectId: true } });
  if (!lpo) throw new HttpApiError(404, "NOT_FOUND", "LPO not found");
  const items = await prisma.lpoAllocation.findMany({
    where: { lpoId },
    orderBy: { id: "asc" },
    include: { targetProject: { select: { id: true, code: true, name: true } } },
  });
  const totalPct = items.reduce((s, a) => s + a.pct, 0);
  return { items, totalPct };
}

export async function createAllocation(actorId: number, rawLpoId: string, input: CreateAllocationInput) {
  const lpoId = assertId(rawLpoId, "LPO");
  return prisma.$transaction(async (tx) => {
    const lpo = await tx.lpo.findUnique({ where: { id: lpoId }, select: { id: true, projectId: true } });
    if (!lpo) throw new HttpApiError(404, "NOT_FOUND", "LPO not found");
    if (input.targetProjectId === lpo.projectId) {
      throw new HttpApiError(422, "VALIDATION_ERROR", "Target project must differ from the LPO's own project");
    }
    const target = await tx.project.findUnique({ where: { id: input.targetProjectId }, select: { id: true } });
    if (!target) throw new HttpApiError(404, "NOT_FOUND", "Target project not found");

    const existing = await tx.lpoAllocation.findMany({ where: { lpoId }, select: { pct: true, targetProjectId: true } });
    const dup = existing.some((a) => a.targetProjectId === input.targetProjectId);
    if (dup) throw new HttpApiError(409, "ALLOCATION_EXISTS", "This LPO already allocates to that project");
    const total = existing.reduce((s, a) => s + a.pct, 0);
    if (total + input.pct > 100) {
      throw new HttpApiError(422, "ALLOCATION_EXCEEDS_100", `Allocations would total ${total + input.pct}% (max 100; ${100 - total}% available)`);
    }

    const created = await tx.lpoAllocation.create({
      data: {
        lpoId,
        targetProjectId: input.targetProjectId,
        pct: input.pct,
        note: input.note ?? null,
      },
    }).catch((e: unknown) => {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        throw new HttpApiError(409, "ALLOCATION_EXISTS", "This LPO already allocates to that project");
      }
      throw e;
    });

    await audit(tx, {
      actorId,
      entity: "LpoAllocation",
      entityId: created.id,
      action: "CREATE",
      after: {
        lpoId: lpoId.toString(),
        targetProjectId: input.targetProjectId,
        pct: input.pct,
        note: created.note,
      },
    });
    return created;
  });
}

export async function deleteAllocation(actorId: number, rawId: string) {
  const id = assertId(rawId, "Allocation");
  return prisma.$transaction(async (tx) => {
    const row = await tx.lpoAllocation.findUnique({ where: { id } });
    if (!row) throw new HttpApiError(404, "NOT_FOUND", "Allocation not found");
    await tx.lpoAllocation.delete({ where: { id } });
    await audit(tx, {
      actorId,
      entity: "LpoAllocation",
      entityId: id,
      action: "DELETE",
      before: {
        lpoId: row.lpoId.toString(),
        targetProjectId: row.targetProjectId,
        pct: row.pct,
        note: row.note,
      },
    });
    return row;
  });
}
