import { execSync } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/server/db";
import { signSessionToken } from "@/server/auth/jwt";

let projectId = 0;
let adminCookie = "";
let commercialCookie = "";
let financeCookie = "";
const createdLineIds: string[] = [];
const createdFlagIds: string[] = [];

function req(method: string, path: string, cookie: string, body?: unknown) {
  return new Request("http://localhost" + path, {
    method,
    headers: { "content-type": "application/json", cookie },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

async function cookieFor(email: string): Promise<string> {
  const user = await prisma.user.findUniqueOrThrow({ where: { email } });
  return "procare_session=" + (await signSessionToken({ uid: user.id, role: user.role, tv: user.tokenVersion }));
}

beforeAll(async () => {
  execSync("npm run --silent seed:job1571", { stdio: "pipe", env: process.env });
  const project = await prisma.project.findUniqueOrThrow({ where: { code: "1571" } });
  projectId = project.id;
  adminCookie = await cookieFor("admin@trends.local");
  commercialCookie = await cookieFor("commercial@trends.local");
  financeCookie = await cookieFor("finance@trends.local");
});

afterAll(async () => {
  // Only remove rows this suite created; seeded JCA lines stay.
  if (createdLineIds.length > 0) {
    await prisma.budgetLine.deleteMany({ where: { id: { in: createdLineIds.map((s) => BigInt(s)) } } });
  }
  if (createdFlagIds.length > 0) {
    await prisma.dataFlag.deleteMany({ where: { id: { in: createdFlagIds.map((s) => BigInt(s)) } } });
  }
  await prisma.$disconnect();
});

function track(lineId: string | number | bigint) {
  createdLineIds.push(String(lineId));
}

describe("spec-011 budget module", () => {
  it("AC1: seeded JCA lines load exactly (7.0M / 0.5M / 0.3M + SWPS 3.6M / FF 1.44M per spec-025)", async () => {
    const { GET } = await import("@/app/api/v1/projects/[id]/budget-lines/route");
    const res = await GET(req("GET", `/api/v1/projects/${projectId}/budget-lines`, adminCookie), {
      params: Promise.resolve({ id: String(projectId) }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toHaveLength(5);
    const byTrade = Object.fromEntries(
      (body.items as { trade: string; amountFils: string; sourceLabel: string }[]).map((l) => [l.trade, l]),
    );
    expect(byTrade["ELECTRICAL"].amountFils).toBe("700000000");
    expect(byTrade["HVAC"].amountFils).toBe("50000000");
    expect(byTrade["PLUMBING"].amountFils).toBe("30000000");
    expect(byTrade["ELECTRICAL"].sourceLabel).toBe("JCA Appendix I");
    // spec-025-v1 additions (client review: both packages sit inside the JCA).
    expect(byTrade["OTHER"].sourceLabel).toContain("Storm Water Pumping Station");
    expect(byTrade["OTHER"].amountFils).toBe("360000000");
    expect(byTrade["FIRE_FIGHTING"].sourceLabel).toContain("Fire Fighting");
    expect(byTrade["FIRE_FIGHTING"].amountFils).toBe("144000000");
  });

  it("AC2: COMMERCIAL creates a line → 201 + audit CREATE; FINANCE attempt → 403", async () => {
    const { POST } = await import("@/app/api/v1/projects/[id]/budget-lines/route");
    const finRes = await POST(
      req("POST", `/api/v1/projects/${projectId}/budget-lines`, financeCookie, {
        trade: "HSE",
        amountFils: "1000.00",
        sourceLabel: "t018-fin",
      }),
      { params: Promise.resolve({ id: String(projectId) }) },
    );
    expect(finRes.status).toBe(403);

    const res = await POST(
      req("POST", `/api/v1/projects/${projectId}/budget-lines`, commercialCookie, {
        trade: "HSE",
        category: "LABOUR",
        amountFils: "1,500.25",
        sourceLabel: "t018-ac2",
      }),
      { params: Promise.resolve({ id: String(projectId) }) },
    );
    expect(res.status).toBe(201);
    const created = await res.json();
    track(created.id);
    expect(created.amountFils).toBe("150025");

    const auditRow = await prisma.auditLog.findFirst({
      where: { entity: "BudgetLine", entityId: String(created.id), action: "CREATE" },
    });
    expect(auditRow).not.toBeNull();
  });

  it("AC3: duplicate trade+category allowed but flagged BUDGET_DUPLICATE_LINE", async () => {
    const { POST } = await import("@/app/api/v1/projects/[id]/budget-lines/route");
    const res = await POST(
      req("POST", `/api/v1/projects/${projectId}/budget-lines`, commercialCookie, {
        trade: "ELECTRICAL",
        category: "MATERIALS",
        amountFils: "100.00",
        sourceLabel: "t018-dup",
      }),
      { params: Promise.resolve({ id: String(projectId) }) },
    );
    expect(res.status).toBe(201);
    const dup = await res.json();
    track(dup.id);

    const flag = await prisma.dataFlag.findFirst({
      where: { entityType: "BudgetLine", entityId: String(dup.id), ruleCode: "BUDGET_DUPLICATE_LINE" },
    });
    expect(flag).not.toBeNull();
    expect(flag?.status).toBe("OPEN");
    createdFlagIds.push(String(flag!.id));
  });

  it("AC4: PATCH audits only the changed key; hard DELETE + audit", async () => {
    const { POST } = await import("@/app/api/v1/projects/[id]/budget-lines/route");
    const { PATCH, DELETE } = await import("@/app/api/v1/budget-lines/[id]/route");

    const createdRes = await POST(
      req("POST", `/api/v1/projects/${projectId}/budget-lines`, adminCookie, {
        trade: "GENERAL",
        amountFils: "5000.00",
        sourceLabel: "t018-lifecycle",
        note: "keep me",
      }),
      { params: Promise.resolve({ id: String(projectId) }) },
    );
    expect(createdRes.status).toBe(201);
    const lineId = String((await createdRes.json()).id);
    track(lineId);

    const patched = await PATCH(req("PATCH", `/api/v1/budget-lines/${lineId}`, adminCookie, { amountFils: "6000.00" }), {
      params: Promise.resolve({ id: lineId }),
    });
    expect(patched.status).toBe(200);
    expect((await patched.json()).amountFils).toBe("600000");

    const updAudit = await prisma.auditLog.findFirstOrThrow({
      where: { entity: "BudgetLine", entityId: lineId, action: "UPDATE" },
      orderBy: { id: "desc" },
    });
    const beforeKeys = Object.keys(updAudit.before as object);
    const afterKeys = Object.keys(updAudit.after as object);
    expect(beforeKeys).toEqual(["amountFils"]);
    expect(afterKeys).toEqual(["amountFils"]);

    const finDel = await DELETE(req("DELETE", `/api/v1/budget-lines/${lineId}`, financeCookie), {
      params: Promise.resolve({ id: lineId }),
    });
    expect(finDel.status).toBe(403);

    const adminDel = await DELETE(req("DELETE", `/api/v1/budget-lines/${lineId}`, adminCookie), {
      params: Promise.resolve({ id: lineId }),
    });
    expect(adminDel.status).toBe(200);
    expect(await prisma.budgetLine.findUnique({ where: { id: BigInt(lineId) } })).toBeNull();
    const delAudit = await prisma.auditLog.findFirstOrThrow({
      where: { entity: "BudgetLine", entityId: lineId, action: "DELETE" },
    });
    expect(delAudit.before).not.toBeNull();
    createdLineIds.pop(); // already deleted server-side
  });

  it("AC5: variance golden values match Job 1571 incl. FIRE_FIGHTING coverage gap", async () => {
    const { GET } = await import("@/app/api/v1/projects/[id]/variance/route");
    const res = await GET(req("GET", `/api/v1/projects/${projectId}/variance`, adminCookie), {
      params: Promise.resolve({ id: String(projectId) }),
    });
    expect(res.status).toBe(200);
    const { items } = await res.json();
    const elect = items.find((r: { trade: string }) => r.trade === "ELECTRICAL");
    const hvac = items.find((r: { trade: string }) => r.trade === "HVAC");
    const plumbing = items.find((r: { trade: string }) => r.trade === "PLUMBING");
    const fire = items.find((r: { trade: string }) => r.trade === "FIRE_FIGHTING");
    expect(elect.status).toBe("under");
    expect(elect.utilizationPct).toBeGreaterThanOrEqual(84.9);
    expect(elect.utilizationPct).toBeLessThanOrEqual(85.1);
    expect(hvac.status).toBe("over");
    expect(hvac.utilizationPct).toBeGreaterThanOrEqual(123.3);
    expect(hvac.utilizationPct).toBeLessThanOrEqual(123.5);
    // PLUMBING still over (v1 committed semantics count SWPS LPOs in-trade;
    // spec-025 removed the analytics-side exclusion instead).
    expect(plumbing.status).toBe("over");
    expect(plumbing.utilizationPct).toBeGreaterThan(100);
    // spec-025-v1: FIRE_FIGHTING now carries a 1.44M JCA line (client review);
    // committed 1,583,925 / 1,440,000 → over ~110%.
    expect(fire.status).toBe("over");
    expect(BigInt(fire.budgetFils)).toBe(144000000n);
    expect(BigInt(fire.committedFils)).toBeGreaterThan(0n);
  });
});
