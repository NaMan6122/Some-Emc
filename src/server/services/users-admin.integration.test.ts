import { execSync } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/server/db";
import { signSessionToken } from "@/server/auth/jwt";

// spec-024-v1 integration suite. Fixture users carry the ua17- stamp and are
// purged afterAll. The self-guard exercise targets admin@trends.local (always
// present) without mutating it.
const STAMP = "ua17";
let projectId = 0;
let adminCookie = "";
let financeCookie = "";
let viewerCookie = "";
let fixtureAdminId = 0;
let fixtureUserId = 0;
const created: number[] = [];

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

async function post(cookie: string | undefined, body: unknown) {
  const { POST } = await import("@/app/api/v1/users/route");
  return POST(req("POST", "/api/v1/users", cookie, body));
}

async function patch(cookie: string | undefined, id: number, body: unknown) {
  const { PATCH } = await import("@/app/api/v1/users/[id]/route");
  return PATCH(req("PATCH", `/api/v1/users/${id}`, cookie, body), {
    params: Promise.resolve({ id: String(id) }),
  });
}

beforeAll(async () => {
  execSync("npm run --silent seed:job1571", { stdio: "pipe", env: process.env });
  projectId = (await prisma.project.findUniqueOrThrow({ where: { code: "1571" } })).id;
  void projectId;
  adminCookie = await cookieFor("admin@trends.local");
  financeCookie = await cookieFor("finance@trends.local");
  viewerCookie = await cookieFor("viewer@trends.local");
  const purge = { email: { startsWith: `${STAMP}-` } };
  await prisma.user.deleteMany({ where: purge });
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: { startsWith: `${STAMP}-` } } }).catch(() => undefined);
  if (created.length > 0) {
    await prisma.auditLog.deleteMany({ where: { entity: "User", entityId: { in: created.map(String) } } }).catch(() => undefined);
    await prisma.user.deleteMany({ where: { id: { in: created } } }).catch(() => undefined);
  }
  await prisma.$disconnect();
});

