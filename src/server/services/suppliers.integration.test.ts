import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { hash } from "@node-rs/argon2";
import { prisma } from "@/server/db";
import { signSessionToken } from "@/server/auth/jwt";

// spec-006-v1 acceptance criteria — headless integration against live routes.

const stamp = Date.now().toString(36);
let adminCookie = "";
let procurementCookie = "";
let financeCookie = "";
let adminId = 0;
let supplierAId = 0;
let supplierBId = 0;
let projectId = 0;

function req(method: string, path: string, cookie: string, body?: unknown): Request {
  return new Request(`http://localhost${path}`, {
    method,
    headers: { "content-type": "application/json", cookie },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

async function routes() {
  return {
    collection: await import("@/app/api/v1/suppliers/route"),
    item: await import("@/app/api/v1/suppliers/[id]/route"),
    merge: await import("@/app/api/v1/suppliers/[id]/merge/route"),
    suggestions: await import("@/app/api/v1/suppliers/duplicates/suggestions/route"),
  };
}

beforeAll(async () => {
  // Test hygiene: stale runs leave stamped fixture suppliers behind, which flood
  // the capped (top-20) suggestions list and can evict the pair this suite asserts on.
  await prisma.supplier.deleteMany({ where: { name: { contains: " Equip mt", mode: "insensitive" } } });

  async function user(email: string, role: "ADMIN" | "PROCUREMENT" | "FINANCE") {
    const u = await prisma.user.create({
      data: { email, name: role, role, passwordHash: await hash("unused") },
    });
    const token = await signSessionToken({ uid: u.id, role, tv: u.tokenVersion });
    return { cookie: `procare_session=${token}`, id: u.id };
  }
  const a = await user(`sup-admin-${stamp}@t.local`, "ADMIN");
  adminCookie = a.cookie;
  adminId = a.id;
  procurementCookie = (await user(`sup-proc-${stamp}@t.local`, "PROCUREMENT")).cookie;
  financeCookie = (await user(`sup-fin-${stamp}@t.local`, "FINANCE")).cookie;

  // Supplier A stored in mixed case — service must normalize on create.
  const r = await routes();
  const res = await r.collection.POST(req("POST", "/api/v1/suppliers", adminCookie, { name: `Acme Gulf Trading LLC ${stamp}` }));
  supplierAId = (await res.json()).id;

  const proj = await prisma.project.create({
    data: { code: `SU${stamp}`, name: "Suppliers fixture", mainContractor: "X", contractValueFils: 100n },
  });
  projectId = proj.id;
});

afterAll(async () => {
  await prisma.lpo.deleteMany({ where: { project: { code: `SU${stamp}` } } });
  await prisma.auditLog.deleteMany({ where: { entity: "Supplier" } });
  await prisma.supplier.deleteMany({
    where: {
      OR: [
        { name: { contains: "ACME GULF" } },
        { name: { contains: `LPO HOLDER` } },
        { name: { startsWith: "MERGE " } },
        { name: { contains: `SILVER WAVES ELECTRICAL EQUIP ${stamp}` } },
        { name: { contains: `SILVER WAVES ELELCTRICAL EQUIP ${stamp}` } },
      ],
    },
  });
  await prisma.project.delete({ where: { id: projectId } }).catch(() => undefined);
  await prisma.user.deleteMany({ where: { email: { contains: `-sup-${stamp}@` } } });
  await prisma.$disconnect();
});

describe("spec-006-v1 suppliers", () => {
  it("AC1: case-insensitive duplicate POST → 409 with existing record id", async () => {
    const r = await routes();
    const res = await r.collection.POST(
      req("POST", "/api/v1/suppliers", adminCookie, { name: `acme gulf trading llc ${stamp}` }),
    );
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error.code).toBe("SUPPLIER_EXISTS");
    expect(String(body.error.details.existingId)).toBe(String(supplierAId));

    // Stored form is normalized uppercase (stamp letters get uppercased too).
    const row = await prisma.supplier.findUniqueOrThrow({ where: { id: supplierAId } });
    expect(row.name).toBe(`ACME GULF TRADING LLC ${stamp.toUpperCase()}`);
  });

  it("AC4: PROCUREMENT creates/updates; FINANCE mutations → 403", async () => {
    const r = await routes();
    const created = await r.collection.POST(
      req("POST", "/api/v1/suppliers", procurementCookie, { name: `MERGE TARGET ${stamp}` }),
    );
    expect(created.status).toBe(201);
    supplierBId = (await created.json()).id;

    const renamed = await r.item.PATCH(
      req("PATCH", `/api/v1/suppliers/${supplierBId}`, procurementCookie, { addAlias: "Historic Name" }),
      { params: Promise.resolve({ id: String(supplierBId) }) },
    );
    expect(renamed.status).toBe(200);

    const fin = await r.collection.POST(
      req("POST", "/api/v1/suppliers", financeCookie, { name: "FINANCE FORBIDDEN SUPPLIER" }),
    );
    expect(fin.status).toBe(403);
  });

  it("AC2: merge A→B re-points LPOs, aliases the loser, marks mergedIntoId, one audit entry", async () => {
    const supplier = await prisma.supplier.create({ data: { name: `MERGE SOURCE LPO HOLDER ${stamp}` } });
    const supplier2 = await prisma.supplier.create({ data: { name: `MERGE TARGET LPO HOLDER ${stamp}` } });
    await prisma.lpo.create({
      data: {
        projectId,
        refNo: "TEMW/REF/LPO//M01",
        seq: 1,
        supplierId: supplier.id,
        trade: "GENERAL",
        description: "merge fixture",
        issueDate: new Date("2025-02-02"),
        amountFils: 500n,
        vatRate: 0.05,
      },
    });

    const r = await routes();
    const res = await r.merge.POST(
      req("POST", `/api/v1/suppliers/${supplier.id}/merge`, adminCookie, { targetId: supplier2.id }),
      { params: Promise.resolve({ id: String(supplier.id) }) },
    );
    expect(res.status).toBe(200);

    const lpo = await prisma.lpo.findFirstOrThrow({ where: { refNo: "TEMW/REF/LPO//M01" } });
    expect(lpo.supplierId).toBe(supplier2.id);

    const src = await prisma.supplier.findUniqueOrThrow({ where: { id: supplier.id } });
    expect(src.mergedIntoId).toBe(supplier2.id);

    const tgt = await prisma.supplier.findUniqueOrThrow({ where: { id: supplier2.id } });
    expect((tgt.aliases as string[])).toContain(`MERGE SOURCE LPO HOLDER ${stamp}`);

    const audits = await prisma.auditLog.findMany({
      where: { entity: "Supplier", entityId: String(supplier.id), action: "MERGE" },
    });
    expect(audits).toHaveLength(1);
    expect(audits[0].actorId).toBe(adminId);
  });

  it("AC3: merging into an already-merged target → 422 TARGET_MERGED", async () => {
    const source = await prisma.supplier.create({ data: { name: `MERGE THIRD PARTY ${stamp}` } });
    const r = await routes();
    // Target = UNIGULF supplier which is now merged (AC2 merged it? no — AC2 used other rows).
    // Use explicit chain: merge source -> A (A already merged into B by nothing yet)…
    // Deterministic setup: first merge B->? Not needed; use AC2's merged pair via fresh chain:
    const s1 = await prisma.supplier.create({ data: { name: `CHAIN ONE ${stamp}` } });
    const s2 = await prisma.supplier.create({ data: { name: `CHAIN TWO ${stamp}` } });
    await r.merge.POST(
      req("POST", `/api/v1/suppliers/${s1.id}/merge`, adminCookie, { targetId: s2.id }),
      { params: Promise.resolve({ id: String(s1.id) }) },
    );
    // Now s2 is itself a valid target; attempt to merge INTO the already-merged s1:
    const bad = await r.merge.POST(
      req("POST", `/api/v1/suppliers/${source.id}/merge`, adminCookie, { targetId: s1.id }),
      { params: Promise.resolve({ id: String(source.id) }) },
    );
    expect(bad.status).toBe(422);
    expect((await bad.json()).error.code).toBe("TARGET_MERGED");
  });

  it("AC5: suggestions endpoint returns known typo pairs as advisory data", async () => {
    const clean = await prisma.supplier.create({
      data: { name: `Silver Waves Electrical Equip ${stamp}` },
    });
    const typo = await prisma.supplier.create({
      data: { name: `Silver Waves Elelctrical Equip ${stamp}` }, // real misspelling pattern from Job 1571 log
    });

    const r = await routes();
    const res = await r.suggestions.GET(
      new Request("http://localhost/api/v1/suppliers/duplicates/suggestions", {
        headers: { cookie: adminCookie },
      }),
    );
    expect(res.status).toBe(200);
    const items = (await res.json()).items as {
      a: { id: number };
      b: { id: number };
      score: number;
    }[];
    expect(items.length).toBeGreaterThan(0);
    for (const p of items) {
      expect(p.a).toBeDefined();
      expect(p.b).toBeDefined();
      expect(p.score).toBeGreaterThanOrEqual(0.6);
    }
    // The seeded typo pair is among the suggestions (either direction).
    const found = items.some(
      (p) =>
        (p.a.id === clean.id && p.b.id === typo.id) || (p.a.id === typo.id && p.b.id === clean.id),
    );
    expect(found).toBe(true);
  });
});
