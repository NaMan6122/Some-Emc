import { prisma } from "@/server/db";
import { HttpApiError } from "@/lib/http-error";
import type { Trade } from "@prisma/client";
import { computeCompliance } from "@/server/services/vos";

// spec-014: server-computed analytics (PRD §8 formulas; clients never aggregate).
//
// Matched-window semantics were pinned against the legacy Investment report's
// own chart arrays before any UI consumes them (spec AC4):
// - window months = the months covered by payment certificates;
// - invested(month) = Σ active-LPO amounts issued in that calendar month;
// - LPOs issued BEFORE the window collapse into a carry-in base added to
//   cumulative invested (report: TOTAL INVESTMENT 12.64M);
// - certificates bucket by period label (PC01 invoices in May but occupies the
//   Apr slot), falling back to invoice date;
// - recoveryRate = cumulative recovered ÷ (carry-in + Σ window invested).

/** DCL-007 (spec-025): SWPS exclusion RETIRED — client confirmed the package
 *  sits inside the JCA (AED 3.60M line). Constant kept as empty array so any
 *  stale import keeps compiling; budget lens now counts every active LPO. */
export const EXCLUDED_REFS: string[] = [];

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

function monthKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** "Upto 25 Jun 2025" → "2025-06"; "Apr 2025" → "2025-04". */
export function parseLabelMonth(label: string): string | null {
  const m = label.toLowerCase().match(new RegExp(`(${MONTHS.join("|")})[a-z]*\\s*,?\\s*(\\d{4})`));
  if (!m) return null;
  const mi = MONTHS.indexOf(m[1]);
  return `${m[2]}-${String(mi + 1).padStart(2, "0")}`;
}

