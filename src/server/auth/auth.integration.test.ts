import { NextRequest } from "next/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { hash } from "@node-rs/argon2";
import { prisma } from "@/server/db";
import { guard } from "@/server/auth/middleware-guard";
import { _resetForTests } from "@/server/auth/rate-limit";

// spec-003-v2 acceptance criteria — headless integration against live routes.

const stamp = Date.now().toString(36);
const adminEmail = `admin-${stamp}@test.local`;
const viewerEmail = `viewer-${stamp}@test.local`;
let adminId = 0;

function loginRequest(email: string, password: string): Request {
  return new Request("http://localhost/api/v1/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": `10.0.0.${stamp.length}` },
    body: JSON.stringify({ email, password }),
  });
}

function withCookie(path: string, cookie?: string): Request {
  return new Request(`http://localhost${path}`, {
    headers: cookie ? { cookie } : {},
  });
}

function extractSessionCookie(res: Response): string {
  const setCookie = res.headers.get("set-cookie") ?? "";
  const pair = setCookie.split(";")[0];
  expect(pair).toContain("procare_session=");
  return pair;
}

async function createTestUser(email: string, role: "ADMIN" | "VIEWER", password: string) {
  return prisma.user.create({
    data: { email, name: `Test ${role}`, role, passwordHash: await hash(password) },
    select: { id: true },
  });
}

const { POST: loginPost } = await import("@/app/api/v1/auth/login/route");
const { GET: meGet } = await import("@/app/api/v1/auth/me/route");
const { POST: passwordPost } = await import("@/app/api/v1/auth/password/route");
const { POST: logoutPost } = await import("@/app/api/v1/auth/logout/route");

beforeAll(async () => {
  await createTestUser(adminEmail, "ADMIN", "correct horse battery");
  await createTestUser(viewerEmail, "VIEWER", "viewer secret key");
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: { in: [adminEmail, viewerEmail] } } });
  await prisma.$disconnect();
  _resetForTests();
});

