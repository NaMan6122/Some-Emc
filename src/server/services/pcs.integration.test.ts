import { execSync } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/server/db";
import { signSessionToken } from "@/server/auth/jwt";

let projectId = 0;
let adminCookie = "";
let financeCookie = "";
let viewerCookie = "";
const createdPcIds: string[] = [];
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
  financeCookie = await cookieFor("finance@trends.local");
  viewerCookie = await cookieFor("viewer@trends.local");
  // This suite owns pcNumbers ≥ 90 on project 1571 (real data stops at 14).
  // Purge leftovers from aborted prior runs so numbering never collides.
  await prisma.dataFlag.deleteMany({
    where: { entityType: "PaymentCertificate", entityId: { in: (await staleIds()).map(String) } },
  });
  await prisma.paymentCertificate.deleteMany({ where: { projectId, pcNumber: { gte: 90 } } });
});

async function staleIds(): Promise<bigint[]> {
  return (await prisma.paymentCertificate.findMany({ where: { projectId, pcNumber: { gte: 90 } }, select: { id: true } })).map(
    (r) => r.id,
  );
}

afterAll(async () => {
  if (createdPcIds.length > 0) {
    await prisma.paymentCertificate.deleteMany({ where: { id: { in: createdPcIds.map(BigInt) } } });
  }
  if (createdFlagIds.length > 0) {
    await prisma.dataFlag.deleteMany({ where: { id: { in: createdFlagIds.map(BigInt) } } });
  }
  await prisma.$disconnect();
});

async function createPc(cookie: string, body: Record<string, unknown>) {
  const { POST } = await import("@/app/api/v1/projects/[id]/pcs/route");
  return POST(req("POST", `/api/v1/projects/${projectId}/pcs`, cookie, body), {
    params: Promise.resolve({ id: String(projectId) }),
  });
}

