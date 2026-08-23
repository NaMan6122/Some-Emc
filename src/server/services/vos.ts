import { Prisma, type VoStatus } from "@prisma/client";
import { prisma } from "@/server/db";
import { audit } from "@/server/audit/service";
import { HttpApiError } from "@/lib/http-error";
import type { CreateVoInput, PatchVoInput } from "@/server/validation/vo";

// spec-013: variation orders + claim-compliance service.
// Status chain per spec: DRAFT → SUBMITTED → APPROVED | REJECTED (terminal).
// Approval demands approvedValueFils + approvedAt; approvalRef is recorded in
// the audit row.

const NEXT: Record<VoStatus, VoStatus[]> = {
  DRAFT: ["SUBMITTED"],
  SUBMITTED: ["APPROVED", "REJECTED"],
  APPROVED: [],
  REJECTED: [],
};

function assertTransition(from: VoStatus, to: VoStatus) {
  if (from === to) return;
  if (!NEXT[from].includes(to)) {
    throw new HttpApiError(422, "INVALID_TRANSITION", `A variation order cannot move from ${from} to ${to}`);
  }
}

function assertApprovalComplete(status: VoStatus, approvedValueFils: bigint | null, approvedAt: Date | null, origin: VoStatus) {
  if (status !== "APPROVED") return;
  if (origin !== "APPROVED" && (approvedValueFils === null || approvedAt === null)) {
    throw new HttpApiError(422, "MISSING_APPROVAL", "Approving a VO requires approvedValueFils and approvedAt");
  }
}

export async function listVos(projectId: number) {
  const project = await prisma.project.findUnique({ where: { id: projectId }, select: { id: true } });
  if (!project) throw new HttpApiError(404, "NOT_FOUND", "Project not found");
  const vos = await prisma.variationOrder.findMany({
    where: { projectId },
    orderBy: { voNumber: "asc" },
    include: { _count: { select: { lpos: true } } },
  });
  return vos;
}

export async function createVo(actorId: number, projectId: number, input: CreateVoInput) {
  const project = await prisma.project.findUnique({ where: { id: projectId }, select: { id: true } });
  if (!project) throw new HttpApiError(404, "NOT_FOUND", "Project not found");

  assertTransition("DRAFT", input.status);
  assertApprovalComplete(input.status, null, input.approvedAt ? new Date(input.approvedAt) : null, "DRAFT");

  return prisma.$transaction(async (tx) => {
    const created = await tx.variationOrder.create({
      data: {
        projectId,
        voNumber: input.voNumber,
        title: input.title,
        submittedValueFils: input.submittedValueFils,
        status: input.status,
        approvedAt: input.approvedAt ? new Date(input.approvedAt) : null,
        approvalRef: input.approvalRef ?? null,
      },
    }).catch((e: unknown) => {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        throw new HttpApiError(409, "VO_NUMBER_TAKEN", `VO ${input.voNumber} already exists for this project`);
      }
      throw e;
    });

    await audit(tx, {
      actorId,
      entity: "VariationOrder",
      entityId: created.id,
      action: "CREATE",
      after: {
        voNumber: created.voNumber,
        title: created.title,
        submittedValueFils: created.submittedValueFils.toString(),
        status: created.status,
      },
    });
    await reconcileUnapprovedVoClaimTx(tx, projectId);
    return created;
  });
}

