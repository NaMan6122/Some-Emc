import { Prisma } from "@prisma/client";
import { prisma } from "@/server/db";
import { audit } from "@/server/audit/service";
import { HttpApiError } from "@/lib/http-error";
import type { CreateLpoInput, ListLpoQuery, PatchLpoInput } from "@/server/validation/lpo";

// spec-007-v1 LPO register service — the core module.
//
// Revision rule: financially relevant edits (amountFils, supplierId, trade,
// issueDate, vatRate, voId) on an ISSUED lpo create a successor revision;
// the predecessor is immutable and points at its successor via supersededById.
// Descriptive edits (description, remark) happen in place with audit.

const FINANCIAL_KEYS = [
  "amountFils",
  "supplierId",
  "trade",
  "issueDate",
  "vatRate",
  "voId",
] as const;

type Tx = Prisma.TransactionClient;
type Role = "ADMIN" | "MANAGEMENT" | "PROCUREMENT" | "COMMERCIAL" | "FINANCE" | "VIEWER";

function pad3(n: number): string {
  return String(n).padStart(3, "0");
}

export function buildRef(prefix: string, seq: number): string {
  return `${prefix}//${pad3(seq)}`;
}

async function validateVoLink(tx: Tx, projectId: number, kind: string, voId?: string | null) {
  if (kind === "VARIATION" && (voId == null || voId === "")) {
    throw new HttpApiError(422, "VO_REQUIRED", "kind=VARIATION requires a voId");
  }
  if (voId == null) return null;
  if (kind !== "VARIATION") {
    throw new HttpApiError(422, "KIND_VO_CONFLICT", "voId can only be set when kind is VARIATION");
  }
  const vo = await tx.variationOrder.findUnique({ where: { id: BigInt(voId) } });
  if (!vo || vo.projectId !== projectId) {
    throw new HttpApiError(422, "VO_INVALID", "voId must reference a variation order of the same project");
  }
  return vo.id;
}

/** AC1: sequence allocation under concurrency relies on @@unique(projectId, seq)
 *  plus bounded retry. */
export async function createLpo(
  actorId: number,
  role: Role,
  projectId: number,
  input: CreateLpoInput,
) {
  void role; // role gate handled at route level
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) throw new HttpApiError(404, "NOT_FOUND", "Project not found");

  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      return await prisma.$transaction(async (tx) => {
        const agg = await tx.lpo.aggregate({ where: { projectId }, _max: { seq: true } });
        const seq = (agg._max.seq ?? 0) + 1;
        const refNo = buildRef(input.refPrefix, seq);
        const voId = await validateVoLink(tx, projectId, input.kind, input.voId);
        const created = await tx.lpo.create({
          data: {
            projectId,
            refNo,
            seq,
            supplierId: input.supplierId,
            trade: input.trade,
            description: input.description,
            issueDate: new Date(input.issueDate),
            amountFils: input.amountFils,
            vatRate: input.vatRate,
            kind: input.kind,
            status: input.status,
            remark: input.remark ?? null,
            provenance: "SOURCE_DOCUMENT",
            voId: voId ?? undefined,
          },
        });
        await audit(tx, { actorId, entity: "Lpo", entityId: created.id, action: "CREATE", after: snapshot(created) });
        return created;
      });
    } catch (e) {
      const conflict =
        e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
      if (!conflict || attempt === 4) throw e;
    }
  }
  throw new HttpApiError(409, "SEQ_CONFLICT", "Could not allocate an LPO number, please retry");
}

function snapshot(lpo: {
  refNo: string;
  supplierId: number;
  trade: string;
  description: string;
  issueDate: Date;
  amountFils: bigint;
  vatRate: Prisma.Decimal;
  status: string;
}) {
  return {
    refNo: lpo.refNo,
    supplierId: lpo.supplierId,
    trade: lpo.trade,
    description: lpo.description,
    issueDate: lpo.issueDate.toISOString(),
    amountFils: lpo.amountFils.toString(),
    status: lpo.status,
  };
}

export async function getLpoChain(rawId: string) {
  if (!/^\d+$/.test(rawId)) throw new HttpApiError(404, "NOT_FOUND", "LPO not found");
  const id = BigInt(rawId);
  const current = await prisma.lpo.findUnique({
    where: { id },
    include: { supplier: { select: { id: true, name: true } } },
  });
  if (!current) throw new HttpApiError(404, "NOT_FOUND", "LPO not found");
  const rootId = current.revisionOfId ?? current.id;
  const chain = await prisma.lpo.findMany({
    where: { OR: [{ revisionOfId: rootId }, { id: rootId }] },
    orderBy: { revisionNo: "asc" },
    select: {
      id: true,
      refNo: true,
      revisionNo: true,
      amountFils: true,
      issueDate: true,
      status: true,
      supersededById: true,
      description: true,
    },
  });
  // spec-010 AC6: the drawer shows why a line is flagged.
  const openFlag = await prisma.dataFlag.findFirst({
    where: { entityType: "Lpo", entityId: String(id), ruleCode: "VERIFICATION_FLAGGED", status: "OPEN" },
    orderBy: { createdAt: "desc" },
    select: { message: true },
  });
  return { ...current, flagNote: openFlag?.message ?? null, chain };
}

