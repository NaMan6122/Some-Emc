import { execSync } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/server/db";
import { signSessionToken } from "@/server/auth/jwt";

// spec-021-v1 integration suite. Fixture suppliers stamped "IMP17 "; created
// LPO ids are tracked from commit responses and purged afterAll.
const STAMP = "IMP17";
let projectId = 0;
let adminCookie = "";
let procurementCookie = "";
let commercialCookie = "";
const createdLpoIds: string[] = [];

function req(method: string, path: string, cookie?: string, body?: string) {
  return new Request("http://localhost" + path, {
    method,
    headers: {
      ...(body !== undefined ? { "content-type": "text/csv" } : { "content-type": "application/json" }),
      ...(cookie ? { cookie } : {}),
    },
    ...(body !== undefined ? { body } : {}),
  });
}

async function cookieFor(email: string): Promise<string> {
  const user = await prisma.user.findUniqueOrThrow({ where: { email } });
  return "procare_session=" + (await signSessionToken({ uid: user.id, role: user.role, tv: user.tokenVersion }));
}

async function import_(cookie: string | undefined, dryRun: boolean, csv: string) {
  const { POST } = await import("@/app/api/v1/projects/[id]/lpos/import/route");
  return POST(req("POST", `/api/v1/projects/${projectId}/lpos/import?dry_run=${dryRun}`, cookie, csv), {
    params: Promise.resolve({ id: String(projectId) }),
  });
}

const HEADERS = "supplierName,trade,description,issueDate,amountAED";

beforeAll(async () => {
  execSync("npm run --silent seed:job1571", { stdio: "pipe", env: process.env });
  projectId = (await prisma.project.findUniqueOrThrow({ where: { code: "1571" } })).id;
  adminCookie = await cookieFor("admin@trends.local");
  procurementCookie = await cookieFor("purchase@trends.local");
  commercialCookie = await cookieFor("commercial@trends.local");
  await prisma.supplier.deleteMany({ where: { name: { startsWith: STAMP } } });
});

afterAll(async () => {
  if (createdLpoIds.length > 0) {
    await prisma.lpo.deleteMany({ where: { id: { in: createdLpoIds.map(BigInt) } } });
  }
  await prisma.supplier.deleteMany({ where: { name: { startsWith: STAMP } } });
  await prisma.$disconnect();
});

