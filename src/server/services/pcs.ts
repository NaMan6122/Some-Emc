import { Prisma, type PcStatus } from "@prisma/client";
import { prisma } from "@/server/db";
import { audit } from "@/server/audit/service";
import { HttpApiError } from "@/lib/http-error";
import type { CreatePcInput, PatchPcInput } from "@/server/validation/pc";

// spec-012: payment certificates. Integrity rules enforced server-side:
// net = gross − retention (422 otherwise), gapless numbering from CERTIFIED+
// is *advisory* via PC_GAP DataFlags, statedCumulativeFils cross-checked at
// zero tolerance via CUMULATIVE_MISMATCH DataFlags.

const STATUS_ORDER: Record<PcStatus, number> = { DRAFT: 0, SUBMITTED: 1, CERTIFIED: 2, PAID: 3 };

function assertArithmetic(gross: bigint, retention: bigint, net: bigint) {
  if (net !== gross - retention) {
    throw new HttpApiError(422, "ARITHMETIC_MISMATCH", "netPayableFils must equal grossFils − retentionFils", {
      netPayableFils: [`expected ${gross - retention} fils, got ${net}`],
    });
  }
}

/** Missing certificate numbers in 1..upToExclusive. */
function missingNumbers(existing: Set<number>, upToExclusive: number): number[] {
  const out: number[] = [];
  for (let n = 1; n < upToExclusive; n++) {
    if (!existing.has(n)) out.push(n);
  }
  return out;
}

async function reconcileFlags(
  tx: Prisma.TransactionClient,
  pcId: bigint,
  projectId: number,
  pcNumber: number,
  status: PcStatus,
  statedCumulativeFils: bigint | null,
) {
  // PC_GAP: numbers missing below this one (advisory — creation still allowed).
  const rows = await tx.paymentCertificate.findMany({
    where: { projectId },
    select: { pcNumber: true },
  });
  const gaps = missingNumbers(new Set(rows.map((r) => r.pcNumber)), pcNumber);
  await resolveStale(tx, pcId, "PC_GAP");
  if (gaps.length > 0) {
    await tx.dataFlag.create({
      data: {
        entityType: "PaymentCertificate",
        entityId: String(pcId),
        ruleCode: "PC_GAP",
        severity: "MEDIUM",
        status: "OPEN",
        message: `Missing certificate number(s): ${gaps.join(", ")}`,
      },
    });
  }

    // CUMULATIVE_MISMATCH: recompute certified cumulative up to and including
    // this certificate (the aggregate naturally counts this row when it is
    // itself CERTIFIED/PAID); zero tolerance vs the client's stated figure.
    await resolveStale(tx, pcId, "CUMULATIVE_MISMATCH");
    if (statedCumulativeFils !== null) {
      const agg = await tx.paymentCertificate.aggregate({
        where: { projectId, pcNumber: { lte: pcNumber }, status: { in: ["CERTIFIED", "PAID"] } },
        _sum: { netPayableFils: true },
      });
      const computed = agg._sum.netPayableFils ?? 0n;
    if (computed !== statedCumulativeFils) {
      await tx.dataFlag.create({
        data: {
          entityType: "PaymentCertificate",
          entityId: String(pcId),
          ruleCode: "CUMULATIVE_MISMATCH",
          severity: "HIGH",
          status: "OPEN",
          message: `stated cumulative ${(Number(statedCumulativeFils) / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })} AED ≠ recomputed certified ${(Number(computed) / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })} AED`,
        },
      });
    }
  }
}

async function resolveStale(tx: Prisma.TransactionClient, entityId: bigint, ruleCode: string) {
  await tx.dataFlag.updateMany({
    where: { entityType: "PaymentCertificate", entityId: String(entityId), ruleCode, status: "OPEN" },
    data: { status: "RESOLVED", resolvedAt: new Date() },
  });
}

export async function listPcs(projectId: number) {
  const project = await prisma.project.findUnique({ where: { id: projectId }, select: { id: true } });
  if (!project) throw new HttpApiError(404, "NOT_FOUND", "Project not found");
  return prisma.paymentCertificate.findMany({
    where: { projectId },
    orderBy: { pcNumber: "asc" },
  });
}

export async function createPc(actorId: number, projectId: number, input: CreatePcInput) {
  const project = await prisma.project.findUnique({ where: { id: projectId }, select: { id: true } });
  if (!project) throw new HttpApiError(404, "NOT_FOUND", "Project not found");

  assertArithmetic(input.grossFils, input.retentionFils, input.netPayableFils);

  return prisma.$transaction(async (tx) => {
    const created = await tx.paymentCertificate.create({
      data: {
        projectId,
        pcNumber: input.pcNumber,
        periodLabel: input.periodLabel,
        periodStart: input.periodStart ? new Date(input.periodStart) : null,
        periodEnd: input.periodEnd ? new Date(input.periodEnd) : null,
        invoiceDate: input.invoiceDate ? new Date(input.invoiceDate) : null,
        applicationDate: input.applicationDate ? new Date(input.applicationDate) : null,
        dueDate: input.dueDate ? new Date(input.dueDate) : null,
        paymentReceivedDate: input.paymentReceivedDate ? new Date(input.paymentReceivedDate) : null,
        grossFils: input.grossFils,
        retentionFils: input.retentionFils,
        netPayableFils: input.netPayableFils,
        variationClaimFils: input.variationClaimFils,
        statedCumulativeFils: input.statedCumulativeFils ?? null,
        status: input.status,
        provenance: input.provenance,
        notes: input.notes ?? null,
      },
    }).catch((e: unknown) => {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        throw new HttpApiError(409, "PC_NUMBER_TAKEN", `PC ${input.pcNumber} already exists for this project`);
      }
      throw e;
    });

    await reconcileFlags(tx, created.id, projectId, created.pcNumber, created.status, created.statedCumulativeFils);
    await audit(tx, {
      actorId,
      entity: "PaymentCertificate",
      entityId: created.id,
      action: "CREATE",
      after: {
        pcNumber: created.pcNumber,
        periodLabel: created.periodLabel,
        grossFils: created.grossFils.toString(),
        retentionFils: created.retentionFils.toString(),
        netPayableFils: created.netPayableFils.toString(),
        status: created.status,
        provenance: created.provenance,
      },
    });
    return created;
  });
}

