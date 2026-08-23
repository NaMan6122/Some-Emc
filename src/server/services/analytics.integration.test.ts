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

  it("budget: excl-SWPS lens reproduces report utilizations incl. Fire Fighting gap", async () => {
    const res = await get(import("@/app/api/v1/projects/[id]/analytics/budget/route"));
    const body = await res.json();
    const byTrade = Object.fromEntries(body.items.map((r: { trade: string }) => [r.trade, r]));
    expect(byTrade.ELECTRICAL.status).toBe("under");
    expect(byTrade.ELECTRICAL.utilizationPct).toBeCloseTo(85.03, 1);
    expect(byTrade.HVAC.status).toBe("over");
    expect(byTrade.HVAC.utilizationPct).toBeCloseTo(123.39, 1);
    // Plumbing excluding the SWPS package ≈ report's 117.87% over.
    expect(byTrade.PLUMBING.committedFils).toBe("35362100");
    expect(byTrade.PLUMBING.utilizationPct).toBeCloseTo(117.87, 1);
    expect(byTrade.FIRE_FIGHTING.status).toBe("no_budget");
    expect(body.excludedRefs).toContain("TEMW/REF/LPO//039");
    expect(body.excludedFils).toBe("383250000");
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
