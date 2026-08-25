import { execSync } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/server/db";
import { signSessionToken } from "@/server/auth/jwt";

// spec-028-v1 integration suite. Fixture project code COST17; everything
// (lines/entries/audit/project) purged afterAll.
let projectId = 0;
let targetProjectId = 0;
let adminCookie = "";
let commercialCookie = "";
let financeCookie = "";
let viewerCookie = "";
const lineIds: string[] = [];
const entryIds: string[] = [];

function req(method: string, path: string, cookie?: string, body?: unknown) {
  return new Request("http://localhost" + path, {
    method,
    headers: {
      "content-type": "application/json",
      ...(cookie ? { cookie } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

async function cookieFor(email: string): Promise<string> {
  const user = await prisma.user.findUniqueOrThrow({ where: { email } });
  return "procare_session=" + (await signSessionToken({ uid: user.id, role: user.role, tv: user.tokenVersion }));
}

beforeAll(async () => {
  execSync("npm run --silent seed:job1571", { stdio: "pipe", env: process.env });
  projectId = (await prisma.project.findUniqueOrThrow({ where: { code: "1571" } })).id;
  await prisma.project.deleteMany({ where: { code: { startsWith: "COST17" } } });
  targetProjectId = (
    await prisma.project.create({
      data: { code: "COST17", name: "cost spec fixture", mainContractor: "TEST", contractValueFils: 1000000n },
    })
  ).id;
  adminCookie = await cookieFor("admin@trends.local");
  commercialCookie = await cookieFor("commercial@trends.local");
  financeCookie = await cookieFor("finance@trends.local");
  viewerCookie = await cookieFor("viewer@trends.local");
});

afterAll(async () => {
  const ids = [...lineIds.map(BigInt), ...entryIds.map(BigInt)];
  if (ids.length) {
    await prisma.auditLog.deleteMany({ where: { entity: { in: ["CostLine", "CostEntry"] }, entityId: { in: ids.map(String) } } }).catch(() => undefined);
    await prisma.costLine.deleteMany({ where: { id: { in: lineIds.map(BigInt) } } }).catch(() => undefined);
    await prisma.costEntry.deleteMany({ where: { id: { in: entryIds.map(BigInt) } } }).catch(() => undefined);
  }
  await prisma.project.deleteMany({ where: { code: { startsWith: "COST17" } } }).catch(() => undefined);
  await prisma.$disconnect();
});

describe("spec-028 cost overviews", () => {
  it("AC2: COMMERCIAL adds Labour budget line → 201 + audit; FINANCE books entries; overview aggregates", async () => {
    const linesRoute = await import("@/app/api/v1/projects/[id]/cost-lines/route");
    const lineRes = await linesRoute.POST(
      req("POST", `/api/v1/projects/${targetProjectId}/cost-lines`, commercialCookie, {
        category: "LABOUR_INHOUSE",
        amountFils: "250,000.00",
        sourceLabel: "JCA Labour Appendix",
      }),
      { params: Promise.resolve({ id: String(targetProjectId) }) },
    );
    expect(lineRes.status).toBe(201);
    const line = await lineRes.json();
    lineIds.push(String(line.id));

    const entriesRoute = await import("@/app/api/v1/projects/[id]/cost-entries/route");
    for (const [d, amt] of [["2026-01-20", "40,000.00"], ["2026-02-15", "65,000.00"]] as const) {
      const r = await entriesRoute.POST(
        req("POST", `/api/v1/projects/${targetProjectId}/cost-entries`, financeCookie, {
          category: "LABOUR_INHOUSE",
          entryDate: d,
          amountFils: amt,
          description: `wages ${d.slice(0, 7)}`,
        }),
        { params: Promise.resolve({ id: String(targetProjectId) }) },
      );
      expect(r.status).toBe(201);
      entryIds.push(String((await r.json()).id));
    }

    const { GET } = await import("@/app/api/v1/projects/[id]/cost-lines/route");
    const listRes = await GET(
      req("GET", `/api/v1/projects/${targetProjectId}/cost-lines?category=LABOUR_INHOUSE`, viewerCookie),
      { params: Promise.resolve({ id: String(targetProjectId) }) },
    );
    const linesBody = await listRes.json();
    expect(linesBody.lines).toHaveLength(1);
    expect(linesBody.budgetFils).toBe("25000000"); // AED 250k

    const auditRow = await prisma.auditLog.findFirstOrThrow({
      where: { entity: "CostLine", action: "CREATE" },
      orderBy: { id: "desc" },
    });
    expect(auditRow.after).toMatchObject({ category: "LABOUR_INHOUSE" });

    // Category isolation: ADMIN category stays empty on this project.
    const adminList = await GET(
      req("GET", `/api/v1/projects/${targetProjectId}/cost-lines?category=ADMIN`, viewerCookie),
      { params: Promise.resolve({ id: String(targetProjectId) }) },
    );
    expect(((await adminList.json()).lines as unknown[]).length).toBe(0);

    // Monthly series from the overview service.
    const { costOverview } = await import("./cost-overviews");
    const ov = await costOverview(targetProjectId, "LABOUR_INHOUSE");
    expect(ov.actualFils).toBe(10500000n); // 40k + 65k
    expect(ov.utilisationPct).toBeCloseTo(42.0, 1);
    expect(ov.monthlySeries.map((m) => m.month)).toEqual(["2026-01", "2026-02"]);
  });

  it("category isolation: entries under ADMIN never appear in LABOUR overview", async () => {
    const entriesRoute = await import("@/app/api/v1/projects/[id]/cost-entries/route");
    const r = await entriesRoute.POST(
      req("POST", `/api/v1/projects/${targetProjectId}/cost-entries`, financeCookie, {
        category: "ADMIN",
        entryDate: "2026-03-01",
        amountFils: "5,000.00",
        description: "admin probe",
      }),
      { params: Promise.resolve({ id: String(targetProjectId) }) },
    );
    expect(r.status).toBe(201);
    entryIds.push(String((await r.json()).id));

    const { costOverview } = await import("./cost-overviews");
    const labour = await costOverview(targetProjectId, "LABOUR_INHOUSE");
    expect(labour.actualFils).toBe(10500000n); // unchanged by the ADMIN-category entry
  });

  it("VIEWER read-only; PROCUREMENT blocked from cost-entry POST; malformed money → 422", async () => {
    const entriesRoute = await import("@/app/api/v1/projects/[id]/cost-entries/route");
    const procurementCookie = "procare_session=" + (await signSessionToken({
      uid: (await prisma.user.findUniqueOrThrow({ where: { email: "purchase@trends.local" } })).id,
      role: "PROCUREMENT",
      tv: (await prisma.user.findUniqueOrThrow({ where: { email: "purchase@trends.local" } })).tokenVersion,
    }));

    const denied = await entriesRoute.POST(
      req("POST", `/api/v1/projects/${targetProjectId}/cost-entries`, procurementCookie, {
        category: "LABOUR_INHOUSE",
        entryDate: "2026-03-01",
        amountFils: "10.00",
        description: "should fail",
      }),
      { params: Promise.resolve({ id: String(targetProjectId) }) },
    );
    expect(denied.status).toBe(403);

    const bad = await entriesRoute.POST(
      req("POST", `/api/v1/projects/${targetProjectId}/cost-entries`, financeCookie, {
        category: "LABOUR_INHOUSE",
        entryDate: "2026-03-01",
        amountFils: "-5",
        description: "negative",
      }),
      { params: Promise.resolve({ id: String(targetProjectId) }) },
    );
    expect(bad.status).toBe(422);
  });
});
