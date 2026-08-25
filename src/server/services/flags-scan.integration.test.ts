import { execSync } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/server/db";
import { signSessionToken } from "@/server/auth/jwt";

// spec-017-v1 integration suite. Reserved ranges: supplier names and LPO
// refNos prefixed "SCAN17", budget-line sourceLabel "SCAN17 fixture". Both
// scan ruleCodes are brand new in this spec, so purging them by ruleCode is
// safe and keeps runs deterministic.
const STAMP = "SCAN17";
const RULES = ["NO_BUDGET_LINE", "DUPLICATE_SUPPLIER_SUSPECT"];
let projectId = 0;
let adminCookie = "";
let procurementCookie = "";
let viewerCookie = "";

function req(method: string, path: string, cookie?: string) {
  return new Request("http://localhost" + path, {
    method,
    headers: {
      "content-type": "application/json",
      ...(cookie ? { cookie } : {}),
    },
  });
}

async function cookieFor(email: string): Promise<string> {
  const user = await prisma.user.findUniqueOrThrow({ where: { email } });
  return "procare_session=" + (await signSessionToken({ uid: user.id, role: user.role, tv: user.tokenVersion }));
}

async function scan(cookie?: string) {
  const { POST } = await import("@/app/api/v1/projects/[id]/flags/scan/route");
  return POST(req("POST", `/api/v1/projects/${projectId}/flags/scan`, cookie), {
    params: Promise.resolve({ id: String(projectId) }),
  });
}

async function openFlags(ruleCode: string) {
  return prisma.dataFlag.findMany({ where: { ruleCode, status: "OPEN" }, orderBy: { id: "asc" } });
}

beforeAll(async () => {
  execSync("npm run --silent seed:job1571", { stdio: "pipe", env: process.env });
  projectId = (await prisma.project.findUniqueOrThrow({ where: { code: "1571" } })).id;
  adminCookie = await cookieFor("admin@trends.local");
  procurementCookie = await cookieFor("purchase@trends.local");
  viewerCookie = await cookieFor("viewer@trends.local");
  await prisma.dataFlag.deleteMany({ where: { ruleCode: { in: RULES } } });
  await prisma.lpo.deleteMany({ where: { projectId, refNo: { startsWith: STAMP } } });
  await prisma.budgetLine.deleteMany({ where: { projectId, sourceLabel: `${STAMP} fixture` } });
  await prisma.supplier.deleteMany({ where: { name: { startsWith: STAMP } } });
});

afterAll(async () => {
  await prisma.dataFlag.deleteMany({ where: { ruleCode: { in: RULES } } });
  await prisma.lpo.deleteMany({ where: { projectId, refNo: { startsWith: STAMP } } });
  await prisma.budgetLine.deleteMany({ where: { projectId, sourceLabel: `${STAMP} fixture` } });
  await prisma.supplier.deleteMany({ where: { name: { startsWith: STAMP } } });
  await prisma.$disconnect();
});

