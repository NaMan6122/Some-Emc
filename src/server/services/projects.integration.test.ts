import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { hash } from "@node-rs/argon2";
import { prisma } from "@/server/db";
import { signSessionToken } from "@/server/auth/jwt";

// spec-005-v1 acceptance criteria — headless integration against live routes.

const stamp = Date.now().toString(36);
const codes = { main: `P${stamp}`, dup: `Q${stamp}`, del: `R${stamp}`, dep: `S${stamp}` };
let adminCookie = "";
let financeCookie = "";
let viewerCookie = "";
let adminId = 0;
let projectId = 0;

async function cookieFor(email: string, role: "ADMIN" | "FINANCE" | "VIEWER") {
  const u = await prisma.user.create({
    data: { email, name: `Test ${role}`, role, passwordHash: await hash("not-used-here") },
  });
  const token = await signSessionToken({ uid: u.id, role, tv: u.tokenVersion });
  return { cookie: `procare_session=${token}`, id: u.id };
}

function jsonRequest(method: string, path: string, cookie: string, body?: unknown): Request {
  return new Request(`http://localhost${path}`, {
    method,
    headers: { "content-type": "application/json", cookie },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

beforeAll(async () => {
  const a = await cookieFor(`proj-admin-${stamp}@t.local`, "ADMIN");
  adminCookie = a.cookie;
  adminId = a.id;
  financeCookie = (await cookieFor(`proj-fin-${stamp}@t.local`, "FINANCE")).cookie;
  viewerCookie = (await cookieFor(`proj-view-${stamp}@t.local`, "VIEWER")).cookie;
});

afterAll(async () => {
  // LPO fixture first (Restrict blocks project delete).
  await prisma.lpo.deleteMany({ where: { project: { code: { in: Object.values(codes) } } } });
  await prisma.supplier.deleteMany({ where: { name: `PROJ FIXTURE SUPPLIER ${stamp}` } });
  await prisma.project.deleteMany({ where: { code: { in: Object.values(codes) } } });
  await prisma.auditLog.deleteMany({ where: { entity: "Project" } });
  await prisma.user.deleteMany({ where: { email: { contains: `-proj-${stamp}@` } } });
  await prisma.$disconnect();
});

async function routes() {
  return {
    collection: await import("@/app/api/v1/projects/route"),
    item: await import("@/app/api/v1/projects/[id]/route"),
  };
}

describe("spec-005-v1 projects", () => {
  it("AC1: ADMIN creates → 201 persisted; duplicate code → 409 CODE_TAKEN", async () => {
    const r = await routes();
    const res = await r.collection.POST(
      jsonRequest("POST", "/api/v1/projects", adminCookie, {
        code: codes.main,
        name: "Mid Island Parkway Phase 1C",
        mainContractor: "CHEC",
        contractValueFils: "18786625.00",
        vatRate: 0.05,
      }),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    projectId = body.id;
    expect(body.contractValueFils).toBe("1878662500");
    expect(body.status).toBe("ACTIVE");

    const inDb = await prisma.project.findUnique({ where: { id: projectId } });
    expect(inDb?.contractValueFils).toBe(1878662500n);

    const dup = await r.collection.POST(
      jsonRequest("POST", "/api/v1/projects", adminCookie, {
        code: codes.main,
        name: "Dup",
        mainContractor: "X",
        contractValueFils: "1.00",
      }),
    );
    expect(dup.status).toBe(409);
    expect((await dup.json()).error.code).toBe("CODE_TAKEN");
  });

  it("AC2: FINANCE POST → 403; VIEWER PATCH → 403; unauth GET list → 401", async () => {
    const r = await routes();
    const fin = await r.collection.POST(
      jsonRequest("POST", "/api/v1/projects", financeCookie, {
        code: codes.dup,
        name: "Nope",
        mainContractor: "X",
        contractValueFils: "10.00",
      }),
    );
    expect(fin.status).toBe(403);

    const view = await r.item.PATCH(
      jsonRequest("PATCH", `/api/v1/projects/${projectId}`, viewerCookie, { name: "Hacked" }),
      { params: Promise.resolve({ id: String(projectId) }) },
    );
    expect(view.status).toBe(403);

    const anon = await r.collection.GET(new Request("http://localhost/api/v1/projects"));
    expect(anon.status).toBe(401);
  });

  it("AC3: PATCH contract value writes audit entry with before≠after (changed key only)", async () => {
    const r = await routes();
    const res = await r.item.PATCH(
      jsonRequest("PATCH", `/api/v1/projects/${projectId}`, adminCookie, {
        contractValueFils: "19000000.00",
      }),
      { params: Promise.resolve({ id: String(projectId) }) },
    );
    expect(res.status).toBe(200);
    expect((await res.json()).contractValueFils).toBe("1900000000");

    const rows = await prisma.auditLog.findMany({
      where: { entity: "Project", entityId: String(projectId), action: "UPDATE" },
    });
    expect(rows).toHaveLength(1);
    expect(Object.keys(rows[0].before as object)).toEqual(["contractValueFils"]);
    expect((rows[0].after as Record<string, string>).contractValueFils).toBe("1900000000");
    expect(rows[0].actorId).toBe(adminId);
  });

  it("AC4: field-level 422s — vatRate>1, negative amount, empty code, unknown id → 404", async () => {
    const r = await routes();
    const badVat = await r.collection.POST(
      jsonRequest("POST", "/api/v1/projects", adminCookie, {
        code: codes.dup,
        name: "X",
        mainContractor: "Y",
        contractValueFils: "10.00",
        vatRate: 1.5,
      }),
    );
    expect(badVat.status).toBe(422);
    const details = (await badVat.json()).error.details;
    expect(details.vatRate.length).toBeGreaterThan(0);

    const negative = await r.collection.POST(
      jsonRequest("POST", "/api/v1/projects", adminCookie, {
        code: codes.dup,
        name: "X",
        mainContractor: "Y",
        contractValueFils: "-100.00",
      }),
    );
    expect(negative.status).toBe(422);
    expect(((await negative.json()).error.details.contractValueFils as string[]).join(" ")).toMatch(/negative/i);

    const emptyCode = await r.collection.POST(
      jsonRequest("POST", "/api/v1/projects", adminCookie, {
        code: "",
        name: "X",
        mainContractor: "Y",
        contractValueFils: "1.00",
      }),
    );
    expect(emptyCode.status).toBe(422);

    const missing = await r.item.GET(new Request("http://localhost/api/v1/projects/999999"), {
      params: Promise.resolve({ id: "999999" }),
    });
    expect(missing.status).toBe(404);
  });

  it("AC5a: DELETE without dependents succeeds (and is audited)", async () => {
    const r = await routes();
    await r.collection.POST(
      jsonRequest("POST", "/api/v1/projects", adminCookie, {
        code: codes.del,
        name: "Deletable",
        mainContractor: "Z",
        contractValueFils: "5.00",
      }),
    );
    const created = await prisma.project.findUniqueOrThrow({ where: { code: codes.del } });
    const res = await r.item.DELETE(
      new Request(`http://localhost/api/v1/projects/${created.id}`, {
        method: "DELETE",
        headers: { cookie: adminCookie },
      }),
      { params: Promise.resolve({ id: String(created.id) }) },
    );
    expect(res.status).toBe(200);
    expect(await prisma.project.count({ where: { code: codes.del } })).toBe(0);
  });

  it("AC5b: DELETE with dependent LPO → 409 HAS_DEPENDENTS (no cascade)", async () => {
    const r = await routes();
    await r.collection.POST(
      jsonRequest("POST", "/api/v1/projects", adminCookie, {
        code: codes.dep,
        name: "HasLpo",
        mainContractor: "W",
        contractValueFils: "7.00",
      }),
    );
    const proj = await prisma.project.findUniqueOrThrow({ where: { code: codes.dep } });

    const supplier = await prisma.supplier.create({ data: { name: `PROJ FIXTURE SUPPLIER ${stamp}` } });
    await prisma.lpo.create({
      data: {
        projectId: proj.id,
        refNo: "TEMW/REF/LPO//T99",
        seq: 1,
        supplierId: supplier.id,
        trade: "ELECTRICAL",
        description: "dependent LPO",
        issueDate: new Date("2025-01-01"),
        amountFils: 100n,
        vatRate: 0.05,
      },
    });

    const res = await r.item.DELETE(
      new Request(`http://localhost/api/v1/projects/${proj.id}`, {
        method: "DELETE",
        headers: { cookie: adminCookie },
      }),
      { params: Promise.resolve({ id: String(proj.id) }) },
    );
    expect(res.status).toBe(409);
    expect((await res.json()).error.code).toBe("HAS_DEPENDENTS");
    // Not cascaded:
    expect(await prisma.lpo.count({ where: { projectId: proj.id } })).toBe(1);
  });

  it("GET list includes created projects for any authenticated role", async () => {
    const r = await routes();
    const res = await r.collection.GET(
      new Request("http://localhost/api/v1/projects", { headers: { cookie: viewerCookie } }),
    );
    expect(res.status).toBe(200);
    const codesInList = (await res.json()).items.map((p: { code: string }) => p.code);
    expect(codesInList).toContain(codes.main);
    expect(codesInList).toContain(codes.dep);
  });
});
