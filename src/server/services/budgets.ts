import { Prisma, type Trade } from "@prisma/client";
import { prisma } from "@/server/db";
import { audit } from "@/server/audit/service";
import { HttpApiError } from "@/lib/http-error";
import type { CreateBudgetLineInput, UpdateBudgetLineInput } from "@/server/validation/budget-line";

const TRADES: Trade[] = ["ELECTRICAL", "PLUMBING", "HVAC", "FIRE_FIGHTING", "GENERAL", "HSE", "OTHER"];

export async function listBudgetLines(projectId: number) {
  const project = await prisma.project.findUnique({ where: { id: projectId }, select: { id: true } });
  if (!project) throw new HttpApiError(404, "NOT_FOUND", "Project not found");
  return prisma.budgetLine.findMany({
    where: { projectId },
    orderBy: { id: "asc" },
  });
}

export async function listBudgetLinesByCode(code: string) {
  const project = await prisma.project.findUnique({ where: { code }, select: { id: true } });
  if (!project) throw new HttpApiError(404, "NOT_FOUND", "Project not found");
  return listBudgetLines(project.id);
}

export async function createBudgetLine(actorId: number, projectId: number, input: CreateBudgetLineInput) {
  const project = await prisma.project.findUnique({ where: { id: projectId }, select: { id: true } });
  if (!project) throw new HttpApiError(404, "NOT_FOUND", "Project not found");
  return prisma.$transaction(async (tx) => {
    // spec-011 AC3: duplicate trade+category within the active set is allowed
    // but flagged advisory (BUDGET_DUPLICATE_LINE).
    const duplicate = await tx.budgetLine.findFirst({
      where: { projectId, trade: input.trade, category: input.category },
      select: { id: true },
    });
    const created = await tx.budgetLine.create({
      data: {
        projectId,
        trade: input.trade,
        category: input.category,
        amountFils: input.amountFils,
        sourceLabel: input.sourceLabel,
        refDate: input.refDate ? new Date(input.refDate) : null,
        note: input.note ?? null,
      },
    });
    if (duplicate) {
      await tx.dataFlag.create({
        data: {
          entityType: "BudgetLine",
          entityId: String(created.id),
          ruleCode: "BUDGET_DUPLICATE_LINE",
          severity: "LOW",
          status: "OPEN",
          message: `Duplicate budget line: ${input.trade}/${input.category} already has a line in this set`,
        },
      });
    }
    await audit(tx, {
      actorId,
      entity: "BudgetLine",
      entityId: created.id,
      action: "CREATE",
      after: { trade: input.trade, category: input.category, amountFils: input.amountFils.toString(), sourceLabel: input.sourceLabel },
    });
    return created;
  });
}

export async function updateBudgetLine(actorId: number, rawId: string, patch: UpdateBudgetLineInput) {
  if (!/^\d+$/.test(rawId)) throw new HttpApiError(404, "NOT_FOUND", "Budget line not found");
  const id = BigInt(rawId);
  return prisma.$transaction(async (tx) => {
    const row = await tx.budgetLine.findUnique({ where: { id } });
    if (!row) throw new HttpApiError(404, "NOT_FOUND", "Budget line not found");
    const data: Prisma.BudgetLineUpdateInput = {};
    if (patch.amountFils !== undefined) data.amountFils = patch.amountFils;
    if (patch.sourceLabel !== undefined) data.sourceLabel = patch.sourceLabel;
    if (patch.refDate !== undefined) data.refDate = patch.refDate ? new Date(patch.refDate) : null;
    if (patch.note !== undefined) data.note = patch.note ?? null;
    const updated = await tx.budgetLine.update({ where: { id }, data });
    await audit(tx, {
      actorId,
      entity: "BudgetLine",
      entityId: id,
      action: "UPDATE",
      before: { amountFils: row.amountFils.toString(), sourceLabel: row.sourceLabel },
      after: { amountFils: updated.amountFils.toString(), sourceLabel: updated.sourceLabel },
    });
    return updated;
  });
}

export async function deleteBudgetLine(actorId: number, rawId: string) {
  if (!/^\d+$/.test(rawId)) throw new HttpApiError(404, "NOT_FOUND", "Budget line not found");
  const id = BigInt(rawId);
  return prisma.$transaction(async (tx) => {
    const row = await tx.budgetLine.findUnique({ where: { id } });
    if (!row) throw new HttpApiError(404, "NOT_FOUND", "Budget line not found");
    await tx.budgetLine.delete({ where: { id } });
    await audit(tx, {
      actorId,
      entity: "BudgetLine",
      entityId: id,
      action: "DELETE",
      before: { trade: row.trade, amountFils: row.amountFils.toString(), sourceLabel: row.sourceLabel },
    });
    return row;
  });
}

// spec-011: variance computation — committed vs budget per trade.
// Committed = latest non-cancelled, non-superseded LPOs in each trade.
export type VarianceRow = {
  trade: string;
  budgetFils: bigint;
  committedFils: bigint;
  utilizationPct: number;
  status: "under" | "watch" | "over" | "no_budget" | "no_spend";
};

const WARN_PCT = 90;
const OVER_PCT = 100;

export async function computeVariance(projectId: number): Promise<VarianceRow[]> {
  const [budgets, committed] = await prisma.$transaction([
    prisma.budgetLine.groupBy({
      by: ["trade"],
      where: { projectId },
      _sum: { amountFils: true },
    } satisfies Prisma.BudgetLineGroupByArgs),
    prisma.lpo.groupBy({
      by: ["trade"],
      orderBy: { _sum: { amountFils: "desc" } },
      where: {
        projectId,
        supersededById: null,
        status: { not: "CANCELLED" },
      },
      _sum: { amountFils: true },
    }),
  ]);

  const budgetMap = new Map(budgets.map((b) => [b.trade, b._sum?.amountFils ?? 0n]));
  const committedMap = new Map(committed.map((c) => [c.trade, c._sum?.amountFils ?? 0n]));

  return TRADES.map((trade): VarianceRow => {
    const budget = budgetMap.get(trade) ?? 0n;
    const committed = committedMap.get(trade) ?? 0n;
    const utilizationPct = budget > 0n ? Number((committed * 10000n) / budget) / 100 : 0;
    let status: VarianceRow["status"];
    if (budget === 0n && committed > 0n) status = "no_budget";
    else if (budget === 0n) status = "no_spend";
    else if (utilizationPct > OVER_PCT) status = "over";
    else if (utilizationPct >= WARN_PCT) status = "watch";
    else status = "under";
    return { trade, budgetFils: budget, committedFils: committed, utilizationPct, status };
  });
}
