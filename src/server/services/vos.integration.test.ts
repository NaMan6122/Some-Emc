import { execSync } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/server/db";
import { signSessionToken } from "@/server/auth/jwt";

let projectId = 0;
let adminCookie = "";
let commercialCookie = "";
let financeCookie = "";
let viewerCookie = "";
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
  projectId = (await prisma.project.findUniqueOrThrow({ where: { code: "1571" } })).id;
  adminCookie = await cookieFor("admin@trends.local");
  commercialCookie = await cookieFor("commercial@trends.local");
  financeCookie = await cookieFor("finance@trends.local");
  viewerCookie = await cookieFor("viewer@trends.local");
  // This suite owns voNumbers ≥ 900 and pcNumber 80–89 on project 1571
  // (real data: zero VOs, PCs stop at 14). Purge leftovers from aborted runs.
  await prisma.variationOrder.deleteMany({ where: { projectId, voNumber: { gte: 900 } } });
  await prisma.paymentCertificate.deleteMany({ where: { projectId, pcNumber: { gte: 80, lte: 89 } } });
});

afterAll(async () => {
  await prisma.variationOrder.deleteMany({ where: { projectId, voNumber: { gte: 900 } } });
  await prisma.paymentCertificate.deleteMany({ where: { projectId, pcNumber: { gte: 80, lte: 89 } } });
  if (createdFlagIds.length > 0) {
    await prisma.dataFlag.deleteMany({ where: { id: { in: createdFlagIds.map(BigInt) } } });
  }
  await prisma.$disconnect();
});

