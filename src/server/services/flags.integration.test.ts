import { execSync } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/server/db";
import { signSessionToken } from "@/server/auth/jwt";

// spec-016-v1 integration suite. Fixture flags carry reserved entityIds
// ("flagspec-*") so cleanup never touches real or seeded rows.
const FIX = "flagspec";
let financeUserId = 0;
let adminCookie = "";
let commercialCookie = "";
let financeCookie = "";
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

async function createFixtureFlag(entityType: string, ruleCode: string): Promise<bigint> {
  const row = await prisma.dataFlag.create({
    data: {
      entityType,
      entityId: `${FIX}-${ruleCode.toLowerCase()}`,
      ruleCode,
      severity: "MEDIUM",
      message: "spec-016 fixture",
      status: "OPEN",
    },
  });
  return row.id;
}

async function patch(cookie: string | undefined, id: bigint, body: unknown) {
  const { PATCH } = await import("@/app/api/v1/flags/[id]/route");
  return PATCH(req("PATCH", `/api/v1/flags/${id}`, cookie, body), {
    params: Promise.resolve({ id: String(id) }),
  });
}

beforeAll(async () => {
  execSync("npm run --silent seed:job1571", { stdio: "pipe", env: process.env });
  financeUserId = (await prisma.user.findUniqueOrThrow({ where: { email: "finance@trends.local" } })).id;
  adminCookie = await cookieFor("admin@trends.local");
  commercialCookie = await cookieFor("commercial@trends.local");
  financeCookie = await cookieFor("finance@trends.local");
  viewerCookie = await cookieFor("viewer@trends.local");
  await prisma.dataFlag.deleteMany({ where: { entityId: { startsWith: `${FIX}-` } } });
});

afterAll(async () => {
  await prisma.dataFlag.deleteMany({ where: { entityId: { startsWith: `${FIX}-` } } });
  await prisma.$disconnect();
});