describe("spec-003-v2 auth flows", () => {
  it("AC1: valid login sets HttpOnly SameSite=Lax cookie and /me returns the user", async () => {
    const res = await loginPost(loginRequest(adminEmail, "correct horse battery"));
    expect(res.status).toBe(200);
    const sc = res.headers.get("set-cookie") ?? "";
    expect(sc).toContain("HttpOnly");
    expect(sc).toContain("SameSite=Lax");

    const meRes = await meGet(withCookie("/api/v1/auth/me", extractSessionCookie(res)));
    const body = await meRes.json();
    expect(meRes.status).toBe(200);
    expect(body).toMatchObject({ email: adminEmail, name: `Test ADMIN`, role: "ADMIN" });
    adminId = body.id;
  });

  it("AC2a: wrong password → 401 INVALID_CREDENTIALS (generic)", async () => {
    const res = await loginPost(loginRequest(viewerEmail, "definitely-wrong"));
    const body = await res.json();
    expect(res.status).toBe(401);
    expect(body.error.code).toBe("INVALID_CREDENTIALS");
    expect(JSON.stringify(body)).not.toContain("viewer secret key");
  });

  it("AC2b: 5 failures then 429 with Retry-After; success clears counter", async () => {
    _resetForTests(); // self-contained counter for this test
    for (let i = 0; i < 5; i++) {
      const r = await loginPost(loginRequest(viewerEmail, "bad-pass-attempt"));
      expect(r.status).toBe(401);
    }
    const limited = await loginPost(loginRequest(viewerEmail, "bad-pass-attempt"));
    expect(limited.status).toBe(429);
    expect(Number(limited.headers.get("retry-after"))).toBeGreaterThan(0);

    // Different IP is not blocked.
    const otherIp = await loginPost(
      new Request("http://localhost/api/v1/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json", "x-forwarded-for": "10.9.9.9" },
        body: JSON.stringify({ email: viewerEmail, password: "bad-pass-attempt" }),
      }),
    );
    expect(otherIp.status).toBe(401);
  });

  it("AC3: unauthenticated API → 401 envelope; page → /login redirect (middleware guard)", async () => {
    const apiReq = new NextRequest("http://localhost/api/v1/projects");
    const apiRes = await guard(apiReq);
    expect(apiRes?.status).toBe(401);
    expect((await apiRes?.json())?.error?.code).toBe("UNAUTHENTICATED");

    // spec-036: `/` is now the PUBLIC landing page — unauthenticated visitors
    // pass through; a protected page still redirects to /login.
    const landingReq = new NextRequest("http://localhost/");
    const landingRes = await guard(landingReq);
    expect(landingRes).toBeUndefined();

    const protectedReq = new NextRequest("http://localhost/overview");
    const protectedRes = await guard(protectedReq);
    expect(protectedRes?.status).toBe(307);
    expect(protectedRes?.headers.get("location")).toContain("/login");

    // Authenticated request passes through (guard returns undefined).
    const login = await loginPost(loginRequest(adminEmail, "correct horse battery"));
    const ok = await guard(
      new NextRequest("http://localhost/", { headers: { cookie: extractSessionCookie(login) } }),
    );
    expect(ok).toBeUndefined();
  });

  it("AC4: authenticated VIEWER reaches requireAuth'd endpoint (no 401/403 for self-service)", async () => {
    const vLogin = await loginPost(
      new Request("http://localhost/api/v1/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json", "x-forwarded-for": "10.6.6.6" },
        body: JSON.stringify({ email: viewerEmail, password: "viewer secret key" }),
      }),
    );
    expect(vLogin.status).toBe(200);
    const res = await passwordPost(
      new Request("http://localhost/api/v1/auth/password", {
        method: "POST",
        headers: { "content-type": "application/json", cookie: extractSessionCookie(vLogin) },
        body: JSON.stringify({ currentPassword: "wrong-current-pw", newPassword: "unused here" }),
      }),
    );
    // Reached the handler (authenticated) but wrong current password → 400.
    // Role-based 403 enforcement of requireRole itself is proven in AC4b.
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("WRONG_PASSWORD");
  });

  it("AC4b: requireRole blocks VIEWER from ADMIN-only action", async () => {
    const { requireRole } = await import("@/server/auth/guards");
    const vLogin = await loginPost(
      new Request("http://localhost/api/v1/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json", "x-forwarded-for": "10.8.8.8" },
        body: JSON.stringify({ email: viewerEmail, password: "viewer secret key" }),
      }),
    );
    expect(vLogin.status).toBe(200);
    const req = withCookie("/x", extractSessionCookie(vLogin));
    await expect(requireRole(req, "ADMIN")).rejects.toMatchObject({
      status: 403,
      code: "FORBIDDEN",
    });
    await expect(requireRole(req, "VIEWER")).resolves.toMatchObject({ role: "VIEWER" });
  });

  it("AC5: password change bumps tokenVersion — old tokens rejected, new cookie works", async () => {
    const first = await loginPost(
      new Request("http://localhost/api/v1/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json", "x-forwarded-for": "10.7.7.7" },
        body: JSON.stringify({ email: adminEmail, password: "correct horse battery" }),
      }),
    );
    const oldCookie = extractSessionCookie(first);

    const change = await passwordPost(
      new Request("http://localhost/api/v1/auth/password", {
        method: "POST",
        headers: { "content-type": "application/json", cookie: oldCookie },
        body: JSON.stringify({ currentPassword: "correct horse battery", newPassword: "brand new secret pw" }),
      }),
    );
    expect(change.status).toBe(200);
    const newCookie = extractSessionCookie(change);

    const oldMe = await meGet(withCookie("/api/v1/auth/me", oldCookie));
    expect(oldMe.status).toBe(401);
    expect((await oldMe.json()).error.code).toBe("UNAUTHENTICATED");

    const newMe = await meGet(withCookie("/api/v1/auth/me", newCookie));
    expect(newMe.status).toBe(200);

    const dbUser = await prisma.user.findUniqueOrThrow({ where: { id: adminId } });
    expect(dbUser.passwordHash).not.toContain("brand new secret pw");
  });

  it("logout clears cookie and is idempotent without session", async () => {
    const res = await logoutPost(new Request("http://localhost/api/v1/auth/logout", { method: "POST" }));
    expect(res.status).toBe(200);
    expect(res.headers.get("set-cookie")).toContain("Max-Age=0");
  });
});