describe("spec-021 bulk LPO import", () => {
  it("AC1: valid 3-row dry-run reports all valid and writes NOTHING", async () => {
    await prisma.supplier.createMany({
      data: [
        { name: `${STAMP} ALPHA TRADING LLC`, aliases: [] },
        { name: `${STAMP} BETA WORKS LLC`, aliases: [] },
      ],
    });
    const lpoCountBefore = await prisma.lpo.count({ where: { projectId } });
    const auditBefore = await prisma.auditLog.count();

    const csv = [
      HEADERS,
      `${STAMP} ALPHA TRADING LLC,ELECTRICAL,Cable tray section A,2026-01-15,"12,500.00"`,
      `${STAMP} BETA WORKS LLC,HVAC,Duct insulation roll,2026-01-20,"3,200.50"`,
      `${STAMP} ALPHA TRADING LLC,OTHER,PPE consumables batch 1,2026-02-01,750`,
    ].join("\n");
    const res = await import_(procurementCookie, true, csv);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.rowsTotal).toBe(3);
    expect(body.valid).toBe(3);
    expect(body.invalid).toBe(0);
    expect(body.wouldCreate).toBe(3);
    expect(await prisma.lpo.count({ where: { projectId } })).toBe(lpoCountBefore);
    expect(await prisma.auditLog.count()).toBe(auditBefore);
  });

  it("AC2: mixed batch — exactly the bad rows reported with row numbers and fields", async () => {
    const csv = [
      HEADERS,
      `${STAMP} ALPHA TRADING LLC,ELECTRICAL,Good row,2026-03-01,"1,000.00"`,
      `${STAMP} ALPHA TRADING LLC,ELECTRICAL,Bad amount,2026-03-02,abc`,
      `IMP17 MISSING VENDOR LLC,PLUMBING,No such supplier,2026-03-03,"2,000.00"`,
    ].join("\n");
    const res = await import_(procurementCookie, true, csv);
    const body = await res.json();
    expect(body.rowsTotal).toBe(3);
    expect(body.valid).toBe(1);
    expect(body.invalid).toBe(2);
    const failures = body.failures as { row: number; field: string; message: string }[];
    const byRow = new Map(failures.map((f) => [f.row, f]));
    expect(byRow.get(2)?.field).toBe("amountAED");
    expect(byRow.get(3)?.field).toBe("supplierName");
  });

  it("AC3: commit of the mixed batch → 422 IMPORT_REJECTED and zero writes", async () => {
    const lpoCountBefore = await prisma.lpo.count({ where: { projectId } });
    const csv = [
      HEADERS,
      `${STAMP} ALPHA TRADING LLC,ELECTRICAL,Good row,2026-03-01,"1,000.00"`,
      `${STAMP} ALPHA TRADING LLC,ELECTRICAL,Bad amount,2026-03-02,abc`,
    ].join("\n");
    const res = await import_(procurementCookie, false, csv);
    expect(res.status).toBe(422);
    expect((await res.json()).error.code).toBe("IMPORT_REJECTED");
    expect(await prisma.lpo.count({ where: { projectId } })).toBe(lpoCountBefore);
  });

  it("AC4: full commit → ISSUED rows with generated refs, per-row audited CREATE with via tag", async () => {
    const csv = [
      HEADERS,
      `${STAMP} ALPHA TRADING LLC,ELECTRICAL,Cable tray section B,2026-04-10,"5,000.00"`,
      `${STAMP} BETA WORKS LLC,PLUMBING,Valve set,2026-04-11,"2,750.25"`,
    ].join("\n");
    const res = await import_(adminCookie, false, csv);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.count).toBe(2);

    for (const c of body.created as { id: string; refNo: string }[]) {
      createdLpoIds.push(c.id);
      const row = await prisma.lpo.findUniqueOrThrow({ where: { id: BigInt(c.id) } });
      expect(row.refNo).toBe(c.refNo);
      expect(row.status).toBe("ISSUED");
      expect(row.provenance).toBe("SOURCE_DOCUMENT");
      const auditRows = await prisma.auditLog.findMany({
        where: { entity: "Lpo", entityId: c.id, action: "CREATE" },
      });
      expect(auditRows).toHaveLength(1);
      expect((auditRows[0].after as Record<string, unknown>).via).toBe("bulk-import");
    }
    // Refs are monotonically increasing; gaps are EXPECTED where legacy
    // imports squat ref numbers (DCL-006).
    const n1 = Number((body.created[0].refNo as string).match(/(\d+)$/)![1]);
    const n2 = Number((body.created[1].refNo as string).match(/(\d+)$/)![1]);
    expect(n2).toBeGreaterThan(n1);
    for (const c of body.created as { refNo: string }[]) {
      const clash = await prisma.lpo.findFirst({ where: { projectId, refNo: c.refNo, id: { notIn: createdLpoIds.map(BigInt) } }, select: { id: true } });
      expect(clash).toBeNull();
    }
  });

  it("AC5: COMMERCIAL → 403; malformed CSV → 422; unknown/missing columns → 422", async () => {
    const denied = await import_(commercialCookie, true, `${HEADERS}\nX`);
    expect(denied.status).toBe(403);

    const malformed = await import_(procurementCookie, true, 'supplierName,trade\n"unclosed, 2026');
    expect(malformed.status).toBe(422);

    const unknownCol = await import_(procurementCookie, true, `${HEADERS},bogus\nA,ELECTRICAL,d,2026-01-01,1,x`);
    expect(unknownCol.status).toBe(422);
    expect(JSON.stringify(await unknownCol.json())).toContain("bogus");

    const missingCol = await import_(procurementCookie, true, "supplierName,trade\nA,ELECTRICAL");
    expect(missingCol.status).toBe(422);
  });
});