export async function updateVo(actorId: number, rawId: string, patch: PatchVoInput) {
  if (!/^\d+$/.test(rawId)) throw new HttpApiError(404, "NOT_FOUND", "Variation order not found");
  const id = BigInt(rawId);

  return prisma.$transaction(async (tx) => {
    const row = await tx.variationOrder.findUnique({ where: { id } });
    if (!row) throw new HttpApiError(404, "NOT_FOUND", "Variation order not found");

    const nextStatus = patch.status ?? row.status;
    assertTransition(row.status, nextStatus);

    const nextApprovedValue = patch.approvedValueFils !== undefined ? (patch.approvedValueFils ?? null) : row.approvedValueFils;
    const nextApprovedAt =
      patch.approvedAt !== undefined ? (patch.approvedAt ? new Date(patch.approvedAt) : null) : row.approvedAt;
    assertApprovalComplete(nextStatus, nextApprovedValue, nextApprovedAt, row.status);

    const updated = await tx.variationOrder.update({
      where: { id },
      data: {
        ...(patch.title !== undefined ? { title: patch.title } : {}),
        ...(patch.submittedValueFils !== undefined ? { submittedValueFils: patch.submittedValueFils } : {}),
        ...(patch.approvedValueFils !== undefined ? { approvedValueFils: nextApprovedValue } : {}),
        ...(patch.approvedAt !== undefined ? { approvedAt: nextApprovedAt } : {}),
        ...(patch.approvalRef !== undefined ? { approvalRef: patch.approvalRef ?? null } : {}),
        ...(nextStatus !== row.status ? { status: nextStatus } : {}),
      },
    });

    await audit(tx, {
      actorId,
      entity: "VariationOrder",
      entityId: id,
      action: "UPDATE",
      before: {
        title: row.title,
        submittedValueFils: row.submittedValueFils.toString(),
        status: row.status,
        approvedValueFils: row.approvedValueFils?.toString() ?? null,
        approvalRef: row.approvalRef,
      },
      after: {
        title: updated.title,
        submittedValueFils: updated.submittedValueFils.toString(),
        status: updated.status,
        approvedValueFils: updated.approvedValueFils?.toString() ?? null,
        approvalRef: updated.approvalRef,
      },
    });
    await reconcileUnapprovedVoClaimTx(tx, row.projectId);
    return updated;
  });
}

// ---------------------------------------------------------------------------
// Compliance (spec-013): unapprovedVoExposure KPI.
//
// Documented limitation (spec Risks): PC variationClaimFils is an aggregate —
// the legacy data carries no per-VO claim split. Attribution is therefore
// project-level: while ANY non-APPROVED VO exists on the project, the full
// claimed variation amount counts as exposed; with no VOs or all-approved
// VOs, exposure is zero.
// ---------------------------------------------------------------------------

export async function computeCompliance(projectId: number) {
  const [claims, voGroups] = await Promise.all([
    prisma.paymentCertificate.aggregate({
      where: { projectId },
      _sum: { variationClaimFils: true },
    }),
    prisma.variationOrder.groupBy({
      by: ["status"],
      where: { projectId },
      _count: { _all: true },
    }),
  ]);
  const totalClaims = claims._sum.variationClaimFils ?? 0n;
  const byStatus = Object.fromEntries(voGroups.map((g) => [g.status, g._count._all])) as Record<VoStatus, number>;
  const totalVos = voGroups.reduce((s, g) => s + g._count._all, 0);
  const nonApproved = totalVos - (byStatus.APPROVED ?? 0);
  const unapprovedVoExposure = nonApproved > 0 ? totalClaims : 0n;
  return {
    unapprovedVoExposure,
    totalClaims,
    voCounts: byStatus,
    openVos: nonApproved,
  };
}

/** Read-path reconciliation so flags stay fresh even when only PCs change. */
export async function reconcileUnapprovedVoClaim(projectId: number) {
  await prisma.$transaction(async (tx) => reconcileUnapprovedVoClaimTx(tx, projectId));
}

async function reconcileUnapprovedVoClaimTx(tx: Prisma.TransactionClient, projectId: number) {
  const compliance = await computeCompliance(projectId);
  const pid = String(projectId);
  await tx.dataFlag.updateMany({
    where: { entityType: "Project", entityId: pid, ruleCode: "UNAPPROVED_VO_CLAIM", status: "OPEN" },
    data: { status: "RESOLVED", resolvedAt: new Date() },
  });
  if (compliance.unapprovedVoExposure > 0n) {
    await tx.dataFlag.create({
      data: {
        entityType: "Project",
        entityId: pid,
        ruleCode: "UNAPPROVED_VO_CLAIM",
        severity: "HIGH",
        status: "OPEN",
        message: `AED ${(Number(compliance.unapprovedVoExposure) / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })} of variation claimed against ${compliance.openVos} non-approved VO(s)`,
      },
    });
  }
}