describe("spec-024 user administration", () => {
  it("AC1: ADMIN creates a user → 201 + one-time password once; audit stores no credential; dup email → 409", async () => {
    const res = await post(adminCookie, {
      email: `${STAMP}-create@t.local`,
      name: "Create Fixture",
      role: "PROCUREMENT",
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.oneTimePassword).toBeTruthy();
    expect(typeof body.oneTimePassword).toBe("string");
    fixtureUserId = Number(body.id);
    created.push(fixtureUserId);

    const auditRow = await prisma.auditLog.findFirstOrThrow({
      where: { entity: "User", entityId: String(body.id), action: "CREATE" },
    });
    expect(JSON.stringify(auditRow.after)).not.toContain("password");
    expect(JSON.stringify(auditRow.after)).not.toContain(body.oneTimePassword);

    const stored = await prisma.user.findUniqueOrThrow({ where: { id: fixtureUserId } });
    expect(stored.passwordHash).not.toBe(body.oneTimePassword);

    const dup = await post(adminCookie, {
      email: `${STAMP}-create@t.local`,
      name: "Dup",
      role: "VIEWER",
    });
    expect(dup.status).toBe(409);
    expect((await dup.json()).error.code).toBe("EMAIL_TAKEN");
  });

  it("AC2: role change persists, bumps tokenVersion (old session dies), audit records before/after", async () => {
    // Fresh admin-fixture whose sessions we can observe revocation for.
    const res = await post(adminCookie, { email: `${STAMP}-role@t.local`, name: "Role Fixture", role: "VIEWER" });
    const createdBody = await res.json();
    fixtureAdminId = Number(createdBody.id);
    created.push(fixtureAdminId);
    const oldTv = (await prisma.user.findUniqueOrThrow({ where: { id: fixtureAdminId } })).tokenVersion;
    const oldCookie = "procare_session=" + (await signSessionToken({ uid: fixtureAdminId, role: "VIEWER", tv: oldTv }));

    // Old-role session works pre-change.
    const guardsModule = await import("@/server/auth/guards");
    expect((await guardsModule.getSession(req("GET", "/api/v1/users", oldCookie)))?.role).toBe("VIEWER");

    const promote = await patch(adminCookie, fixtureAdminId, { role: "ADMIN" });
    expect(promote.status).toBe(200);

    const row = await prisma.user.findUniqueOrThrow({ where: { id: fixtureAdminId } });
    expect(row.role).toBe("ADMIN");
    expect(row.tokenVersion).toBe(oldTv + 1); // revocation
    // Old session is now dead.
    expect(await guardsModule.getSession(new Request("http://localhost/x", { headers: { cookie: oldCookie } }))).toBeNull();

    const auditRow = await prisma.auditLog.findFirstOrThrow({
      where: { entity: "User", entityId: String(fixtureAdminId), action: "UPDATE" },
      orderBy: { id: "desc" },
    });
    expect(auditRow.before).toMatchObject({ role: "VIEWER" });
    expect(auditRow.after).toMatchObject({ role: "ADMIN", sessionsRevoked: true });
  });

  it("AC3: deactivate kills session; login → 403 USER_INACTIVE; reactivate restores", async () => {
    const res = await post(adminCookie, { email: `${STAMP}-deact@t.local`, name: "Deact Fixture", role: "FINANCE" });
    const u = await res.json();
    created.push(Number(u.id));
    const id = Number(u.id);
    const pw = u.oneTimePassword as string;

    // Login works before deactivation.
    const loginRoute = await import("@/app/api/v1/auth/login/route");
    const okLogin = await loginRoute.POST(
      req("POST", "/api/v1/auth/login", undefined, { email: `${STAMP}-deact@t.local`, password: pw }),
    );
    expect(okLogin.status).toBe(200);

    const off = await patch(adminCookie, id, { active: false });
    expect(off.status).toBe(200);

    const loginAfter = await loginRoute.POST(
      req("POST", "/api/v1/auth/login", undefined, { email: `${STAMP}-deact@t.local`, password: pw }),
    );
    expect(loginAfter.status).toBe(403);
    expect((await loginAfter.json()).error.code).toBe("USER_INACTIVE");

    const backOn = await patch(adminCookie, id, { active: true });
    expect(backOn.status).toBe(200);
    const restoredLogin = await loginRoute.POST(
      req("POST", "/api/v1/auth/login", undefined, { email: `${STAMP}-deact@t.local`, password: pw }),
    );
    expect(restoredLogin.status).toBe(200);
  });

  it("AC4: self-modification blocked; last-active-admin protected", async () => {
    const adminId = (await prisma.user.findUniqueOrThrow({ where: { email: "admin@trends.local" } })).id;

    const selfDeactivate = await patch(adminCookie, adminId, { active: false });
    expect(selfDeactivate.status).toBe(422);
    expect((await selfDeactivate.json()).error.code).toBe("CANNOT_MODIFY_SELF");

    const selfDemote = await patch(adminCookie, adminId, { role: "VIEWER" });
    expect(selfDemote.status).toBe(422);
    expect((await selfDemote.json()).error.code).toBe("CANNOT_MODIFY_SELF");

    // Zero-case for LAST_ADMIN is unit-tested via the guard's count logic; here
    // we prove the happy-path inverse: demoting a NON-last admin succeeds.
    const demote = await patch(adminCookie, fixtureAdminId, { role: "MANAGEMENT" });
    expect(demote.status).toBe(200);
  });

  it("AC5: FINANCE POST/PATCH → 403; triage GET shape stays minimal; VIEWER GET → 403", async () => {
    const deniedPost = await post(financeCookie, { email: `${STAMP}-x@t.local`, name: "X", role: "VIEWER" });
    expect(deniedPost.status).toBe(403);

    const deniedPatch = await patch(financeCookie, fixtureUserId, { active: false });
    expect(deniedPatch.status).toBe(403);

    const { GET } = await import("@/app/api/v1/users/route");
    const financeGet = await GET(req("GET", "/api/v1/users", financeCookie));
    const items = (await financeGet.json()).items as Record<string, unknown>[];
    for (const item of items) {
      expect(Object.keys(item).sort()).toEqual(["id", "name", "role"]);
    }
    const viewerGet = await GET(req("GET", "/api/v1/users", viewerCookie));
    expect(viewerGet.status).toBe(403);

    const unauth = await post(undefined, {});
    expect(unauth.status).toBe(401);
  });

  it("AC6 (API half): resetPassword returns a fresh one-time password and revokes sessions", async () => {
    const res = await patch(adminCookie, fixtureUserId, { resetPassword: true });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.oneTimePassword).toBeTruthy();
    const stored = await prisma.user.findUniqueOrThrow({ where: { id: fixtureUserId } });
    expect(stored.passwordHash).not.toBe(body.oneTimePassword);
    expect(stored.tokenVersion).toBeGreaterThan(0);
  });
});
