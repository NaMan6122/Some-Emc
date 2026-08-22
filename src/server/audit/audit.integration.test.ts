import { Prisma } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { signSessionToken } from "@/server/auth/jwt";
import { prisma } from "@/server/db";
import { audit } from "./service";

// spec-004-v1 integration: atomicity, actor attribution, route access control.

const stamp = Date.now().toString(36);
let projectId: number;
let supplierId: number;
let adminCookie = "";
let viewerCookie = "";

async function cookieFor(role: "ADMIN" | "VIEWER"): Promise<string> {
  const u = await prisma.user.create({
    data: {
      email: `audit-${role}-${stamp}@test.local`,
      name: `Audit ${role}`,
      role,
      passwordHash: "x",
    },
  });
  const token = await signSessionToken({ uid: u.id, role, tv: u.tokenVersion });
  return `procare_session=${token}`;
}

beforeAll(async () => {
  const project = await prisma.project.create({
    data: {
      code: `A${stamp}`,
      name: "Audit fixture",
      mainContractor: "X",
      contractValueFils: 100n,
    },
  });
  projectId = project.id;
  const supplier = await prisma.supplier.create({
    data: { name: `AUDIT SUPPLIER ${stamp}` },
  });
  supplierId = supplier.id;
  adminCookie = await cookieFor("ADMIN");
  viewerCookie = await cookieFor("VIEWER");
});

afterAll(async () => {
  await prisma.auditLog.deleteMany({ where: { entity: { in: ["Supplier", "RollbackProbe"] } } });
  await prisma.supplier.deleteMany({ where: { id: supplierId } });
  await prisma.project.deleteMany({ where: { id: projectId } });
  await prisma.user.deleteMany({ where: { email: { contains: `-audit-${stamp}@` } } });
  await prisma.$disconnect();
});

describe("spec-004-v1 audit service", () => {
  it("AC1: mutation + audit in one transaction records only changed keys and the actor", async () => {
    const actorId = (await prisma.user.findFirstOrThrow({ where: { role: "ADMIN" } })).id;
    const before = await prisma.supplier.findUniqueOrThrow({ where: { id: supplierId } });
    const after = await prisma.$transaction(async (tx) => {
      const updated = await tx.supplier.update({
        where: { id: supplierId },
        data: { name: `RENAMED SUPPLIER ${stamp}` },
      });
      await audit(tx, {
        actorId,
        entity: "Supplier",
        entityId: supplierId,
        action: "UPDATE",
        before,
        after: updated,
      });
      return updated;
    });

    expect(after.name).toBe(`RENAMED SUPPLIER ${stamp}`);
    const rows = await prisma.auditLog.findMany({ where: { entity: "Supplier", entityId: String(supplierId) } });
    expect(rows).toHaveLength(1);
    expect(rows[0].actorId).toBe(actorId);
    expect(rows[0].action).toBe("UPDATE");
    expect(Object.keys(rows[0].before as object)).toEqual(["name"]);
    expect((rows[0].before as Record<string, string>).name).toBe(before.name);
    expect((rows[0].after as Record<string, string>).name).toBe(after.name);
  });

  it("AC2: failed audit write rolls back the whole business transaction", async () => {
    const countBefore = await prisma.auditLog.count({ where: { entity: "RollbackProbe" } });
    const nameBefore = (await prisma.supplier.findUniqueOrThrow({ where: { id: supplierId } })).name;

    // A transaction client whose auditLog.create always fails.
    const brokenTx = new Proxy({} as Prisma.TransactionClient, {
      get(_t, prop) {
        if (prop === "auditLog") {
          return { create: () => Promise.reject(new Error("simulated audit failure")) };
        }
        throw new Error("unexpected accessor on brokenTx");
      },
    });

    await expect(
      prisma.$transaction(async (tx) => {
        await tx.supplier.update({
          where: { id: supplierId },
          data: { name: "SHOULD NEVER PERSIST" },
        });
        await audit(brokenTx, {
          actorId: 0,
          entity: "RollbackProbe",
          entityId: supplierId,
          action: "UPDATE",
          before: {},
          after: {},
        });
      }),
    ).rejects.toThrow("simulated audit failure");

    const nameAfter = (await prisma.supplier.findUniqueOrThrow({ where: { id: supplierId } })).name;
    expect(nameAfter).toBe(nameBefore);
    expect(nameAfter).not.toBe("SHOULD NEVER PERSIST");
    expect(await prisma.auditLog.count({ where: { entity: "RollbackProbe" } })).toBe(countBefore);
  });
});

describe("spec-004-v1 GET /api/v1/audit access + pagination", () => {
  it("AC3: non-ADMIN receives 403 FORBIDDEN envelope", async () => {
    const { GET } = await import("@/app/api/v1/audit/route");
    const res = await GET(new Request("http://localhost/api/v1/audit", { headers: { cookie: viewerCookie } }));
    expect(res.status).toBe(403);
    expect((await res.json()).error.code).toBe("FORBIDDEN");
  });

  it("AC3b: ADMIN gets filtered, cursor-paginated results", async () => {
    const { GET } = await import("@/app/api/v1/audit/route");
    const admin = await prisma.user.findFirstOrThrow({ where: { email: { contains: `-ADMIN-${stamp}@` } } });
    // Seed so pagination is real: 3 total Supplier rows for this fixture.
    await prisma.auditLog.createMany({
      data: [1, 2].map((n) => ({
        actorId: admin.id,
        entity: "Supplier",
        entityId: String(supplierId),
        action: "UPDATE",
        before: {},
        after: { note: `extra ${n}` },
      })),
    });

    const url = `http://localhost/api/v1/audit?entity=Supplier&entityId=${supplierId}&limit=1`;
    const page1 = await GET(new Request(url, { headers: { cookie: adminCookie } }));
    expect(page1.status).toBe(200);
    const body1 = await page1.json();
    expect(body1.items).toHaveLength(1);
    expect(body1.items[0].entity).toBe("Supplier");
    expect(typeof body1.nextCursor).toBe("string");

    const page2 = await GET(
      new Request(`${url}&cursor=${body1.nextCursor}`, { headers: { cookie: adminCookie } }),
    );
    const body2 = await page2.json();
    expect(body2.items).toHaveLength(1);
    expect(typeof body2.nextCursor).toBe("string");

    const page3 = await GET(
      new Request(`${url}&cursor=${body2.nextCursor}`, { headers: { cookie: adminCookie } }),
    );
    const body3 = await page3.json();
    expect(body3.items).toHaveLength(1);
    expect(body3.nextCursor).toBeNull(); // exhausted

    const badDate = await GET(
      new Request("http://localhost/api/v1/audit?from=nonsense", { headers: { cookie: adminCookie } }),
    );
    expect(badDate.status).toBe(422);
  });

  it("AC4: no mutating handlers exist on the audit route module", async () => {
    const mod = (await import("@/app/api/v1/audit/route")) as unknown as Record<string, unknown>;
    expect(mod.POST).toBeUndefined();
    expect(mod.PATCH).toBeUndefined();
    expect(mod.PUT).toBeUndefined();
    expect(mod.DELETE).toBeUndefined();
  });
});
