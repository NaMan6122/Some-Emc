import { prisma } from "@/server/db";
import { audit } from "@/server/audit/service";
import { HttpApiError } from "@/lib/http-error";
import type { CreateRetentionReleaseInput } from "@/server/validation/retention";

// spec-019-v1 (FR-6 P1 / OQ-7): retention ledger. Financial records are
// immutable-on-edit — POST + DELETE(ADMIN) only, both audited; no PATCH.

export async function listRetentionReleases(projectId: number) {
  const project = await prisma.project.findUnique({ where: { id: projectId }, select: { id: true } });
  if (!project) throw new HttpApiError(404, "NOT_FOUND", "Project not found");
  return prisma.retentionRelease.findMany({
    where: { projectId },
    orderBy: [{ releasedAt: "desc" }, { id: "desc" }],
  });
}

export async function createRetentionRelease(actorId: number, projectId: number, input: CreateRetentionReleaseInput) {
  const project = await prisma.project.findUnique({ where: { id: projectId }, select: { id: true } });
  if (!project) throw new HttpApiError(404, "NOT_FOUND", "Project not found");

  if (input.pcId != null) {
    const pc = await prisma.paymentCertificate.findFirst({
      where: { id: BigInt(input.pcId), projectId },
      select: { id: true },
    });
    if (!pc) throw new HttpApiError(422, "VALIDATION_ERROR", "Unknown certificate for this project", {
      pcId: ["No such payment certificate on this project"],
    });
  }

  return prisma.$transaction(async (tx) => {
    const created = await tx.retentionRelease.create({
      data: {
        projectId,
        pcId: input.pcId != null ? BigInt(input.pcId) : null,
        amountFils: input.amountFils,
        releasedAt: new Date(input.releasedAt),
        reference: input.reference ?? null,
        note: input.note ?? null,
      },
    });
    await audit(tx, {
      actorId,
      entity: "RetentionRelease",
      entityId: created.id,
      action: "CREATE",
      after: {
        projectId,
        pcId: input.pcId ?? null,
        amountFils: input.amountFils.toString(),
        releasedAt: created.releasedAt.toISOString(),
        reference: created.reference,
      },
    });
    return created;
  });
}

export async function deleteRetentionRelease(actorId: number, rawId: string) {
  if (!/^\d+$/.test(rawId)) throw new HttpApiError(404, "NOT_FOUND", "Retention release not found");
  const id = BigInt(rawId);
  return prisma.$transaction(async (tx) => {
    const row = await tx.retentionRelease.findUnique({ where: { id } });
    if (!row) throw new HttpApiError(404, "NOT_FOUND", "Retention release not found");
    await tx.retentionRelease.delete({ where: { id } });
    await audit(tx, {
      actorId,
      entity: "RetentionRelease",
      entityId: id,
      action: "DELETE",
      before: {
        projectId: row.projectId,
        pcId: row.pcId?.toString() ?? null,
        amountFils: row.amountFils.toString(),
        releasedAt: row.releasedAt.toISOString(),
        reference: row.reference,
      },
    });
    return row;
  });
}