describe("spec-013 variation orders", () => {
  it("AC4a: compliance baseline — no VOs means zero exposure despite claims capacity", async () => {
    const { GET } = await import("@/app/api/v1/projects/[id]/vos/compliance/route");
    const res = await GET(req("GET", `/api/v1/projects/${projectId}/vos/compliance`, viewerCookie), {
      params: Promise.resolve({ id: String(projectId) }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items ?? body.unapprovedVoExposure).toBeDefined();
    expect(body.unapprovedVoExposure).toBe("0");
    expect(body.openVos).toBe(0);
  });

  it("AC1: COMMERCIAL raises a SUBMITTED VO → 201 + audit CREATE", async () => {
    // Fixture stands in for the spec's "VO #1 Storm water reroute" example;
    // numbering uses this suite's reserved range (≥900).
    const { POST } = await import("@/app/api/v1/projects/[id]/vos/route");
    const res = await POST(
      req("POST", `/api/v1/projects/${projectId}/vos`, commercialCookie, {
        voNumber: 901,
        title: "Storm water reroute",
        submittedValueFils: "500,000.00",
        status: "SUBMITTED",
      }),
      { params: Promise.resolve({ id: String(projectId) }) },
    );
    expect(res.status).toBe(201);
    const created = await res.json();
    expect(created.submittedValueFils).toBe("50000000");
    expect(created.status).toBe("SUBMITTED");

    const auditRow = await prisma.auditLog.findFirst({
      where: { entity: "VariationOrder", entityId: String(created.id), action: "CREATE" },
    });
    expect(auditRow).not.toBeNull();
  });

  it("AC2: approval without value/date → 422; with both → APPROVED + audit ref", async () => {
    const { PATCH } = await import("@/app/api/v1/vos/[id]/route");
    const listRes = await import("@/app/api/v1/projects/[id]/vos/route").then(({ GET }) =>
      GET(req("GET", `/api/v1/projects/${projectId}/vos`, viewerCookie), {
        params: Promise.resolve({ id: String(projectId) }),
      }),
    );
    const voId = String(((await listRes.json()).items as { voNumber: number; id: string }[]).find((v) => v.voNumber === 901)!.id);

    const incomplete = await PATCH(req("PATCH", `/api/v1/vos/${voId}`, adminCookie, { status: "APPROVED" }), {
      params: Promise.resolve({ id: voId }),
    });
    expect(incomplete.status).toBe(422);
    expect((await incomplete.json()).error.code).toBe("MISSING_APPROVAL");

    const ok = await PATCH(
      req("PATCH", `/api/v1/vos/${voId}`, commercialCookie, {
        status: "APPROVED",
        approvedValueFils: "495,000.00",
        approvedAt: new Date("2026-08-24T10:00:00.000Z").toISOString(),
        approvalRef: "JCA-VO-901-R1",
      }),
      { params: Promise.resolve({ id: voId }) },
    );
    expect(ok.status).toBe(200);
    const approved = await ok.json();
    expect(approved.status).toBe("APPROVED");
    expect(approved.approvedValueFils).toBe("49500000");

    const auditRow = await prisma.auditLog.findFirstOrThrow({
      where: { entity: "VariationOrder", entityId: voId, action: "UPDATE" },
      orderBy: { id: "desc" },
    });
    expect(auditRow.after).toMatchObject({ approvalRef: "JCA-VO-901-R1", status: "APPROVED" });
  });

  it("AC4b: exposure rises with a SUBMITTED VO over claimed variations, falls to 0 on approval", async () => {
    // Claim fixture: a certificate carrying variationClaimFils (FINANCE-owned domain).
    const pcsRoutes = await import("@/app/api/v1/projects/[id]/pcs/route");
    const pcRes = await pcsRoutes.POST(
      req("POST", `/api/v1/projects/${projectId}/pcs`, financeCookie, {
        pcNumber: 81,
        periodLabel: "T020 compliance probe",
        grossFils: "100,000.00",
        netPayableFils: "100,000.00",
        variationClaimFils: "10,000.00",
        status: "CERTIFIED",
      }),
      { params: Promise.resolve({ id: String(projectId) }) },
    );
    expect(pcRes.status).toBe(201);

    const complianceRoutes = await import("@/app/api/v1/projects/[id]/vos/compliance/route");

    // Raising a second non-approved VO exposes the full aggregate claim.
    const vosRoutes = await import("@/app/api/v1/projects/[id]/vos/route");
    const raised = await vosRoutes.POST(
      req("POST", `/api/v1/projects/${projectId}/vos`, commercialCookie, {
        voNumber: 902,
        title: "Additional lighting",
        submittedValueFils: "25,000.00",
        status: "SUBMITTED",
      }),
      { params: Promise.resolve({ id: String(projectId) }) },
    );
    expect(raised.status).toBe(201);

    const midRes = await complianceRoutes.GET(req("GET", `/api/v1/projects/${projectId}/vos/compliance`, adminCookie), {
      params: Promise.resolve({ id: String(projectId) }),
    });
    const mid = await midRes.json();
    // Aggregate claim = seeded PC07+PC13 (AED 84,001.00) + probe PC81 (AED 10,000.00).
    expect(mid.totalClaims).toBe("9400100");
    expect(mid.unapprovedVoExposure).toBe("9400100");
    expect(mid.openVos).toBe(1); // VO902; VO901 already approved

    const exposedFlag = await prisma.dataFlag.findFirstOrThrow({
      where: { entityType: "Project", entityId: String(projectId), ruleCode: "UNAPPROVED_VO_CLAIM", status: "OPEN" },
      orderBy: { id: "desc" },
    });
    createdFlagIds.push(String(exposedFlag.id));
    expect(exposedFlag.message).toContain("94,001.00");

    // Approving the last outstanding VO clears the exposure and resolves the flag.
    const voId = String(((await (await vosRoutes.GET(req("GET", `/api/v1/projects/${projectId}/vos`, viewerCookie), { params: Promise.resolve({ id: String(projectId) }) })).json()).items as { voNumber: number; id: string }[]).find((v) => v.voNumber === 902)!.id);
    const { PATCH } = await import("@/app/api/v1/vos/[id]/route");
    const approved = await PATCH(
      req("PATCH", `/api/v1/vos/${voId}`, commercialCookie, {
        status: "APPROVED",
        approvedValueFils: "25000.00",
        approvedAt: new Date().toISOString(),
      }),
      { params: Promise.resolve({ id: voId }) },
    );
    expect(approved.status).toBe(200);

    const endRes = await complianceRoutes.GET(req("GET", `/api/v1/projects/${projectId}/vos/compliance`, adminCookie), {
      params: Promise.resolve({ id: String(projectId) }),
    });
    const end = await endRes.json();
    expect(end.unapprovedVoExposure).toBe("0");

    const resolvedFlag = await prisma.dataFlag.findFirstOrThrow({
      where: { entityType: "Project", entityId: String(projectId), ruleCode: "UNAPPROVED_VO_CLAIM" },
      orderBy: { id: "desc" },
    });
    expect(resolvedFlag.status).toBe("RESOLVED");
    expect(resolvedFlag.resolvedAt).not.toBeNull();
  });

  it("AC3: VO_BACKFILL stays OPEN — resolution is human backfill, not automation", async () => {
    const flag = await prisma.dataFlag.findFirstOrThrow({
      where: { entityType: "Project", entityId: String(projectId), ruleCode: "VO_BACKFILL" },
      orderBy: { id: "asc" },
    });
    expect(flag.status).toBe("OPEN");
  });

  it("AC5: VIEWER patch → 403; invalid transitions rejected", async () => {
    const { PATCH } = await import("@/app/api/v1/vos/[id]/route");
    const vosRoutes = await import("@/app/api/v1/projects/[id]/vos/route");
    const items = (await (
      await vosRoutes.GET(req("GET", `/api/v1/projects/${projectId}/vos`, viewerCookie), {
        params: Promise.resolve({ id: String(projectId) }),
      })
    ).json()).items as { voNumber: number; id: string; status: string }[];
    const approved = items.find((v) => v.voNumber === 901)!;

    const denied = await PATCH(req("PATCH", `/api/v1/vos/${approved.id}`, viewerCookie, { title: "hijack" }), {
      params: Promise.resolve({ id: approved.id }),
    });
    expect(denied.status).toBe(403);

    const terminal = await PATCH(req("PATCH", `/api/v1/vos/${approved.id}`, adminCookie, { status: "SUBMITTED" }), {
      params: Promise.resolve({ id: approved.id }),
    });
    expect(terminal.status).toBe(422);
    expect((await terminal.json()).error.code).toBe("INVALID_TRANSITION");
  });
});
