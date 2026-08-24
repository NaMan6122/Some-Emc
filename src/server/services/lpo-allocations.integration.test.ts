import { execSync } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/server/db";
import { signSessionToken } from "@/server/auth/jwt";

// spec-022-v1 integration suite. Fixture LPO (ref ALLOC17-*) on project 1571,
// scratch target project code ALLOC17; everything purged afterAll.
let projectId = 0;
let targetProjectId = 0;
let fixtureLpoId = "";
let adminCookie = "";
let commercialCookie = "";
let viewerCookie = "";

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
  await prisma.project.deleteMany({ where: { code: "ALLOC17" } });
  targetProjectId = (
    await prisma.project.create({
      data: { code: "ALLOC17", name: "spec-022 target", mainContractor: "TEST", contractValueFils: 1000000n },
    })
  ).id;
  const supplier = await prisma.supplier.create({
    data: { name: "ALLOC17 SUPPLIER LLC", aliases: [] },
  });
  const max = await prisma.lpo.aggregate({ where: { projectId }, _max: { seq: true } });
  const lpo = await prisma.lpo.create({
    data: {
      projectId,
      refNo: "ALLOC17-001",
      seq: (max._max.seq ?? 0) + 9000,
      supplierId: supplier.id,
      trade: "ELECTRICAL",
      description: "allocation fixture",
      issueDate: new Date("2026-01-05"),
      amountFils: 400000n, // AED 4,000.00 → 50% = AED 2,000.00
      vatRate: 0.05,
      status: "ISSUED",
      provenance: "SOURCE_DOCUMENT",
    },
  });
  fixtureLpoId = String(lpo.id);
  adminCookie = await cookieFor("admin@trends.local");
  commercialCookie = await cookieFor("commercial@trends.local");
  viewerCookie = await cookieFor("viewer@trends.local");
});

afterAll(async () => {
  await prisma.lpoAllocation.deleteMany({ where: { lpoId: BigInt(fixtureLpoId || 0) } });
  await prisma.auditLog.deleteMany({
    where: { entity: "LpoAllocation", entityId: { in: (await prisma.lpoAllocation.findMany({ where: { lpoId: BigInt(fixtureLpoId || 0) } })).map((a) => String(a.id)) } },
  }).catch(() => undefined);
  await prisma.lpo.deleteMany({ where: { refNo: "ALLOC17-001" } });
  await prisma.supplier.deleteMany({ where: { name: "ALLOC17 SUPPLIER LLC" } });
  await prisma.project.deleteMany({ where: { code: "ALLOC17" } });
  await prisma.$disconnect();
});

describe("spec-022 cross-project allocations", () => {
  it("AC2: COMMERCIAL posts 50% → 201 + audit; source overview allocatedOutFils rises by half the amount", async () => {
    const { overview } = await import("./analytics");
    const before = await overview(projectId);

    const { POST } = await import("@/app/api/v1/lpos/[id]/allocation/route");
    const res = await POST(
      req("POST", `/api/v1/lpos/${fixtureLpoId}/allocation`, commercialCookie, {
        targetProjectId,
        pct: 50,
        note: "storm package share",
      }),
      { params: Promise.resolve({ id: fixtureLpoId }) },
    );
    expect(res.status).toBe(201);
    const created = await res.json();
    expect(created.pct).toBe(50);

    const auditRow = await prisma.auditLog.findFirstOrThrow({
      where: { entity: "LpoAllocation", entityId: String(created.id), action: "CREATE" },
    });
    expect(auditRow.after).toMatchObject({ pct: 50 });

    const after = await overview(projectId);
    expect(after.allocatedOutFils - before.allocatedOutFils).toBe(200000n); // 50% × 400000

    const targetBefore = before.allocatedInFils;
    const targetOverview = await overview(targetProjectId);
    expect(targetOverview.allocatedInFils - targetBefore).toBe(200000n); // AC3 identical fils
  });

  it("AC4: exceeding 100% → 422; duplicate pair → 409", async () => {
    const { POST } = await import("@/app/api/v1/lpos/[id]/allocation/route");

    // Second target at 60% → total would be 110.
    const p2 = await prisma.project.create({
      data: { code: "ALLOC17B", name: "spec-022 target B", mainContractor: "TEST", contractValueFils: 1000000n },
    });
    try {
      const over = await POST(
        req("POST", `/api/v1/lpos/${fixtureLpoId}/allocation`, adminCookie, { targetProjectId: p2.id, pct: 60 }),
        { params: Promise.resolve({ id: fixtureLpoId }) },
      );
      expect(over.status).toBe(422);
      expect((await over.json()).error.code).toBe("ALLOCATION_EXCEEDS_100");

      const dup = await POST(
        req("POST", `/api/v1/lpos/${fixtureLpoId}/allocation`, adminCookie, { targetProjectId, pct: 10 }),
        { params: Promise.resolve({ id: fixtureLpoId }) },
      );
      expect(dup.status).toBe(409);
      expect((await dup.json()).error.code).toBe("ALLOCATION_EXISTS");
    } finally {
      await prisma.project.delete({ where: { id: p2.id } });
    }
  });

  it("AC5: VIEWER POST/DELETE 403; COMMERCIAL DELETE → 200 + audit; figures revert", async () => {
    const { POST } = await import("@/app/api/v1/lpos/[id]/allocation/route");
    const { DELETE } = await import("@/app/api/v1/allocations/[id]/route");

    const deniedPost = await POST(
      req("POST", `/api/v1/lpos/${fixtureLpoId}/allocation`, viewerCookie, { targetProjectId, pct: 5 }),
      { params: Promise.resolve({ id: fixtureLpoId }) },
    );
    expect(deniedPost.status).toBe(403);

    const listRes = await import("@/app/api/v1/lpos/[id]/allocation/route").then(({ GET }) =>
      GET(req("GET", `/api/v1/lpos/${fixtureLpoId}/allocation`, viewerCookie), {
        params: Promise.resolve({ id: fixtureLpoId }),
      }),
    );
    const allocId = ((await listRes.json()).items as { id: string }[])[0].id;

    const deniedDelete = await DELETE(req("DELETE", `/api/v1/allocations/${allocId}`, viewerCookie), {
      params: Promise.resolve({ id: allocId }),
    });
    expect(deniedDelete.status).toBe(403);

    const ok = await DELETE(req("DELETE", `/api/v1/allocations/${allocId}`, commercialCookie), {
      params: Promise.resolve({ id: allocId }),
    });
    expect(ok.status).toBe(200);
    const auditRow = await prisma.auditLog.findFirstOrThrow({
      where: { entity: "LpoAllocation", entityId: allocId, action: "DELETE" },
    });
    expect(auditRow.before).toMatchObject({ pct: 50 });

    const { overview } = await import("./analytics");
    const end = await overview(projectId);
    expect(end.allocatedOutFils).toBe(0n);
  });
});
