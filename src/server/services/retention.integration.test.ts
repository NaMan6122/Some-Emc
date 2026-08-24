import { execSync } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/server/db";
import { signSessionToken } from "@/server/auth/jwt";

// spec-019-v1 integration suite. Creates one real release against seeded
// PC13 and purges it afterAll so the dev DB and analytics anchors return
// to their pre-suite state.
let projectId = 0;
let pc13Id = "";
let adminCookie = "";
let financeCookie = "";
let commercialCookie = "";
let viewerCookie = "";
const createdIds: string[] = [];

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
  const pc13 = await prisma.paymentCertificate.findUniqueOrThrow({
    where: { projectId_pcNumber: { projectId, pcNumber: 13 } },
    select: { id: true },
  });
  pc13Id = String(pc13.id);
  adminCookie = await cookieFor("admin@trends.local");
  financeCookie = await cookieFor("finance@trends.local");
  commercialCookie = await cookieFor("commercial@trends.local");
  viewerCookie = await cookieFor("viewer@trends.local");
});

afterAll(async () => {
  if (createdIds.length > 0) {
    await prisma.retentionRelease.deleteMany({ where: { id: { in: createdIds.map(BigInt) } } });
  }
  await prisma.$disconnect();
});

describe("spec-019 retention ledger", () => {
  it("AC2: FINANCE posts a release against PC13 → 201 + audit; listed newest-first", async () => {
    const { POST } = await import("@/app/api/v1/projects/[id]/retention-releases/route");
    const res = await POST(
      req("POST", `/api/v1/projects/${projectId}/retention-releases`, financeCookie, {
        pcId: Number(pc13Id),
        amountFils: "50,000.00",
        releasedAt: new Date("2026-08-20T10:00:00.000Z").toISOString(),
        reference: "CHEC remittance Aug-26",
      }),
      { params: Promise.resolve({ id: String(projectId) }) },
    );
    expect(res.status).toBe(201);
    const created = await res.json();
    expect(created.amountFils).toBe("5000000");
    expect(created.pcId).toBe(pc13Id);
    createdIds.push(String(created.id));

    const auditRow = await prisma.auditLog.findFirstOrThrow({
      where: { entity: "RetentionRelease", entityId: String(created.id), action: "CREATE" },
    });
    expect(auditRow.after).toMatchObject({ amountFils: "5000000" });

    const { GET } = await import("@/app/api/v1/projects/[id]/retention-releases/route");
    const listRes = await GET(req("GET", `/api/v1/projects/${projectId}/retention-releases`, viewerCookie), {
      params: Promise.resolve({ id: String(projectId) }),
    });
    const items = (await listRes.json()).items as { id: string; amountFils: string }[];
    expect(items[0].id).toBe(String(created.id));
  });

  it("AC3: cashflow anchors byte-identical; additive held/released fields correct", async () => {
    const { cashflow } = await import("./analytics");
    const cf = await cashflow(projectId);
    expect(cf.retentionTotalFils).toBe(48909700n);
    expect(cf.retentionReleasedFils).toBe(5000000n);
    expect(cf.retentionHeldFils).toBe(43909700n);
  });

  it("AC4: COMMERCIAL/VIEWER POST → 403; FINANCE DELETE → 403; ADMIN DELETE audited", async () => {
    const { POST } = await import("@/app/api/v1/projects/[id]/retention-releases/route");
    for (const cookie of [commercialCookie, viewerCookie]) {
      const denied = await POST(
        req("POST", `/api/v1/projects/${projectId}/retention-releases`, cookie, {
          amountFils: "1.00",
          releasedAt: new Date().toISOString(),
        }),
        { params: Promise.resolve({ id: String(projectId) }) },
      );
      expect(denied.status).toBe(403);
    }

    const id = createdIds[0];
    const { DELETE } = await import("@/app/api/v1/retention-releases/[id]/route");

    const finDenied = await DELETE(req("DELETE", `/api/v1/retention-releases/${id}`, financeCookie), {
      params: Promise.resolve({ id }),
    });
    expect(finDenied.status).toBe(403);

    const ok = await DELETE(req("DELETE", `/api/v1/retention-releases/${id}`, adminCookie), {
      params: Promise.resolve({ id }),
    });
    expect(ok.status).toBe(200);
    const auditRow = await prisma.auditLog.findFirstOrThrow({
      where: { entity: "RetentionRelease", entityId: id, action: "DELETE" },
    });
    expect(auditRow.before).toMatchObject({ amountFils: "5000000" });

    const cf = await import("./analytics").then(({ cashflow }) => cashflow(projectId));
    expect(cf.retentionReleasedFils).toBe(0n);
    expect(cf.retentionHeldFils).toBe(48909700n);
  });

  it("AC5: zero/negative/malformed amounts → 422", async () => {
    const { POST } = await import("@/app/api/v1/projects/[id]/retention-releases/route");
    for (const bad of ["0.00", "-100.00", "abc"]) {
      const res = await POST(
        req("POST", `/api/v1/projects/${projectId}/retention-releases`, financeCookie, {
          amountFils: bad,
          releasedAt: new Date().toISOString(),
        }),
        { params: Promise.resolve({ id: String(projectId) }) },
      );
      expect(res.status).toBe(422);
    }
  });
});