export async function updatePc(actorId: number, rawId: string, patch: PatchPcInput) {
  if (!/^\d+$/.test(rawId)) throw new HttpApiError(404, "NOT_FOUND", "Payment certificate not found");
  const id = BigInt(rawId);

  return prisma.$transaction(async (tx) => {
    const row = await tx.paymentCertificate.findUnique({ where: { id } });
    if (!row) throw new HttpApiError(404, "NOT_FOUND", "Payment certificate not found");

    // Status workflow: forward-only; PAID only from CERTIFIED (spec AC5).
    let nextStatus = row.status;
    if (patch.status !== undefined && patch.status !== row.status) {
      const next = STATUS_ORDER[patch.status];
      const cur = STATUS_ORDER[row.status];
      if (next < cur) {
        throw new HttpApiError(422, "INVALID_TRANSITION", `Cannot move a certificate from ${row.status} back to ${patch.status}`);
      }
      if (patch.status === "PAID" && row.status !== "CERTIFIED") {
        throw new HttpApiError(422, "INVALID_TRANSITION", "PAID is only reachable from CERTIFIED");
      }
      nextStatus = patch.status;
    }

    const gross = patch.grossFils ?? row.grossFils;
    const retention = patch.retentionFils ?? row.retentionFils;
    const net = patch.netPayableFils ?? row.netPayableFils;
    assertArithmetic(gross, retention, net);

    const updated = await tx.paymentCertificate.update({
      where: { id },
      data: {
        ...(patch.periodLabel !== undefined ? { periodLabel: patch.periodLabel } : {}),
        ...(patch.periodStart !== undefined ? { periodStart: patch.periodStart ? new Date(patch.periodStart) : null } : {}),
        ...(patch.periodEnd !== undefined ? { periodEnd: patch.periodEnd ? new Date(patch.periodEnd) : null } : {}),
        ...(patch.invoiceDate !== undefined ? { invoiceDate: patch.invoiceDate ? new Date(patch.invoiceDate) : null } : {}),
        ...(patch.applicationDate !== undefined ? { applicationDate: patch.applicationDate ? new Date(patch.applicationDate) : null } : {}),
        ...(patch.dueDate !== undefined ? { dueDate: patch.dueDate ? new Date(patch.dueDate) : null } : {}),
        ...(patch.paymentReceivedDate !== undefined ? { paymentReceivedDate: patch.paymentReceivedDate ? new Date(patch.paymentReceivedDate) : null } : {}),
        ...(patch.grossFils !== undefined ? { grossFils: patch.grossFils } : {}),
        ...(patch.retentionFils !== undefined ? { retentionFils: patch.retentionFils } : {}),
        ...(patch.netPayableFils !== undefined ? { netPayableFils: patch.netPayableFils } : {}),
        ...(patch.variationClaimFils !== undefined ? { variationClaimFils: patch.variationClaimFils } : {}),
        ...(patch.statedCumulativeFils !== undefined ? { statedCumulativeFils: patch.statedCumulativeFils ?? null } : {}),
        ...(nextStatus !== row.status ? { status: nextStatus } : {}),
        ...(patch.provenance !== undefined ? { provenance: patch.provenance } : {}),
        ...(patch.notes !== undefined ? { notes: patch.notes ?? null } : {}),
      },
    });

    const statedNow = patch.statedCumulativeFils !== undefined ? (patch.statedCumulativeFils ?? null) : row.statedCumulativeFils;
    await reconcileFlags(tx, id, row.projectId, row.pcNumber, updated.status, statedNow);
    await audit(tx, {
      actorId,
      entity: "PaymentCertificate",
      entityId: id,
      action: "UPDATE",
      before: {
        grossFils: row.grossFils.toString(),
        retentionFils: row.retentionFils.toString(),
        netPayableFils: row.netPayableFils.toString(),
        status: row.status,
        statedCumulativeFils: row.statedCumulativeFils?.toString() ?? null,
      },
      after: {
        grossFils: updated.grossFils.toString(),
        retentionFils: updated.retentionFils.toString(),
        netPayableFils: updated.netPayableFils.toString(),
        status: updated.status,
        statedCumulativeFils: updated.statedCumulativeFils?.toString() ?? null,
      },
    });
    return updated;
  });
}

export async function deletePc(actorId: number, rawId: string) {
  if (!/^\d+$/.test(rawId)) throw new HttpApiError(404, "NOT_FOUND", "Payment certificate not found");
  const id = BigInt(rawId);
  return prisma.$transaction(async (tx) => {
    const row = await tx.paymentCertificate.findUnique({ where: { id } });
    if (!row) throw new HttpApiError(404, "NOT_FOUND", "Payment certificate not found");
    await tx.paymentCertificate.delete({ where: { id } });
    await audit(tx, {
      actorId,
      entity: "PaymentCertificate",
      entityId: id,
      action: "DELETE",
      before: {
        pcNumber: row.pcNumber,
        periodLabel: row.periodLabel,
        netPayableFils: row.netPayableFils.toString(),
        status: row.status,
      },
    });
    return row;
  });
}
