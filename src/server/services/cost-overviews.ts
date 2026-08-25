import { CostCategory, CostEntryKind, Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/server/db";
import { audit } from "@/server/audit/service";
import { HttpApiError } from "@/lib/http-error";
import { moneyString } from "@/server/validation/money";

// spec-028-v1 + spec-029-v1: generic cost-control module powering the
// Labour / Supervision / Admin / DLP overviews AND (spec-029) the company-wide
// actual-cost ledger. Budget lines (CostLine) vs actuals (CostEntry) per
// category. Budget writes ADMIN+COMMERCIAL; entry writes ADMIN+FINANCE;
// reads any authenticated. All mutations audited; no UPDATE paths.
// spec-029: entries carry kind INVOICE|PAYMENT and optional supplier/LPO
// linkage — an issued LPO stays a commitment until an invoice books it.

export const COST_CATEGORIES = [
  "LABOUR_INHOUSE",
  "LABOUR_SUBCONTRACT",
  "SUPERVISION",
  "ADMIN",
  "DLP",
  "MATERIAL",
  "OTHER",
] as const;
export type CostCategoryKey = (typeof COST_CATEGORIES)[number];
export const COST_ENTRY_KINDS = ["INVOICE", "PAYMENT"] as const;

export function parseCategory(raw: string | undefined | null): CostCategory {
  if (!raw || !COST_CATEGORIES.includes(raw as CostCategoryKey)) {
    throw new HttpApiError(404, "NOT_FOUND", `Unknown cost category: ${raw ?? "(none)"}`);
  }
  return raw as CostCategory;
}

const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const createCostLineSchema = z.object({
  category: z.enum(COST_CATEGORIES),
  amountFils: moneyString.refine((f) => f > 0n, { message: "amountFils must be greater than zero" }),
  sourceLabel: z.string().trim().min(1).max(120),
  note: z.string().trim().max(300).nullish(),
});

export const createCostEntrySchema = z.object({
  category: z.enum(COST_CATEGORIES),
  entryDate: dateOnly,
  amountFils: moneyString.refine((f) => f > 0n, { message: "amountFils must be greater than zero" }),
  description: z.string().trim().min(1).max(300),
  reference: z.string().trim().max(100).nullish(),
  // spec-029-v1
  kind: z.enum(["INVOICE", "PAYMENT"]).default("INVOICE"),
  supplierId: z.coerce.number().int().positive().nullish(),
  lpoId: z.string().regex(/^\d+$/).nullish(),
});

export const deleteCostSchema = z.object({ id: z.string().regex(/^\d+$/) });

async function assertProject(projectId: number) {
  const p = await prisma.project.findUnique({ where: { id: projectId }, select: { id: true } });
  if (!p) throw new HttpApiError(404, "NOT_FOUND", "Project not found");
}

export async function costOverview(projectId: number, category: CostCategory) {
  await assertProject(projectId);
  const [lines, entries] = await Promise.all([
    prisma.costLine.findMany({ where: { projectId, category }, orderBy: { id: "asc" } }),
    prisma.costEntry.findMany({ where: { projectId, category }, orderBy: [{ entryDate: "asc" }, { id: "asc" }] }),
  ]);
  const budgetFils = lines.reduce((s, l) => s + l.amountFils, 0n);
  const actualFils = entries.reduce((s, e) => s + e.amountFils, 0n);
  const varianceFils = budgetFils - actualFils;
  const utilisationPct = budgetFils > 0n ? Number((actualFils * 10000n) / budgetFils) / 100 : null;

  const monthly = new Map<string, bigint>();
  for (const e of entries) {
    const k = e.entryDate.toISOString().slice(0, 7);
    monthly.set(k, (monthly.get(k) ?? 0n) + e.amountFils);
  }

  return {
    category,
    budgetFils,
    actualFils,
    varianceFils,
    utilisationPct,
    lines,
    entries,
    monthlySeries: [...monthly.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([month, fils]) => ({ month, fils })),
  };
}

export async function createCostLine(actorId: number, projectId: number, category: CostCategory, input: { amountFils: bigint; sourceLabel: string; note?: string | null }) {
  await assertProject(projectId);
  return prisma.$transaction(async (tx) => {
    const created = await tx.costLine.create({
      data: { projectId, category, amountFils: input.amountFils, sourceLabel: input.sourceLabel, note: input.note ?? null },
    });
    await audit(tx, {
      actorId,
      entity: "CostLine",
      entityId: created.id,
      action: "CREATE",
      after: { projectId, category, amountFils: input.amountFils.toString(), sourceLabel: input.sourceLabel },
    });
    return created;
  });
}

export async function createCostEntry(
  actorId: number,
  projectId: number,
  category: CostCategory,
  input: {
    entryDate: string;
    amountFils: bigint;
    description: string;
    reference?: string | null;
    // spec-029-v1 extensions
    kind?: CostEntryKind;
    supplierId?: number | null;
    lpoId?: string | null;
  },
) {
  await assertProject(projectId);

  let lpoIdBigInt: bigint | null = null;
  if (input.lpoId != null && input.lpoId !== "") {
    if (!/^\d+$/.test(input.lpoId)) throw new HttpApiError(422, "VALIDATION_ERROR", "lpoId must be numeric");
    const lpo = await prisma.lpo.findUnique({ where: { id: BigInt(input.lpoId) }, select: { id: true, projectId: true } });
    if (!lpo || lpo.projectId !== projectId) {
      throw new HttpApiError(422, "VALIDATION_ERROR", "LPO must belong to this project");
    }
    lpoIdBigInt = BigInt(input.lpoId);
  }
  if (input.supplierId != null) {
    const sup = await prisma.supplier.findUnique({ where: { id: input.supplierId }, select: { id: true } });
    if (!sup) throw new HttpApiError(422, "VALIDATION_ERROR", "Unknown supplier");
  }

  return prisma.$transaction(async (tx) => {
    const created = await tx.costEntry.create({
      data: {
        projectId,
        category,
        entryDate: new Date(`${input.entryDate}T00:00:00Z`),
        amountFils: input.amountFils,
        description: input.description,
        reference: input.reference ?? null,
        kind: input.kind ?? CostEntryKind.INVOICE,
        supplierId: input.supplierId ?? null,
        lpoId: lpoIdBigInt,
      },
    });
    await audit(tx, {
      actorId,
      entity: "CostEntry",
      entityId: created.id,
      action: "CREATE",
      after: {
        projectId,
        category,
        entryDate: input.entryDate,
        amountFils: input.amountFils.toString(),
        description: input.description,
        kind: input.kind ?? "INVOICE",
      },
    });
    return created;
  });
}

type Deletable = "CostLine" | "CostEntry";

export async function deleteCost(kind: Deletable, actorId: number, rawId: string) {
  if (!/^\d+$/.test(rawId)) throw new HttpApiError(404, "NOT_FOUND", "Record not found");
  const id = BigInt(rawId);
  return prisma.$transaction(async (tx) => {
    if (kind === "CostLine") {
      const row = await tx.costLine.findUnique({ where: { id } });
      if (!row) throw new HttpApiError(404, "NOT_FOUND", "Cost line not found");
      await tx.costLine.delete({ where: { id } });
      await audit(tx, {
        actorId,
        entity: "CostLine",
        entityId: id,
        action: "DELETE",
        before: { projectId: row.projectId, category: row.category, amountFils: row.amountFils.toString(), sourceLabel: row.sourceLabel },
      });
      return row;
    }
    const row = await tx.costEntry.findUnique({ where: { id } });
    if (!row) throw new HttpApiError(404, "NOT_FOUND", "Cost entry not found");
    await tx.costEntry.delete({ where: { id } });
    await audit(tx, {
      actorId,
      entity: "CostEntry",
      entityId: id,
      action: "DELETE",
      before: { projectId: row.projectId, category: row.category, entryDate: row.entryDate.toISOString(), amountFils: row.amountFils.toString() },
    });
    return row;
  });
}

// ---------------------------------------------------------------------------
// spec-029-v1: actual-costs ledger queries.
// ---------------------------------------------------------------------------

export type LedgerFilter = {
  category?: CostCategory;
  supplierId?: number;
  from?: string; // ISO date
  to?: string; // ISO date
  kind?: CostEntryKind;
};

export async function ledgerTotals(projectId: number, filter: LedgerFilter = {}) {
  const where: Prisma.CostEntryWhereInput = {
    projectId,
    ...(filter.category ? { category: filter.category } : {}),
    ...(filter.supplierId ? { supplierId: filter.supplierId } : {}),
    ...(filter.kind ? { kind: filter.kind } : {}),
    ...(filter.from || filter.to
      ? { entryDate: { ...(filter.from ? { gte: new Date(filter.from) } : {}), ...(filter.to ? { lte: new Date(`${filter.to}T23:59:59Z`) } : {}) } }
      : {}),
  };
  const [invoices, payments] = await Promise.all([
    prisma.costEntry.aggregate({ where: { ...where, kind: "INVOICE" }, _sum: { amountFils: true } }),
    prisma.costEntry.aggregate({ where: { ...where, kind: "PAYMENT" }, _sum: { amountFils: true } }),
  ]);
  return {
    invoicedFils: invoices._sum.amountFils ?? 0n,
    paidFils: payments._sum.amountFils ?? 0n,
  };
}