export async function patchLpo(actorId: number, role: Role, rawId: string, patch: PatchLpoInput) {
  if (!/^\d+$/.test(rawId)) throw new HttpApiError(404, "NOT_FOUND", "LPO not found");
  const id = BigInt(rawId);

  // Role gate: only ADMIN, PROCUREMENT and (voId-only) COMMERCIAL may mutate.
  if (!["ADMIN", "PROCUREMENT", "COMMERCIAL"].includes(role)) {
    throw new HttpApiError(403, "FORBIDDEN", "Role is not permitted to modify LPOs");
  }

  // COMMERCIAL may only touch voId (spec-007 role matrix).
  if (role === "COMMERCIAL") {
    const allowedKeys = Object.keys(patch).filter((k) => k !== "voId" && k !== "flagNote");
    if (allowedKeys.length > 0) {
      throw new HttpApiError(403, "FORBIDDEN", "COMMERCIAL role may only modify the VO link");
    }
  }

  return prisma.$transaction(async (tx) => {
    const row = await tx.lpo.findUnique({ where: { id } });
    if (!row) throw new HttpApiError(404, "NOT_FOUND", "LPO not found");
    if (row.supersededById !== null) {
      throw new HttpApiError(409, "SUPERSEDED", "This revision is superseded — patch the latest one");
    }

    // Verification handling (AC6).
    let verificationDelta: Promise<unknown> | null = null;
    if (patch.verification && patch.verification !== row.verification) {
      await tx.lpo.update({ where: { id }, data: { verification: patch.verification } });
      if (patch.verification === "FLAGGED") {
        verificationDelta = tx.dataFlag.create({
          data: {
            entityType: "Lpo",
            entityId: String(id),
            ruleCode: "VERIFICATION_FLAGGED",
            severity: "MEDIUM",
            message: patch.flagNote ?? "",
          },
        });
      } else {
        verificationDelta = tx.dataFlag.updateMany({
          where: { entityType: "Lpo", entityId: String(id), ruleCode: "VERIFICATION_FLAGGED", status: "OPEN" },
          data: { status: "RESOLVED", resolvedAt: new Date() },
        });
      }
    }

    const financialChanges = FINANCIAL_KEYS.filter(
      (k) => patch[k] !== undefined && patch[k] !== null,
    ) as string[];
    const lifecycleChange = patch.status !== undefined;

    // Lifecycle transitions.
    if (patch.status !== undefined) {
      const allowed: Record<string, string[]> = {
        DRAFT: ["ISSUED", "CANCELLED"],
        ISSUED: ["CLOSED", "CANCELLED"],
        CLOSED: [],
        CANCELLED: [],
      };
      if (!allowed[row.status].includes(patch.status)) {
        throw new HttpApiError(422, "BAD_TRANSITION", `Cannot move ${row.status} → ${patch.status}`);
      }
    }

    const isRevision = row.status === "ISSUED" && financialChanges.length > 0;

    // A revision and a status transition are separate concerns — refuse mixes.
    if (isRevision && lifecycleChange) {
      throw new HttpApiError(422, "MIXED_PATCH", "Apply the revision and the status change separately");
    }

    if (isRevision) {
      const nextPatch: Record<string, unknown> = {};
      for (const k of financialChanges) nextPatch[k] = patch[k as keyof PatchLpoInput];
      const voIdRaw = nextPatch.voId;
      delete nextPatch.voId;
      const voId = await validateVoLink(tx, row.projectId, row.kind, voIdRaw as string | null | undefined);

      const merged = {
        supplierId: row.supplierId,
        trade: row.trade,
        description: row.description,
        issueDate: row.issueDate,
        amountFils: row.amountFils,
        vatRate: row.vatRate,
        remark: row.remark,
        voId: row.voId,
        ...(voIdRaw !== undefined ? { voId: voId ?? null } : {}),
        ...nextPatch,
      };
      // Carry any descriptive changes along with the revision.
      if (patch.description !== undefined) merged.description = patch.description;
      if (patch.remark !== undefined) merged.remark = patch.remark;
      // Public ref gains an R-suffix like the legacy log (…//061 → …//061R1).
      const baseRef = row.refNo.replace(/R\d+$/, "");
      // Each revision occupies its own per-project seq slot.
      const seqAgg = await tx.lpo.aggregate({ where: { projectId: row.projectId }, _max: { seq: true } });
      const successor = await tx.lpo.create({
        data: {
          projectId: row.projectId,
          refNo: `${baseRef}R${row.revisionNo + 1}`,
          seq: (seqAgg._max.seq ?? 0) + 1,
          revisionOfId: row.revisionOfId ?? row.id,
          revisionNo: row.revisionNo + 1,
          supplierId: merged.supplierId,
          trade: merged.trade,
          description: merged.description,
          issueDate: merged.issueDate,
          amountFils: merged.amountFils,
          vatRate: merged.vatRate,
          remark: merged.remark ?? null,
          voId: merged.voId ?? undefined,
          kind: row.kind,
          status: row.status,
          verification: row.verification,
          provenance: row.provenance,
        },
      });
      await tx.lpo.update({ where: { id }, data: { supersededById: successor.id } });
      await audit(tx, {
        actorId,
        entity: "Lpo",
        entityId: successor.id,
        action: "REVISE",
        before: { ...snapshot(row), revisionNo: row.revisionNo },
        after: { ...snapshot(successor), revisionNo: successor.revisionNo },
      });
      if (verificationDelta) await verificationDelta;
      return successor;
    }

    // In-place path (descriptive fields / status transitions / DRAFT edits).
    const data: Prisma.LpoUpdateInput = {};
    if (patch.description !== undefined) data.description = patch.description;
    if (patch.remark !== undefined) data.remark = patch.remark;
    if (patch.status !== undefined) data.status = patch.status;
    if (row.status === "DRAFT") {
      // DRAFT records are still malleable in every field (ref already locked).
      if (patch.supplierId !== undefined) data.supplier = { connect: { id: patch.supplierId } };
      if (patch.trade !== undefined) data.trade = patch.trade;
      if (patch.issueDate !== undefined) data.issueDate = new Date(patch.issueDate);
      if (patch.amountFils !== undefined) data.amountFils = patch.amountFils;
      if (patch.vatRate !== undefined) data.vatRate = patch.vatRate;
      if (patch.voId !== undefined) {
        const voId = await validateVoLink(tx, row.projectId, row.kind, patch.voId);
        data.vo = voId ? { connect: { id: voId } } : { disconnect: true };
      }
    } else if (patch.voId !== undefined && row.kind === "VARIATION" && role === "COMMERCIAL") {
      const voId = await validateVoLink(tx, row.projectId, row.kind, patch.voId);
      data.vo = voId ? { connect: { id: voId } } : { disconnect: true };
    }

    const updated = await tx.lpo.update({ where: { id }, data });
    await audit(tx, {
      actorId,
      entity: "Lpo",
      entityId: id,
      action: "UPDATE",
      before: snapshot(row),
      after: snapshot(updated),
    });
    if (verificationDelta) await verificationDelta;
    return updated;
  });
}

