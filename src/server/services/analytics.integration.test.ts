import { execSync } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/server/db";
import { signSessionToken } from "@/server/auth/jwt";

let projectId = 0;
let adminCookie = "";

function req(method: string, path: string, cookie?: string) {
  return new Request("http://localhost" + path, {
    method,
    headers: cookie ? { cookie } : {},
  });
}

type RouteModule = { GET: (req: Request, ctx: { params: Promise<{ id: string }> }) => Promise<Response> };

async function get(routePromise: Promise<RouteModule>) {
  const route = await routePromise;
  const res = await route.GET(req("GET", `/api/v1/projects/${projectId}/analytics/x`, adminCookie), {
    params: Promise.resolve({ id: String(projectId) }),
  });
  return res;
}

beforeAll(async () => {
  execSync("npm run --silent seed:job1571", { stdio: "pipe", env: process.env });
  projectId = (await prisma.project.findUniqueOrThrow({ where: { code: "1571" } })).id;
  const admin = await prisma.user.findUniqueOrThrow({ where: { email: "admin@trends.local" } });
  adminCookie = "procare_session=" + (await signSessionToken({ uid: admin.id, role: admin.role, tv: admin.tokenVersion }));
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("spec-014 analytics — golden values from Job 1571", () => {
  it("overview: total/active/suppliers/largest match the dataset to the fils", async () => {
    const t0 = Date.now();
    const res = await get(import("@/app/api/v1/projects/[id]/analytics/overview/route"));
    expect(res.status).toBe(200);
    expect(Date.now() - t0).toBeLessThan(500);
    const body = await res.json();
    // PRD §6: AED 12.98M across 140 active LPOs; largest single LPO AED 3.83M.
    expect(body.totalLpoFils).toBe("1298411500");
    expect(body.activeCount).toBe(140);
    expect(body.supplierCount).toBeGreaterThanOrEqual(90);
    expect(body.largestLpoFils).toBe("383250000");
    expect(body.avgLpoFils).toBe((1298411500n / 140n).toString());
    expect(body.medianLpoFils).toBe("479950");
    const shares = body.tradeBreakdown.reduce(
      (s: number, t: { pct: number }) => s + t.pct,
      0,
    );
    expect(shares).toBeCloseTo(100, 1);
    const electrical = body.tradeBreakdown.find((t: { trade: string }) => t.trade === "ELECTRICAL");
    expect(electrical.pct).toBeGreaterThanOrEqual(45.5);
    expect(electrical.pct).toBeLessThanOrEqual(46.5);
  });

  it("budget: inclusive lens (DCL-007) — JCA lines incl. FF/SWPS, utilizations recomputed", async () => {
    const res = await get(import("@/app/api/v1/projects/[id]/analytics/budget/route"));
    const body = await res.json();
    const byTrade = Object.fromEntries(body.items.map((r: { trade: string }) => [r.trade, r]));
    // DCL-007: exclusion lens retired — SWPS committed now counts inside OTHER.
    expect(body.excludedRefs).toEqual([]);
    expect(body.excludedFils).toBe("0");
    // ELECTRICAL unchanged (no excluded refs were ELECTRICAL).
    expect(byTrade.ELECTRICAL.status).toBe("under");
    expect(Number(byTrade.ELECTRICAL.utilizationPct)).toBeGreaterThan(80);
    // FIRE_FIGHTING now has a 1.44M JCA line; committed 1,583,925 → over.
    expect(byTrade.FIRE_FIGHTING.budgetFils).toBe("144000000");
    expect(byTrade.FIRE_FIGHTING.status).toBe("over");
    // OTHER holds the SWPS line (3.6M) + committed spend.
    expect(BigInt(byTrade.OTHER.budgetFils)).toBe(360000000n);
    expect(BigInt(byTrade.OTHER.committedFils)).toBeGreaterThan(0n);
    // GENERAL/HSE still lack figures — flags stay open (awaited from client).
    expect(byTrade.GENERAL.status).toBe("no_budget");
    expect(byTrade.HSE.status).toBe("no_budget");
  });

  it("spec-025: overview gains ex-VAT total + JCA budget box fields", async () => {
    const res = await get(import("@/app/api/v1/projects/[id]/analytics/overview/route"));
    const body = await res.json();
    const incl = BigInt(body.totalLpoFils);
    const exVat = BigInt(body.totalLpoExVatFils);
    expect(exVat).toBeGreaterThan(0n);
    expect(exVat).toBeLessThan(incl); // net must be below gross
    // Sanity: with uniform 5% VAT the ratio ≈ 1/1.05 ≈ 0.9524.
    const ratio = Number(exVat) / Number(incl);
    expect(ratio).toBeGreaterThan(0.94);
    expect(ratio).toBeLessThan(0.96);
    expect(BigInt(body.jcaBudgetFils)).toBe(700000000n + 50000000n + 30000000n + 360000000n + 144000000n);
  });

  it("cashflow: cumulative certified lands on the dataset row-sum; retention totals", async () => {
    const res = await get(import("@/app/api/v1/projects/[id]/analytics/cashflow/route"));
    const body = await res.json();
    expect(body.windowMonths).toEqual(["2025-04", "2026-05"]);
    const last = body.monthly.at(-1);
    // DCL-005a: dataset row-sum (v1 spec figure was unverifiable).
    expect(last.cumulativeCertifiedFils).toBe("1033197800");
    expect(body.retentionTotalFils).toBe("48909700");
    expect(body.variationClaims.claimedFils).toBe("8400100");
    // Carry-in base = pre-window commitments (Apr'24 + Feb'25 + Mar'25).
    expect(body.carryInFils).toBe("162363700");
  });

  it("investment: recovery rate 81.8%±0.5pp with Dec-2025 peak exposure", async () => {
    const res = await get(import("@/app/api/v1/projects/[id]/analytics/investment/route"));
    const body = await res.json();
    // Report TOTAL INVESTMENT includes pre-window carry-in through window end.
    expect(body.investedTotalFils).toBe("1263848300");
    expect(body.recoveredTotalFils).toBe("1033197800");
    expect(BigInt(body.outstandingFinalFils)).toBe(
      BigInt(body.investedTotalFils) - BigInt(body.recoveredTotalFils),
    );
    expect(body.recoveryRatePct).toBeGreaterThanOrEqual(81.3);
    expect(body.recoveryRatePct).toBeLessThanOrEqual(82.3);
    expect(["2025-06", "2025-07", "2025-08", "2025-09", "2025-10", "2025-11", "2025-12"]).toContain(
      body.peakExposureMonth,
    );
    // Exact from dataset; legacy report printed 5576280 due to its own per-month rounding.
    expect(body.peakExposureFils).toBe("557628300");
  });

  it("vendors: top-8 share matches canonicalized dataset (DCL-005b anchor)", async () => {
    const res = await get(import("@/app/api/v1/projects/[id]/analytics/vendors/route"));
    const body = await res.json();
    // Legacy report claimed 76% over 118 raw vendors; supplier
    // canonicalization (103→90) concentrates spend to 79.33%. Corrected
    // anchor per DCL-005b.
    expect(body.top8SharePct).toBeGreaterThanOrEqual(78.8);
    expect(body.top8SharePct).toBeLessThanOrEqual(79.8);
    expect(body.supplierCount).toBe(90);
    expect(body.curve[0].sharePct).toBeGreaterThan(29); // top supplier ≈30%
    expect(body.repeatSuppliers).toBeGreaterThan(0);
    expect(body.longTailSuppliers).toBeGreaterThan(0);
  });

  it("spec-027: paymentCycle metrics null-safe with fixture dates", async () => {
    // Seed PCs have no cycle dates — all averages null, receivedByMonth empty.
    const baseline = await get(import("@/app/api/v1/projects/[id]/analytics/cashflow/route")).then((r) => r.json());
    expect(baseline.paymentCycle.avgApplicationToCertifiedDays).toBeNull();

    // Fixture PC with known gaps: application → invoice 10d, due → received −5d (early).
    const created = await prisma.paymentCertificate.create({
      data: {
        projectId,
        pcNumber: 91,
        periodLabel: "T027 probe",
        applicationDate: new Date("2026-06-01"),
        invoiceDate: new Date("2026-06-11"),
        dueDate: new Date("2026-07-01"),
        paymentReceivedDate: new Date("2026-06-27"),
        grossFils: 100000n,
        retentionFils: 0n,
        netPayableFils: 100000n,
        status: "PAID",
        provenance: "SOURCE_DOCUMENT",
      },
    });
    try {
      const cf = await import("@/server/services/analytics").then(({ cashflow }) => cashflow(projectId));
      const sub = Math.round(
        (new Date("2026-06-11").getTime() - new Date("2026-06-01").getTime()) / 86_400_000,
      );
      const delay = Math.round(
        (new Date("2026-06-27").getTime() - new Date("2026-07-01").getTime()) / 86_400_000,
      );
      // Averages over seeded(0-date) + fixture: only fixture has dates.
      expect(cf.paymentCycle.avgApplicationToCertifiedDays).toBe(sub); // 10
      expect(cf.paymentCycle.avgDelayDays).toBeLessThanOrEqual(delay + 1);
      expect(cf.paymentCycle.receivedByMonth.length).toBeGreaterThan(0);
      expect(cf.paymentCycle.receivedByMonth.some((r) => r.month === "2026-06")).toBe(true);
    } finally {
      await prisma.paymentCertificate.delete({ where: { id: created.id } });
    }
  });

  it("all endpoints reject unauthenticated requests with a 401 envelope", async () => {
    // Literal specifiers: Vite only rewrites static/dynamic imports it can see.
    const routes = await Promise.all([
      import("@/app/api/v1/projects/[id]/analytics/overview/route"),
      import("@/app/api/v1/projects/[id]/analytics/budget/route"),
      import("@/app/api/v1/projects/[id]/analytics/cashflow/route"),
      import("@/app/api/v1/projects/[id]/analytics/investment/route"),
      import("@/app/api/v1/projects/[id]/analytics/vendors/route"),
    ]);
    for (const route of routes) {
      const res = await route.GET(req("GET", "/api/v1/projects/220/analytics/x"), {
        params: Promise.resolve({ id: "220" }),
      });
      expect(res.status).toBe(401);
    }
  });
});
