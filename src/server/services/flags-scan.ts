import { Trade } from "@prisma/client";
import { prisma } from "@/server/db";
import { HttpApiError } from "@/lib/http-error";
import { formatMoney } from "@/lib/money";
import { computeVariance } from "./budgets";
import { findDuplicatePairs, similarity } from "./duplicates";

// spec-017-v1: FR-9 rules engine. POST /projects/:id/flags/scan evaluates the
// two remaining FR-9 rules idempotently:
//
//   NO_BUDGET_LINE (HIGH)      — trade with committed spend (latest non-cancelled
//                                LPOs, variance v1 semantics) but zero budget lines.
//   DUPLICATE_SUPPLIER_SUSPECT (LOW) — pairs among the project's referenced,
//                                non-merged suppliers scoring ≥0.6 under the
//                                spec-006 heuristic.
//
// Reconciliation is CONDITION-BASED (not pool-based): an OPEN flag survives
// while its underlying condition still holds and is resolved with a fixed note
// when it clears. NO_BUDGET_LINE messages lead with the trade token so the
// per-trade flags can be matched without a schema change.

const AUTO_RESOLVE_NOTE = "Auto-resolved by scan";

export type ScanResult = {
  checkedRules: string[];
  opened: number;
  resolved: number;
};

function pairKey(aId: number, bId: number): string {
  return `${Math.min(aId, bId)}:${Math.max(aId, bId)}`;
}

export async function scanProjectFlags(projectId: number): Promise<ScanResult> {
  const project = await prisma.project.findUnique({ where: { id: projectId }, select: { id: true } });
  if (!project) throw new HttpApiError(404, "NOT_FOUND", "Project not found");

  let opened = 0;
  let resolved = 0;
  const checkedRules: string[] = [];

  // ------------------------------------------------------------------
  // Rule 1 — NO_BUDGET_LINE (Project-entity, one flag per trade).
  // ------------------------------------------------------------------
  {
    checkedRules.push("NO_BUDGET_LINE");
    const pid = String(projectId);
    const qualifying = new Map(
      (await computeVariance(projectId))
        .filter((r) => r.status === "no_budget")
        .map((r) => [r.trade, r.committedFils]),
    );

    const openFlags = await prisma.dataFlag.findMany({
      where: { entityType: "Project", entityId: pid, ruleCode: "NO_BUDGET_LINE", status: "OPEN" },
    });
    for (const flag of openFlags) {
      const trade = flag.message.split(" ")[0] as Trade;
      if (!(trade in Trade) || !qualifying.has(trade)) {
        await prisma.dataFlag.update({
          where: { id: flag.id },
          data: {
            status: "RESOLVED",
            resolvedAt: new Date(),
            resolutionNote: AUTO_RESOLVE_NOTE,
          },
        });
        resolved++;
      }
    }
    const openTrades = new Set(openFlags.map((f) => f.message.split(" ")[0]));
    for (const [trade, committedFils] of qualifying) {
      if (!openTrades.has(trade)) {
        await prisma.dataFlag.create({
          data: {
            entityType: "Project",
            entityId: pid,
            ruleCode: "NO_BUDGET_LINE",
            severity: "HIGH",
            status: "OPEN",
            message: `${trade} has ${formatMoney(committedFils)} committed but no JCA budget line`,
          },
        });
        opened++;
      }
    }
  }

  // ------------------------------------------------------------------
  // Rule 2 — DUPLICATE_SUPPLIER_SUSPECT (Supplier-entity, one flag per
  // pair; entityId = "smallerId:largerId" composite).
  // ------------------------------------------------------------------
  {
    checkedRules.push("DUPLICATE_SUPPLIER_SUSPECT");
    const supplierIds = (
      await prisma.lpo.findMany({
        where: { projectId },
        select: { supplierId: true },
        distinct: ["supplierId"],
      })
    ).map((r) => r.supplierId);
    const candidates = await prisma.supplier.findMany({
      where: { id: { in: supplierIds }, mergedIntoId: null },
      select: { id: true, name: true },
    });
    const byId = new Map(candidates.map((s) => [s.id, s.name]));
    const pairs = findDuplicatePairs(candidates);

    const openFlags = await prisma.dataFlag.findMany({
      where: { entityType: "Supplier", ruleCode: "DUPLICATE_SUPPLIER_SUSPECT", status: "OPEN" },
    });
    const liveKeys = new Set(pairs.map((p) => pairKey(p.aId, p.bId)));
    for (const flag of openFlags) {
      const [aRaw, bRaw] = flag.entityId.split(":");
      if (!/^\d+$/.test(aRaw ?? "") || !/^\d+$/.test(bRaw ?? "")) continue; // not ours to manage
      const key = pairKey(Number(aRaw), Number(bRaw));
      if (liveKeys.has(key)) continue;
      // Condition-based clear: either side merged, or names no longer match.
      const a = await prisma.supplier.findUnique({ where: { id: Number(aRaw) } });
      const b = await prisma.supplier.findUnique({ where: { id: Number(bRaw) } });
      const cleared =
        !a || !b || a.mergedIntoId !== null || b.mergedIntoId !== null ||
        (similarity(a.name, b.name) ?? 0) < 0.6;
      if (cleared) {
        await prisma.dataFlag.update({
          where: { id: flag.id },
          data: {
            status: "RESOLVED",
            resolvedAt: new Date(),
            resolutionNote: AUTO_RESOLVE_NOTE,
          },
        });
        resolved++;
      }
    }
    const openKeys = new Set(openFlags.map((f) => f.entityId));
    for (const p of pairs) {
      const key = pairKey(p.aId, p.bId);
      if (openKeys.has(key)) continue;
      const nameA = byId.get(p.aId)!;
      const nameB = byId.get(p.bId)!;
      await prisma.dataFlag.create({
        data: {
          entityType: "Supplier",
          entityId: key,
          ruleCode: "DUPLICATE_SUPPLIER_SUSPECT",
          severity: "LOW",
          status: "OPEN",
          message: `Possible duplicate suppliers: "${nameA}" and "${nameB}" (score ${p.score})`,
        },
      });
      opened++;
    }
  }

  return { checkedRules, opened, resolved };
}
