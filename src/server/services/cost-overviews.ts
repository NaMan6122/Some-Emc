import { CostCategory } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/server/db";
import { audit } from "@/server/audit/service";
import { HttpApiError } from "@/lib/http-error";
import { moneyString } from "@/server/validation/money";

// spec-028-v1: generic cost-control module powering the Labour / Supervision /
// Admin / DLP overviews. Budget lines (CostLine) vs actuals (CostEntry) per
// category. Budget writes ADMIN+COMMERCIAL; entry writes ADMIN+FINANCE;
// reads any authenticated. All mutations audited; no UPDATE paths.

export const COST_CATEGORIES = ["LABOUR_INHOUSE", "LABOUR_SUBCONTRACT", "SUPERVISION", "ADMIN", "DLP"] as const;
export type CostCategoryKey = (typeof COST_CATEGORIES)[number];

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

export async function createCostEntry(actorId: number, projectId: number, category: CostCategory, input: { entryDate: string; amountFils: bigint; description: string; reference?: string | null }) {
  await assertProject(projectId);
  return prisma.$transaction(async (tx) => {
    const created = await tx.costEntry.create({
      data: {
        projectId,
        category,
        entryDate: new Date(`${input.entryDate}T00:00:00Z`),
        amountFils: input.amountFils,
        description: input.description,
        reference: input.reference ?? null,
      },
    });
    await audit(tx, {
      actorId,
      entity: "CostEntry",
      entityId: created.id,
      action: "CREATE",
      after: { projectId, category, entryDate: input.entryDate, amountFils: input.amountFils.toString(), description: input.description },
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