describe("spec-016 flag triage", () => {
  it("AC1: ADMIN assigns an OPEN flag → 200 + audit UPDATE row", async () => {
    const id = await createFixtureFlag("Lpo", "ASSIGN_SPEC");
    const res = await patch(adminCookie, id, { assigneeId: financeUserId });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.assigneeId).toBe(financeUserId);
    const auditRow = await prisma.auditLog.findFirstOrThrow({
      where: { entity: "DataFlag", entityId: String(id), action: "UPDATE" },
      orderBy: { id: "desc" },
    });
    // Audit convention (spec-004): UPDATE rows carry changed top-level keys
    // only — an assign-only patch therefore records just the assignee change.
    expect(auditRow.before).toMatchObject({ assigneeId: null });
    expect(auditRow.after).toMatchObject({ assigneeId: financeUserId });
  });

  it("AC2: FINANCE resolves a PaymentCertificate-domain flag → RESOLVED + resolvedAt + audit", async () => {
    const id = await createFixtureFlag("PaymentCertificate", "RESOLVE_SPEC");
    const res = await patch(financeCookie, id, {
      status: "RESOLVED",
      resolutionNote: "corrected PC03 retention source value",
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("RESOLVED");
    expect(body.resolutionNote).toBe("corrected PC03 retention source value");
    expect(body.resolvedAt).not.toBeNull();
    const auditRow = await prisma.auditLog.findFirstOrThrow({
      where: { entity: "DataFlag", entityId: String(id), action: "UPDATE" },
      orderBy: { id: "desc" },
    });
    expect(auditRow.after).toMatchObject({ status: "RESOLVED" });
  });

  it("AC3a: COMMERCIAL resolves BudgetLine-domain flag; AC3b wrong domain → 403 FLAG_DOMAIN_FORBIDDEN", async () => {
    const okId = await createFixtureFlag("BudgetLine", "DOMAIN_OK");
    const ok = await patch(commercialCookie, okId, { status: "WONT_FIX", resolutionNote: "advisory accepted" });
    expect(ok.status).toBe(200);
    expect((await ok.json()).status).toBe("WONT_FIX");

    const deniedId = await createFixtureFlag("PaymentCertificate", "DOMAIN_DENY");
    const denied = await patch(commercialCookie, deniedId, { status: "RESOLVED", resolutionNote: "not mine" });
    expect(denied.status).toBe(403);
    expect((await denied.json()).error.code).toBe("FLAG_DOMAIN_FORBIDDEN");
    // Flag remains OPEN after the denial.
    expect((await prisma.dataFlag.findUniqueOrThrow({ where: { id: deniedId } })).status).toBe("OPEN");
  });

  it("AC4: WONT_FIX without note → 422; triaging a closed flag → 422 INVALID_TRANSITION", async () => {
    const id = await createFixtureFlag("Project", "NOTE_SPEC");
    const noNote = await patch(adminCookie, id, { status: "WONT_FIX" });
    expect(noNote.status).toBe(422);
    expect((await noNote.json()).error.details).toHaveProperty("resolutionNote");

    const resolveRes = await patch(adminCookie, id, { status: "RESOLVED", resolutionNote: "done" });
    expect(resolveRes.status).toBe(200);
    const again = await patch(adminCookie, id, { status: "RESOLVED", resolutionNote: "again" });
    expect(again.status).toBe(422);
    expect((await again.json()).error.code).toBe("INVALID_TRANSITION");

    const reassign = await patch(adminCookie, id, { assigneeId: null });
    expect(reassign.status).toBe(422);
  });

  it("AC5: VIEWER PATCH → 403; unauthenticated PATCH/GET → 401 envelope", async () => {
    const id = await createFixtureFlag("Supplier", "ROLES_SPEC");
    const viewer = await patch(viewerCookie, id, { assigneeId: financeUserId });
    expect(viewer.status).toBe(403);

    const unauthPatch = await patch(undefined, id, { assigneeId: financeUserId });
    expect(unauthPatch.status).toBe(401);

    const { GET } = await import("@/app/api/v1/flags/route");
    const unauthGet = await GET(req("GET", "/api/v1/flags"));
    expect(unauthGet.status).toBe(401);
  });

  it("AC6: list filters — seeded SOURCE_NEEDS_CHECK unique under ruleCode+OPEN; assigneeId filter scopes rows", async () => {
    const { GET } = await import("@/app/api/v1/flags/route");
    const filtered = await GET(req("GET", `/api/v1/flags?status=OPEN&ruleCode=SOURCE_NEEDS_CHECK`, adminCookie));
    expect(filtered.status).toBe(200);
    const body = await filtered.json();
    expect(body.items).toHaveLength(1);
    expect(body.items[0].ruleCode).toBe("SOURCE_NEEDS_CHECK");
    expect(body.meta.openBySeverity).toBeDefined();

    const assigned = await createFixtureFlag("Lpo", "FILTER_SPEC");
    const other = await createFixtureFlag("Lpo", "FILTER_OTHER");
    await patch(adminCookie, assigned, { assigneeId: financeUserId });
    await patch(adminCookie, other, { assigneeId: null });

    const mine = await GET(req("GET", `/api/v1/flags?assigneeId=${financeUserId}`, adminCookie));
    const mineIds = ((await mine.json()).items as { id: string }[]).map((i) => i.id);
    expect(mineIds).toContain(String(assigned));
    expect(mineIds).not.toContain(String(other));
  });

  it("AC7: users picker endpoint — triage role reads {id,name,role}; VIEWER 403", async () => {
    const { GET } = await import("@/app/api/v1/users/route");
    const ok = await GET(req("GET", "/api/v1/users", financeCookie));
    expect(ok.status).toBe(200);
    const items = (await ok.json()).items as { id: number; name: string; role: string }[];
    expect(items.length).toBeGreaterThan(0);
    for (const u of items) {
      expect(Object.keys(u).sort()).toEqual(["id", "name", "role"]);
    }
    const denied = await GET(req("GET", "/api/v1/users", viewerCookie));
    expect(denied.status).toBe(403);
  });
});
