import { Prisma } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/server/db";

/**
 * spec-002-v1 acceptance criteria verified against the live dev database.
 * Self-cleaning: every row created here is removed in afterAll.
 */
const stamp = Date.now().toString(36).toUpperCase();
let projectId: number;
let supplierId: number;
let lpoId: bigint;

async function main() {
  const project = await prisma.project.create({
    data: {
      code: `T${stamp}`,
      name: "Spec-002 integration fixture",
      mainContractor: "TEST CLIENT",
      contractValueFils: 1878662500n,
      vatRate: 0.05,
    },
  });
  projectId = project.id;

  const supplier = await prisma.supplier.create({
    data: { name: `TEST SUPPLIER ${stamp}`, aliases: [] },
  });
  supplierId = supplier.id;

  const lpo = await prisma.lpo.create({
    data: {
      projectId,
      refNo: "TEMW/REF/LPO//T01",
      seq: 1,
      supplierId,
      trade: "ELECTRICAL",
      description: "Integration fixture LPO",
      issueDate: new Date("2025-06-02"),
      amountFils: 383250000n,
      vatRate: 0.05,
    },
  });
  lpoId = lpo.id;
}

beforeAll(async () => {
  await main();
});

afterAll(async () => {
  await prisma.lpo.deleteMany({ where: { projectId } });
  await prisma.supplier.delete({ where: { id: supplierId } });
  await prisma.project.delete({ where: { id: projectId } }).catch(() => undefined);
  await prisma.$disconnect();
});

describe("spec-002 schema constraints", () => {
  it("rejects a duplicate (projectId, refNo)", async () => {
    await expect(
      prisma.lpo.create({
        data: {
          projectId,
          refNo: "TEMW/REF/LPO//T01",
          seq: 2,
          supplierId,
          trade: "HVAC",
          description: "dup",
          issueDate: new Date("2025-06-03"),
          amountFils: 100n,
          vatRate: 0.05,
        },
      }),
    ).rejects.toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
  });

  it("restricts deleting a project that has dependent LPOs", async () => {
    await expect(prisma.project.delete({ where: { id: projectId } })).rejects.toBeInstanceOf(
      Prisma.PrismaClientKnownRequestError,
    );
  });

  it("round-trips BigInt amounts exactly to the fils", async () => {
    const found = await prisma.lpo.findUniqueOrThrow({ where: { id: lpoId } });
    expect(found.amountFils).toBe(383250000n);
  });

  it("enforces unique supplier names at DB level", async () => {
    await expect(prisma.supplier.create({ data: { name: `TEST SUPPLIER ${stamp}` } })).rejects.toBeInstanceOf(
      Prisma.PrismaClientKnownRequestError,
    );
  });

  it("keeps migration-only state clean of business rows for this fixture scope", async () => {
    const count = await prisma.project.count({ where: { name: "Spec-002 integration fixture" } });
    expect(count).toBe(1);
  });
});