describe("spec-012 payment certificates", () => {
  it("AC1: seeded PCs load with exact fils figures, provenance, Σ net payable", async () => {
    const { GET } = await import("@/app/api/v1/projects/[id]/pcs/route");
    const res = await GET(req("GET", `/api/v1/projects/${projectId}/pcs`, viewerCookie), {
      params: Promise.resolve({ id: String(projectId) }),
    });
    expect(res.status).toBe(200);
    const { items } = await res.json();
    expect(items).toHaveLength(14);

    const byNumber = Object.fromEntries(
      (items as { pcNumber: number; netPayableFils: string; provenance: string; retentionFils: string; grossFils: string }[]).map(
        (p) => [p.pcNumber, p],
      ),
    );
    // Spot figures to the fils (extractor fixtures).
    expect(byNumber[1].netPayableFils).toBe("115248900");
    expect(byNumber[1].provenance).toBe("SOURCE_DOCUMENT");
    expect(byNumber[3].provenance).toBe("CLIENT_SUMMARY");
    expect(byNumber[3].retentionFils).toBe("0");
    expect(byNumber[13].grossFils).toBe("172522700");

    const sumNet = items.reduce((s: bigint, p: { netPayableFils: string }) => s + BigInt(p.netPayableFils), 0n);
    // Row-sum of the extracted dataset = AED 10,331,978.00 — matches the
    // reports' stated "~10.33M certified" (see DCL-004).
    expect(sumNet).toBe(1033197800n);
  });

  it("AC2: FINANCE creates a valid PC → 201 + audit; VIEWER → 403", async () => {
    const ok = await createPc(financeCookie, {
      pcNumber: 90,
      periodLabel: "T019 test period",
      grossFils: "100,000.00",
      retentionFils: "5,000.00",
      netPayableFils: "95000.00",
    });
    expect(ok.status).toBe(201);
    const created = await ok.json();
    createdPcIds.push(String(created.id));
    expect(created.netPayableFils).toBe("9500000");
    expect(created.status).toBe("DRAFT");
    expect(created.provenance).toBe("SOURCE_DOCUMENT");

    const auditRow = await prisma.auditLog.findFirst({
      where: { entity: "PaymentCertificate", entityId: String(created.id), action: "CREATE" },
    });
    expect(auditRow).not.toBeNull();

    const denied = await createPc(viewerCookie, {
      pcNumber: 91,
      periodLabel: "nope",
      grossFils: "100.00",
      netPayableFils: "100.00",
    });
    expect(denied.status).toBe(403);
  });

  it("AC3: retention ≠ gross − net → 422 ARITHMETIC_MISMATCH with field detail", async () => {
    const res = await createPc(adminCookie, {
      pcNumber: 92,
      periodLabel: "bad math",
      grossFils: "1000.00",
      retentionFils: "300.00",
      netPayableFils: "999.00",
    });
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error.code).toBe("ARITHMETIC_MISMATCH");
    expect(JSON.stringify(body.error.details)).toContain("70000"); // expected 700.00 in fils
  });

  it("AC4: creating PC16 over a missing PC15 → 201 but PC_GAP flag names 15", async () => {
    const res = await createPc(adminCookie, {
      pcNumber: 16,
      periodLabel: "gap probe",
      grossFils: "500.00",
      netPayableFils: "500.00",
    });
    expect(res.status).toBe(201);
    const created = await res.json();
    createdPcIds.push(String(created.id));

    const flag = await prisma.dataFlag.findFirst({
      where: { entityType: "PaymentCertificate", entityId: String(created.id), ruleCode: "PC_GAP", status: "OPEN" },
    });
    expect(flag).not.toBeNull();
    createdFlagIds.push(String(flag!.id));
    expect(flag!.message).toContain("15");
  });

  it("AC5a: statedCumulativeFils off by any amount → CUMULATIVE_MISMATCH naming both values", async () => {
    // Certified cumulative through PC14 is Σ net = 1,033,197,800 fils.
    const res = await createPc(financeCookie, {
      pcNumber: 17,
      periodLabel: "cumulative probe",
      grossFils: "500.00",
      netPayableFils: "500.00",
      status: "CERTIFIED",
      statedCumulativeFils: "10331978.01",
    });
    expect(res.status).toBe(201);
    const created = await res.json();
    createdPcIds.push(String(created.id));
    expect(created.status).toBe("CERTIFIED");

    const flag = await prisma.dataFlag.findFirst({
      where: { entityType: "PaymentCertificate", entityId: String(created.id), ruleCode: "CUMULATIVE_MISMATCH", status: "OPEN" },
    });
    expect(flag).not.toBeNull();
    createdFlagIds.push(String(flag!.id));
    expect(flag!.message).toContain("10,332,478.00"); // recomputed incl. this cert (+500.00)
    expect(flag!.message).toContain("10,331,978.01"); // stated
  });

  it("AC5b: PAID only reachable from CERTIFIED; backward moves rejected", async () => {
    const { PATCH } = await import("@/app/api/v1/pcs/[id]/route");
    const draft = await createPc(financeCookie, {
      pcNumber: 93,
      periodLabel: "transition probe",
      grossFils: "500.00",
      netPayableFils: "500.00",
    });
    const id = String((await draft.json()).id);
    createdPcIds.push(id);

    const skipToPaid = await PATCH(req("PATCH", `/api/v1/pcs/${id}`, financeCookie, { status: "PAID" }), {
      params: Promise.resolve({ id }),
    });
    expect(skipToPaid.status).toBe(422);
    expect((await skipToPaid.json()).error.code).toBe("INVALID_TRANSITION");

    const certify = await PATCH(req("PATCH", `/api/v1/pcs/${id}`, financeCookie, { status: "CERTIFIED" }), {
      params: Promise.resolve({ id }),
    });
    expect(certify.status).toBe(200);

    const backToDraft = await PATCH(req("PATCH", `/api/v1/pcs/${id}`, financeCookie, { status: "DRAFT" }), {
      params: Promise.resolve({ id }),
    });
    expect(backToDraft.status).toBe(422);

    const paid = await PATCH(req("PATCH", `/api/v1/pcs/${id}`, financeCookie, { status: "PAID" }), {
      params: Promise.resolve({ id }),
    });
    expect(paid.status).toBe(200);
    expect((await paid.json()).status).toBe("PAID");
  });

  it("DELETE removes the certificate and audits it", async () => {
    const { DELETE } = await import("@/app/api/v1/pcs/[id]/route");
    const created = await createPc(financeCookie, {
      pcNumber: 94,
      periodLabel: "delete probe",
      grossFils: "500.00",
      netPayableFils: "500.00",
    });
    const id = String((await created.json()).id);
    const res = await DELETE(req("DELETE", `/api/v1/pcs/${id}`, adminCookie), { params: Promise.resolve({ id }) });
    expect(res.status).toBe(200);
    expect(await prisma.paymentCertificate.findUnique({ where: { id: BigInt(id) } })).toBeNull();
    const delAudit = await prisma.auditLog.findFirst({
      where: { entity: "PaymentCertificate", entityId: id, action: "DELETE" },
    });
    expect(delAudit).not.toBeNull();
  });
});