function addMonths(key: string, n: number): string {
  const [y, mo] = key.split("-").map(Number);
  const d = new Date(Date.UTC(y, mo - 1 + n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function pct(part: bigint, whole: bigint): number {
  if (whole === 0n) return 0;
  return Number((part * 10000n) / whole) / 100;
}

async function activeLpos(projectId: number) {
  return prisma.lpo.findMany({
    where: { projectId, supersededById: null, status: { not: "CANCELLED" } },
    select: { refNo: true, trade: true, amountFils: true, issueDate: true, verification: true, supplierId: true, vatRate: true },
  });
}

async function requireProject(projectId: number) {
  const p = await prisma.project.findUnique({ where: { id: projectId }, select: { id: true } });
  if (!p) throw new HttpApiError(404, "NOT_FOUND", "Project not found");
}

export type OverviewPayload = Awaited<ReturnType<typeof overview>>;

export async function overview(projectId: number) {
  await requireProject(projectId);
  const lpos = await activeLpos(projectId);
  const amounts = lpos.map((l) => l.amountFils).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const total = amounts.reduce((s, a) => s + a, 0n);
  const n = BigInt(amounts.length);
  const median =
    amounts.length === 0
      ? 0n
      : amounts.length % 2 === 1
        ? amounts[(amounts.length - 1) / 2]
        : (amounts[amounts.length / 2 - 1] + amounts[amounts.length / 2]) / 2n;

  const byTrade = new Map<string, { fils: bigint; count: number }>();
  const bySupplier = new Set<number>();
  const byMonth = new Map<string, bigint>();
  let flagged = 0;
  for (const l of lpos) {
    const t = byTrade.get(l.trade) ?? { fils: 0n, count: 0 };
    byTrade.set(l.trade, { fils: t.fils + l.amountFils, count: t.count + 1 });
    bySupplier.add(l.supplierId);
    if (l.issueDate) {
      const k = monthKey(l.issueDate);
      byMonth.set(k, (byMonth.get(k) ?? 0n) + l.amountFils);
    }
    if (l.verification !== "VERIFIED") flagged++;
  }

  const [allocOut, allocIn] = await Promise.all([
    prisma.lpoAllocation.findMany({
      where: { lpo: { projectId } },
      select: { pct: true, lpo: { select: { amountFils: true } } },
    }),
    prisma.lpoAllocation.findMany({
      where: { targetProjectId: projectId },
      select: { pct: true, lpo: { select: { amountFils: true } } },
    }),
  ]);
  // spec-022-v1: ADDITIVE allocation KPIs (pct × amount, integer floor).
  const allocatedOutFils = allocOut.reduce((s, a) => s + (a.lpo.amountFils * BigInt(a.pct)) / 100n, 0n);
  const allocatedInFils = allocIn.reduce((s, a) => s + (a.lpo.amountFils * BigInt(a.pct)) / 100n, 0n);

  // spec-025-v1: VAT-net total. amountFils is VAT-inclusive at each line's own
  // vatRate; net = Σ amount ÷ (1 + rate), floored per line.
  const totalLpoExVatFils = lpos.reduce((s, l) => {
    const rateBp = BigInt(Math.round(Number(l.vatRate) * 10000)); // basis points
    return s + (l.amountFils * 10000n) / (10000n + rateBp);
  }, 0n);

  // spec-025-v1: utilised/balance boxes. JCA budget = Σ all budget lines;
  // utilised = committed total (definition pinned in spec).
  const jcaBudgetFils = (
    await prisma.budgetLine.aggregate({ where: { projectId }, _sum: { amountFils: true } })
  )._sum.amountFils ?? 0n;

  return {
    totalLpoFils: total,
    totalLpoExVatFils,
    jcaBudgetFils,
    activeCount: lpos.length,
    supplierCount: bySupplier.size,
    avgLpoFils: amounts.length ? total / n : 0n,
    medianLpoFils: median,
    largestLpoFils: amounts.at(-1) ?? 0n,
    flaggedCount: flagged,
    allocatedOutFils,
    allocatedInFils,
    tradeBreakdown: [...byTrade.entries()]
      .map(([trade, v]) => ({ trade, fils: v.fils, count: v.count, pct: pct(v.fils, total) }))
      .sort((a, b) => (b.fils > a.fils ? 1 : b.fils < a.fils ? -1 : 0)),
    monthlySeries: [...byMonth.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([month, committedFils]) => ({ month, committedFils })),
  };
}

export async function budgetAnalytics(projectId: number) {
  await requireProject(projectId);
  const TRADE_ORDER: Trade[] = ["ELECTRICAL", "PLUMBING", "HVAC", "FIRE_FIGHTING", "GENERAL", "HSE", "OTHER"];
  const [lpos, budgets] = await Promise.all([
    activeLpos(projectId),
    prisma.budgetLine.groupBy({ by: ["trade"], where: { projectId }, _sum: { amountFils: true } }),
  ]);
  // spec-025-v1 / DCL-007: client confirmed SWPS sits INSIDE the JCA — the
  // exclusion lens is removed; committed counts every active LPO in-trade.
  const committedMap = new Map<string, bigint>();
  for (const l of lpos) {
    committedMap.set(l.trade, (committedMap.get(l.trade) ?? 0n) + l.amountFils);
  }
  const budgetMap = new Map(budgets.map((b) => [b.trade, b._sum?.amountFils ?? 0n]));

  const rows = TRADE_ORDER.map((trade) => {
    const budget = budgetMap.get(trade) ?? 0n;
    const committed = committedMap.get(trade) ?? 0n;
    const utilizationPct = budget > 0n ? Number((committed * 10000n) / budget) / 100 : 0;
    let status: "under" | "watch" | "over" | "no_budget" | "no_spend";
    if (budget === 0n && committed > 0n) status = "no_budget";
    else if (budget === 0n) status = "no_spend";
    else if (utilizationPct > 100) status = "over";
    else if (utilizationPct >= 90) status = "watch";
    else status = "under";
    return { trade, budgetFils: budget, committedFils: committed, utilizationPct, status };
  });

  return {
    items: rows,
    excludedRefs: [] as string[],
    excludedFils: 0n,
  };
}

async function pcMonths(projectId: number) {
  const pcs = await prisma.paymentCertificate.findMany({
    where: { projectId },
    orderBy: { pcNumber: "asc" },
    select: { pcNumber: true, periodLabel: true, invoiceDate: true, applicationDate: true, dueDate: true, paymentReceivedDate: true, netPayableFils: true, retentionFils: true, variationClaimFils: true, status: true, createdAt: true },
  });
  return pcs.map((pc) => ({
    ...pc,
    month: parseLabelMonth(pc.periodLabel) ?? monthKey(pc.invoiceDate ?? pc.createdAt),
  }));
}

function enumerateMonths(start: string, end: string): string[] {
  const out: string[] = [];
  let cur = start;
  while (cur <= end) {
    out.push(cur);
    cur = addMonths(cur, 1);
  }
  return out;
}

export async function cashflow(projectId: number) {
  await requireProject(projectId);
  const pcs = await pcMonths(projectId);
  const lpos = await activeLpos(projectId);
  const releasedTotal = await prisma.retentionRelease.aggregate({
    where: { projectId },
    _sum: { amountFils: true },
  });

  if (pcs.length === 0) {
    return {
      windowMonths: [],
      monthly: [],
      carryInFils: 0n,
      retentionTotalFils: 0n,
      retentionReleasedFils: releasedTotal._sum.amountFils ?? 0n,
      retentionHeldFils: -(releasedTotal._sum.amountFils ?? 0n),
      paymentCycle: {
        avgApplicationToCertifiedDays: null,
        avgDueToReceivedDays: null,
        avgDelayDays: null,
        receivedByMonth: [],
      },
      variationClaims: { claimedFils: 0n, unapprovedVoExposureFils: 0n },
    };
  }
  const months = enumerateMonths(pcs[0].month, pcs[pcs.length - 1].month);
  const windowStart = months[0];

  const investedByMonth = new Map<string, bigint>(months.map((m) => [m, 0n]));
  let carryIn = 0n;
  for (const l of lpos) {
    if (!l.issueDate) continue;
    const k = monthKey(l.issueDate);
    if (k >= windowStart) investedByMonth.set(k, (investedByMonth.get(k) ?? 0n) + l.amountFils);
    else carryIn += l.amountFils;
  }

  let cumInv = carryIn;
  let cumCert = 0n;
  const monthly = months.map((month) => {
    const committedFils = investedByMonth.get(month) ?? 0n;
    const certifiedFils = pcs.filter((p) => p.month === month).reduce((s, p) => s + p.netPayableFils, 0n);
    cumInv += committedFils;
    cumCert += certifiedFils;
    return { month, committedFils, certifiedFils, cumulativeCommittedFils: cumInv, cumulativeCertifiedFils: cumCert, outstandingFils: cumInv - cumCert };
  });

  const compliance = await computeCompliance(projectId);
  const retentionTotalFils = pcs.reduce((s, p) => s + p.retentionFils, 0n);
  // spec-019-v1: additive fields only — existing golden anchors (incl. the
  // DCL-004 row-sum) stay byte-identical. Held may go negative on bad input;
  // honest math beats a silent clamp.
  const retentionReleasedFils = releasedTotal._sum.amountFils ?? 0n;

  // spec-027-v1: payment-cycle metrics. Null-safe — PCs lacking a date pair
  // are excluded from that metric only. Days are calendar-day differences.
  const DAY = 86_400_000;
  const days = (a: Date | null, b: Date | null): number | null =>
    a && b ? Math.round((b.getTime() - a.getTime()) / DAY) : null;
  const subToCert = pcs
    .map((p) => days(p.applicationDate, p.invoiceDate ?? p.createdAt))
    .filter((d): d is number => d !== null);
  const dueToRec = pcs
    .map((p) => days(p.dueDate, p.paymentReceivedDate))
    .filter((d): d is number => d !== null);
  const avg = (arr: number[]) => (arr.length ? Math.round(arr.reduce((s, d) => s + d, 0) / arr.length) : null);

  // Received-by-month: Σ paymentReceivedDate-month amounts as % of certified net.
  const receivedByMonthMap = new Map<string, bigint>();
  for (const p of pcs) {
    if (!p.paymentReceivedDate) continue;
    const k = monthKey(p.paymentReceivedDate);
    receivedByMonthMap.set(k, (receivedByMonthMap.get(k) ?? 0n) + p.netPayableFils);
  }
  const certifiedTotal = pcs.reduce((s, p) => s + p.netPayableFils, 0n);
  const receivedByMonth = [...receivedByMonthMap.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([month, fils]) => ({
      month,
      amountFils: fils,
      pct: certifiedTotal > 0n ? Number((fils * 10000n) / certifiedTotal) / 100 : 0,
    }));

  return {
    windowMonths: [months[0], months[months.length - 1]],
    monthly,
    carryInFils: carryIn,
    retentionTotalFils,
    retentionReleasedFils,
    retentionHeldFils: retentionTotalFils - retentionReleasedFils,
    paymentCycle: {
      avgApplicationToCertifiedDays: avg(subToCert),
      avgDueToReceivedDays: avg(dueToRec),
      avgDelayDays: avg(dueToRec),
      receivedByMonth,
    },
    variationClaims: {
      claimedFils: pcs.reduce((s, p) => s + p.variationClaimFils, 0n),
      unapprovedVoExposureFils: compliance.unapprovedVoExposure,
    },
  };
}

export async function investment(projectId: number) {
  await requireProject(projectId);
  const cf = await cashflow(projectId);
  const monthly = cf.monthly;
  if (monthly.length === 0) {
    return { windowMonths: [], investedTotalFils: 0n, recoveredTotalFils: 0n, outstandingFinalFils: 0n, recoveryRatePct: 0, peakExposureMonth: null, carryInFils: cf.carryInFils, monthly };
  }
  const investedTotal = monthly[monthly.length - 1].cumulativeCommittedFils;
  const recoveredTotal = monthly[monthly.length - 1].cumulativeCertifiedFils;
  const peak = monthly.reduce((best, m) => (m.outstandingFils > best.outstandingFils ? m : best), monthly[0]);
  return {
    windowMonths: cf.windowMonths,
    investedTotalFils: investedTotal,
    recoveredTotalFils: recoveredTotal,
    outstandingFinalFils: monthly[monthly.length - 1].outstandingFils,
    recoveryRatePct: investedTotal > 0n ? Number((recoveredTotal * 10000n) / investedTotal) / 100 : 0,
    peakExposureMonth: peak.month,
    peakExposureFils: peak.outstandingFils,
    carryInFils: cf.carryInFils,
    monthly: monthly.map(({ month, committedFils, certifiedFils, outstandingFils }) => ({ month, investedFils: committedFils, recoveredFils: certifiedFils, outstandingFils })),
  };
}

export async function vendors(projectId: number) {
  await requireProject(projectId);
  const [lpos, suppliers] = await Promise.all([
    activeLpos(projectId),
    prisma.supplier.findMany({ select: { id: true, name: true } }),
  ]);
  const nameById = new Map(suppliers.map((s) => [s.id, s.name]));
  const bySupplier = new Map<number, { fils: bigint; count: number }>();
  for (const l of lpos) {
    const cur = bySupplier.get(l.supplierId) ?? { fils: 0n, count: 0 };
    bySupplier.set(l.supplierId, { fils: cur.fils + l.amountFils, count: cur.count + 1 });
  }
  const total = [...bySupplier.values()].reduce((s, v) => s + v.fils, 0n);
  const ranked = [...bySupplier.entries()]
    .map(([supplierId, v]) => ({ supplierId, supplierName: nameById.get(supplierId) ?? `#${supplierId}`, ...v, sharePct: pct(v.fils, total) }))
    .sort((a, b) => (b.fils > a.fils ? 1 : b.fils < a.fils ? -1 : 0));

  let cum = 0n;
  const curve = ranked.map((r, i) => {
    cum += r.fils;
    return { rank: i + 1, supplierName: r.supplierName, fils: r.fils, count: r.count, sharePct: r.sharePct, cumSharePct: pct(cum, total) };
  });
  const top8Share = curve.slice(0, 8).at(-1)?.cumSharePct ?? 0;

  return {
    totalFils: total,
    supplierCount: ranked.length,
    top8SharePct: top8Share,
    repeatSuppliers: ranked.filter((r) => r.count >= 2).length,
    longTailSuppliers: ranked.filter((r) => r.count === 1).length,
    curve,
  };
}

// ---------------------------------------------------------------------------
// spec-030-v1: project cost control — budget → committed → actual → forecast
// → margin. Pure computation over existing data; no new entry points.
// Definitions PINNED here (any change = spec version bump):
//   originalBudget  = Σ JCA/CostLine budgets (all categories)
//   committedFils   = Σ active LPO amounts (spec-007 semantics)
//   actualCostFils  = Σ CostEntry amounts (INVOICE + PAYMENT, all categories)
//   costToComplete  = max(0, originalBudget − committed − actual)
//   forecastFinal   = actual + remaining commitments + CTC remainder
//   marginPct       = (contractValue − forecastFinal) ÷ contractValue × 100
// ---------------------------------------------------------------------------

export async function costControl(projectId: number) {
  await requireProject(projectId);
  const [project, lpos, costLines, costEntries] = await Promise.all([
    prisma.project.findUniqueOrThrow({
      where: { id: projectId },
      select: { contractValueFils: true },
    }),
    activeLpos(projectId),
    prisma.costLine.findMany({ where: { projectId }, select: { category: true, amountFils: true } }),
    prisma.costEntry.findMany({ where: { projectId }, select: { category: true, amountFils: true } }),
  ]);

  const jcaBudget = (
    await prisma.budgetLine.aggregate({ where: { projectId }, _sum: { amountFils: true } })
  )._sum.amountFils ?? 0n;
  const costLineBudget = costLines.reduce((s, c) => s + c.amountFils, 0n);
  const originalBudget = jcaBudget + costLineBudget;

  const committedFils = lpos.reduce((s, l) => s + l.amountFils, 0n);
  const actualCostFils = costEntries.reduce((s, e) => s + e.amountFils, 0n);

  const openCommitments = committedFils > actualCostFils ? committedFils - actualCostFils : 0n;
  const costToCompleteFils =
    originalBudget > committedFils + actualCostFils
      ? originalBudget - committedFils - actualCostFils
      : 0n;
  const forecastFinalFils = actualCostFils + openCommitments + costToCompleteFils;

  const contractValue = project.contractValueFils;
  const profitFils = contractValue - forecastFinalFils;
  const marginPct = contractValue > 0n ? Number((profitFils * 10000n) / contractValue) / 100 : null;

  // Per-category breakdown of actuals.
  const byCategoryMap = new Map<string, bigint>();
  for (const e of costEntries) {
    const k = e.category as string;
    byCategoryMap.set(k, (byCategoryMap.get(k) ?? 0n) + e.amountFils);
  }
  const actualsByCategory = [...byCategoryMap.entries()]
    .map(([category, fils]) => ({ category, fils }))
    .sort((a, b) => (b.fils > a.fils ? 1 : -1));

  return {
    contractValueFils: contractValue,
    originalBudgetFils: originalBudget,
    committedFils,
    actualCostFils,
    openCommitmentsFils: openCommitments,
    costToCompleteFils,
    forecastFinalFils,
    profitFils,
    marginPct,
    actualsByCategory,
  };
}