describe("spec-017 data-quality scan", () => {
  it("AC1: seeded Job 1571 — NO_BUDGET_LINE flags for GENERAL/HSE/OTHER; FIRE_FIGHTING now budgeted (spec-025)", async () => {
    // Ground truth from the existing, independently tested variance service.
    const { GET } = await import("@/app/api/v1/projects/[id]/variance/route");
    const varianceRes = await GET(req("GET", `/api/v1/projects/${projectId}/variance`, adminCookie), {
      params: Promise.resolve({ id: String(projectId) }),
    });
    const rows = (await varianceRes.json()).items as { trade: string; status: string }[];
    const qualifying = rows.filter((r) => r.status === "no_budget").map((r) => r.trade);

    const res = await scan(procurementCookie);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.checkedRules).toEqual(["NO_BUDGET_LINE", "DUPLICATE_SUPPLIER_SUSPECT"]);

    const flags = await openFlags("NO_BUDGET_LINE");
    expect(flags.map((f) => f.message.split(" ")[0]).sort()).toEqual([...qualifying].sort());
    // spec-025: FIRE_FIGHTING now carries a JCA line — it must NOT be flagged.
    expect(flags.some((f) => f.message.startsWith("FIRE_FIGHTING"))).toBe(false);
    // Total openings = budget-rule flags + supplier-pair flags (real data has
    // genuine near-duplicate masters; advisory per spec Risks).
    const suspects = await openFlags("DUPLICATE_SUPPLIER_SUSPECT");
    expect(body.opened).toBe(flags.length + suspects.length);
    expect(suspects.length).toBeGreaterThan(0);

    // spec-025: FIRE_FIGHTING holds a 1.44M JCA line — never flagged again.
    expect(flags.some((f) => f.message.startsWith("FIRE_FIGHTING"))).toBe(false);
    for (const budgeted of ["ELECTRICAL", "HVAC", "PLUMBING", "FIRE_FIGHTING"]) {
      expect(flags.some((f) => f.message.startsWith(budgeted))).toBe(false);
    }
    // GENERAL remains flagged (client figures still awaited) — spot its message.
    const general = flags.find((f) => f.message.startsWith("GENERAL"));
    expect(general?.severity).toBe("HIGH");
  });

  it("AC2: re-scan without changes is idempotent — opens 0, resolves 0", async () => {
    const before = await openFlags("NO_BUDGET_LINE");
    const res = await scan(adminCookie);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.opened).toBe(0);
    expect(body.resolved).toBe(0);
    const after = await openFlags("NO_BUDGET_LINE");
    expect(after.map((f) => f.id)).toEqual(before.map((f) => f.id));
  });

  it("AC3: adding the missing budget line flips the trade's flag to RESOLVED with the auto-note", async () => {
    // spec-025: FIRE_FIGHTING is now seeded with its own JCA line, so the
    // flip-to-resolved scenario uses GENERAL (still awaiting client figures).
    await prisma.budgetLine.create({
      data: {
        projectId,
        trade: "GENERAL",
        category: "MATERIALS",
        amountFils: 25000000n,
        sourceLabel: `${STAMP} fixture`,
      },
    });
    const res = await scan(procurementCookie);
    const body = await res.json();
    expect(body.opened).toBe(0);
    expect(body.resolved).toBe(1);

    const general = await prisma.dataFlag.findFirstOrThrow({
      where: { ruleCode: "NO_BUDGET_LINE", message: { startsWith: "GENERAL" } },
      orderBy: { id: "desc" },
    });
    expect(general.status).toBe("RESOLVED");
    expect(general.resolutionNote).toBe("Auto-resolved by scan");
    expect(general.resolvedAt).not.toBeNull();

    const stillOpen = await openFlags("NO_BUDGET_LINE");
    expect(stillOpen.some((f) => f.message.startsWith("HSE"))).toBe(true);
  });

  it("AC4: typo-pair fixture suppliers each holding an LPO open one suspect flag; merging clears it", async () => {
    const [a, b] = await Promise.all([
      prisma.supplier.create({ data: { name: `${STAMP} DEVELOPMWNT ENGINEERING LLC`, aliases: [] } }),
      prisma.supplier.create({ data: { name: `${STAMP} DEVELOPMENT ENGINEERING LLC`, aliases: [] } }),
    ]);
    for (const [i, s] of [a, b].entries()) {
      await prisma.lpo.create({
        data: {
          projectId,
          refNo: `${STAMP}-${100 + i}`,
          seq: 9000 + i,
          supplierId: s.id,
          trade: "ELECTRICAL",
          description: "scan fixture",
          issueDate: new Date("2026-01-10"),
          amountFils: 500000n,
          vatRate: 0.05,
          provenance: "SOURCE_DOCUMENT",
        },
      });
    }

    const first = await scan(adminCookie);
    const firstBody = await first.json();
    expect(firstBody.opened).toBeGreaterThanOrEqual(1);

    const key = `${[a.id, b.id].sort((x, y) => x - y)[0]}:${[a.id, b.id].sort((x, y) => x - y)[1]}`;
    const suspects = await prisma.dataFlag.findMany({
      where: { ruleCode: "DUPLICATE_SUPPLIER_SUSPECT", entityType: "Supplier", entityId: key, status: "OPEN" },
    });
    expect(suspects).toHaveLength(1);
    expect(suspects[0].message).toContain(`${STAMP} DEVELOPMWNT ENGINEERING LLC`);
    expect(suspects[0].message).toContain(`${STAMP} DEVELOPMENT ENGINEERING LLC`);
    expect(suspects[0].severity).toBe("LOW");

    // Merge one side into the other → condition clears globally.
    await prisma.supplier.update({ where: { id: b.id }, data: { mergedIntoId: a.id } });

    const second = await scan(adminCookie);
    const secondBody = await second.json();
    expect(secondBody.opened).toBe(0);
    expect(secondBody.resolved).toBeGreaterThanOrEqual(1);

    const resolvedPair = await prisma.dataFlag.findFirstOrThrow({
      where: { ruleCode: "DUPLICATE_SUPPLIER_SUSPECT", entityId: key },
      orderBy: { id: "desc" },
    });
    expect(resolvedPair.status).toBe("RESOLVED");
    expect(resolvedPair.resolutionNote).toBe("Auto-resolved by scan");
  });

  it("AC5: VIEWER and unauthenticated scans rejected", async () => {
    const denied = await scan(viewerCookie);
    expect(denied.status).toBe(403);

    const unauth = await scan(undefined);
    expect(unauth.status).toBe(401);
    expect((await unauth.json()).error.code).toBe("UNAUTHENTICATED");
  });
});