export async function listLpos(projectId: number, q: ListLpoQuery) {
  const project = await prisma.project.findUnique({ where: { id: projectId }, select: { id: true } });
  if (!project) throw new HttpApiError(404, "NOT_FOUND", "Project not found");

  const where: Prisma.LpoWhereInput = {
    projectId,
    ...(q.includeSuperseded ? {} : { supersededById: null }),
    ...(q.trade ? { trade: q.trade } : {}),
    ...(q.status ? { status: q.status } : {}),
    ...(q.verification ? { verification: q.verification } : {}),
    ...(q.supplierId ? { supplierId: q.supplierId } : {}),
    ...(q.from || q.to
      ? { issueDate: { ...(q.from ? { gte: q.from } : {}), ...(q.to ? { lte: q.to } : {}) } }
      : {}),
    ...(q.q
      ? {
          OR: [
            { description: { contains: q.q.toUpperCase(), mode: "insensitive" } },
            { refNo: { contains: q.q.toUpperCase(), mode: "insensitive" } },
            { supplier: { name: { contains: q.q.toUpperCase(), mode: "insensitive" } } },
          ],
        }
      : {}),
  };

  // Totals respect all filters, except cancellation-exclusion is applied
  // only when the caller did not explicitly ask for CANCELLED rows.
  const totalsWhere: Prisma.LpoWhereInput = q.status
    ? where
    : { ...where, status: { not: "CANCELLED" } };

  const [rows, totals] = await prisma.$transaction([
    prisma.lpo.findMany({
      where,
      orderBy: { [q.sort]: q.dir },
      take: q.limit + 1,
      include: { supplier: { select: { id: true, name: true } } },
      ...(q.cursor ? { cursor: { id: BigInt(q.cursor) }, skip: 1 } : {}),
    }),
    prisma.lpo.aggregate({
      where: totalsWhere,
      _count: { _all: true },
      _sum: { amountFils: true },
    }),
  ]);

  const hasMore = rows.length > q.limit;
  const items = hasMore ? rows.slice(0, -1) : rows;
  const nextCursor = hasMore ? String(items[items.length - 1].id) : null;

  return {
    items,
    nextCursor,
    totals: {
      activeCount: totals._count._all,
      activeSumFils: totals._sum.amountFils ?? 0n,
    },
  };
}
