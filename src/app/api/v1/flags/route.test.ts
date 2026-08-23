import { execSync } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/server/db";
import { signSessionToken } from "@/server/auth/jwt";

beforeAll(async () => {
  execSync("npm run --silent seed:job1571", { stdio: "pipe", env: process.env });
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("spec-015 tab 6: read-only flags feed", () => {
  it("lists OPEN flags newest-first for any authenticated role; unauth → 401", async () => {
    const { GET } = await import("@/app/api/v1/flags/route");

    const unauth = await GET(new Request("http://localhost/api/v1/flags"));
    expect(unauth.status).toBe(401);

    const viewer = await prisma.user.findUniqueOrThrow({ where: { email: "viewer@trends.local" } });
    const cookie = "procare_session=" + (await signSessionToken({ uid: viewer.id, role: viewer.role, tv: viewer.tokenVersion }));
    const res = await GET(new Request("http://localhost/api/v1/flags?status=OPEN&limit=200", { headers: { cookie } }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items.length).toBeGreaterThan(0);
    const codes = body.items.map((f: { ruleCode: string }) => f.ruleCode);
    expect(codes).toContain("TOTALS_MISMATCH");
    expect(codes).toContain("VO_BACKFILL");
    const dates = body.items.map((f: { createdAt: string }) => new Date(f.createdAt).getTime());
    expect([...dates].sort((a, b) => b - a)).toEqual(dates);
    for (const f of body.items) expect(f.status).toBe("OPEN");
  });
});
