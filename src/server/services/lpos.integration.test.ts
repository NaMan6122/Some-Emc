import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { hash } from "@node-rs/argon2";
import { prisma } from "@/server/db";
import { signSessionToken } from "@/server/auth/jwt";

// spec-007-v1 acceptance criteria — headless integration against live routes.

const stamp = Date.now().toString(36);
const code = `L${stamp}`;
let projectId = 0;
let supplierId = 0;
let otherProjectId = 0;
let voId = "";
const cookies: Record<string, string> = {};

function req(method: string, path: string, role: string, body?: unknown): Request {
  return new Request(`http://localhost${path}`, {
    method,
    headers: { "content-type": "application/json", ...(cookies[role] ? { cookie: cookies[role] } : {}) },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

async function routes() {
  return {
    lpos: await import("@/app/api/v1/projects/[id]/lpos/route"),
    exportCsv: await import("@/app/api/v1/projects/[id]/lpos/export/route"),
    item: await import("@/app/api/v1/lpos/[id]/route"),
  };
}

beforeAll(async () => {
  async function user(email: string, role: "ADMIN" | "PROCUREMENT" | "COMMERCIAL" | "VIEWER" | "FINANCE" | "MANAGEMENT") {
    const u = await prisma.user.create({
      data: { email, name: role, role, passwordHash: await hash("unused") },
    });
    const token = await signSessionToken({ uid: u.id, role, tv: u.tokenVersion });
    cookies[role] = `procare_session=${token}`;
  }
  await Promise.all([
    user(`lpo-admin-${stamp}@t.local`, "ADMIN"),
    user(`lpo-proc-${stamp}@t.local`, "PROCUREMENT"),
    user(`lpo-comm-${stamp}@t.local`, "COMMERCIAL"),
    user(`lpo-view-${stamp}@t.local`, "VIEWER"),
    user(`lpo-fin-${stamp}@t.local`, "FINANCE"),
    user(`lpo-mgmt-${stamp}@t.local`, "MANAGEMENT"),
  ]);

  const [p1, p2] = await prisma.$transaction([
    prisma.project.create({
      data: { code, name: "LPO fixture", mainContractor: "X", contractValueFils: 100n },
    }),
    prisma.project.create({
      data: { code: `M${stamp}`, name: "Other project", mainContractor: "X", contractValueFils: 100n },
    }),
  ]);
  projectId = p1.id;
  otherProjectId = p2.id;

  const supplier = await prisma.supplier.create({ data: { name: `LPO SUPPLIER ${stamp}` } });
  supplierId = supplier.id;
});

afterAll(async () => {
  const projs = await prisma.project.findMany({ where: { code: { in: [code, `M${stamp}`] } } });
  await prisma.dataFlag.deleteMany({ where: { entityType: "Lpo" } });
  await prisma.auditLog.deleteMany({ where: { entity: { in: ["Lpo", "VariationOrder"] } } });
  await prisma.lpo.deleteMany({ where: { projectId: { in: projs.map((p) => p.id) } } });
  await prisma.variationOrder.deleteMany({ where: { projectId: { in: projs.map((p) => p.id) } } });
  await prisma.supplier.deleteMany({ where: { name: `LPO SUPPLIER ${stamp}` } });
  await prisma.project.deleteMany({ where: { id: { in: projs.map((p) => p.id) } } });
  await prisma.user.deleteMany({ where: { email: { contains: `-lpo-${stamp}@` } } });
  await prisma.$disconnect();
});

async function createIssued(overrides?: Record<string, unknown>) {
  const r = await routes();
  const res = await r.lpos.POST(
    req("POST", `/api/v1/projects/${projectId}/lpos`, "PROCUREMENT", {
      supplierId,
      trade: "ELECTRICAL",
      description: "Lv Power Cables",
      issueDate: "2025-06-02T00:00:00.000Z",
      amountFils: "100000.00",
      status: "ISSUED",
      ...overrides,
    }),
    { params: Promise.resolve({ id: String(projectId) }) },
  );
  return { res, body: res.status === 201 ? await res.json() : null };
}

describe("spec-007-v1 LPO register", () => {
  it("AC1: concurrent creation never yields duplicate refs", async () => {
    const r = await routes();
    const payload = {
      supplierId,
      trade: "PLUMBING",
      description: "concurrency probe",
      issueDate: "2025-06-03T00:00:00.000Z",
      amountFils: "10.00",
      status: "ISSUED",
    };
    const results = await Promise.all(
      Array.from({ length: 2 }, () =>
        r.lpos.POST(req("POST", `/api/v1/projects/${projectId}/lpos`, "PROCUREMENT", payload), {
          params: Promise.resolve({ id: String(projectId) }),
        }),
      ),
    );
    const created = results.filter((r2) => r2.status === 201);
    expect(created.length).toBeGreaterThanOrEqual(1);
    const refs = await Promise.all(created.map((r2) => r2.json().then((b) => b.refNo as string)));
    expect(new Set(refs).size).toBe(refs.length); // all unique
    const nonCreated = results.filter((r2) => r2.status !== 201);
    for (const r2 of nonCreated) expect(r2.status).toBe(409);
  });

  it("AC2: financial PATCH on ISSUED creates successor; predecessor superseded; totals latest-only", async () => {
    const { body } = await createIssued();
    const originalId = body.id as string;
    const r = await routes();

    const patched = await r.item.PATCH(
      req("PATCH", `/api/v1/lpos/${originalId}`, "PROCUREMENT", { amountFils: "120000.00" }),
      { params: Promise.resolve({ id: originalId }) },
    );
    expect(patched.status).toBe(200);
    const successor = await patched.json();
    expect(successor.revisionNo).toBe(1);

    const oldRow = await prisma.lpo.findUniqueOrThrow({ where: { id: BigInt(originalId) } });
    expect(oldRow.supersededById).toBe(BigInt(successor.id));
    expect(oldRow.amountFils).toBe(10000000n); // immutable history

    // Default list hides superseded; includeSuperseded reveals the chain.
    const listDefault = await r.lpos.GET(
      new Request(`http://localhost/api/v1/projects/${projectId}/lpos?q=LV POWER CABLES`, {
        headers: { cookie: cookies.VIEWER },
      }),
      { params: Promise.resolve({ id: String(projectId) }) },
    );
    const listBody = await listDefault.json();
    expect(listBody.items).toHaveLength(1);
    expect(listBody.items[0].revisionNo).toBe(1);
    expect(listBody.totals.activeSumFils).toBe("12000000");

    const listAll = await r.lpos.GET(
      new Request(
        `http://localhost/api/v1/projects/${projectId}/lpos?q=LV POWER CABLES&includeSuperseded=true&sort=issueDate`,
        { headers: { cookie: cookies.VIEWER } },
      ),
      { params: Promise.resolve({ id: String(projectId) }) },
    );
    expect((await listAll.json()).items).toHaveLength(2);

    // Chain via GET /lpos/:id on the ORIGINAL (predecessor) still resolves.
    const chainRes = await r.item.GET(
      new Request(`http://localhost/api/v1/lpos/${originalId}`, { headers: { cookie: cookies.VIEWER } }),
      { params: Promise.resolve({ id: originalId }) },
    );
    const chain = (await chainRes.json()).chain;
    expect(chain).toHaveLength(2);
    expect(chain[0].supersededById ?? null).toBe(chain[1]?.id ?? null);
  });

  it("AC3: descriptive-only PATCH edits in place and audits without a revision", async () => {
    const { body } = await createIssued();
    const id = body.id as string;
    const r = await routes();
    const res = await r.item.PATCH(
      req("PATCH", `/api/v1/lpos/${id}`, "PROCUREMENT", { remark: "site note" }),
      { params: Promise.resolve({ id }) },
    );
    expect(res.status).toBe(200);
    const updated = await res.json();
    expect(updated.id).toBe(id); // same row
    expect(updated.revisionNo).toBe(0);
    const audits = await prisma.auditLog.findMany({
      where: { entity: "Lpo", entityId: id, action: "UPDATE" },
    });
    expect(audits).toHaveLength(1);
  });

  it("AC4: CANCELLED excluded from totals but visible with status filter", async () => {
    const { body } = await createIssued();
    const id = body.id as string;
    const before = await prisma.lpo.findUniqueOrThrow({ where: { id: BigInt(id) } });
    void before;
    const r = await routes();
    await r.item.PATCH(
      req("PATCH", `/api/v1/lpos/${id}`, "PROCUREMENT", { status: "CANCELLED" }),
      { params: Promise.resolve({ id }) },
    );
    const list = await r.lpos.GET(
      new Request(`http://localhost/api/v1/projects/${projectId}/lpos?status=CANCELLED`, {
        headers: { cookie: cookies.VIEWER },
      }),
      { params: Promise.resolve({ id: String(projectId) }) },
    );
    const lb = await list.json();
    expect(lb.items.some((i: { id: string }) => i.id === id)).toBe(true);
    // With an explicit CANCELLED filter, totals reflect that filtered set:
    expect(lb.totals.activeCount).toBe(lb.items.length);
    // And the default (unfiltered) totals exclude cancelled rows entirely:
    const all = await r.lpos.GET(
      new Request(`http://localhost/api/v1/projects/${projectId}/lpos`, {
        headers: { cookie: cookies.VIEWER },
      }),
      { params: Promise.resolve({ id: String(projectId) }) },
    );
    const allBody = await all.json();
    // Default totals equal the sum of non-cancelled items returned (latest revisions only).
    const expectedSum = allBody.items
      .filter((i: { status: string }) => i.status !== "CANCELLED")
      .reduce((a: number, i: { amountFils: string }) => a + Number(i.amountFils), 0);
    expect(Number(allBody.totals.activeSumFils)).toBe(expectedSum);
    expect(allBody.items.some((i: { status: string }) => i.status === "CANCELLED")).toBe(true);
  });

  it("AC5: VARIATION linkage validated (missing / foreign / wrong-kind)", async () => {
    const vo = await prisma.variationOrder.create({
      data: {
        projectId: otherProjectId,
        voNumber: 1,
        title: "Foreign VO",
        submittedValueFils: 1000n,
      },
    });
    const r = await routes();
    const base = {
      supplierId,
      trade: "GENERAL",
      description: "var probe",
      issueDate: "2025-07-01T00:00:00.000Z",
      amountFils: "50.00",
      kind: "VARIATION",
      status: "ISSUED",
    };

    const missing = await r.lpos.POST(
      req("POST", `/api/v1/projects/${projectId}/lpos`, "PROCUREMENT", base),
      { params: Promise.resolve({ id: String(projectId) }) },
    );
    expect(missing.status).toBe(422);

    const foreign = await r.lpos.POST(
      req("POST", `/api/v1/projects/${projectId}/lpos`, "PROCUREMENT", { ...base, voId: vo.id.toString() }),
      { params: Promise.resolve({ id: String(projectId) }) },
    );
    expect(foreign.status).toBe(422);
    expect(((await foreign.json()).error.code)).toBe("VO_INVALID");

    const own = await prisma.variationOrder.create({
      data: { projectId, voNumber: 1, title: "Own VO", submittedValueFils: 2000n },
    });
    voId = own.id.toString();

    const wrongKind = await r.lpos.POST(
      req("POST", `/api/v1/projects/${projectId}/lpos`, "PROCUREMENT", {
        supplierId,
        trade: "GENERAL",
        description: "std with vo",
        issueDate: "2025-07-01T00:00:00.000Z",
        amountFils: "50.00",
        status: "DRAFT",
        voId,
      }),
      { params: Promise.resolve({ id: String(projectId) }) },
    );
    expect(wrongKind.status).toBe(422);
    expect((await wrongKind.json()).error.code).toBe("KIND_VO_CONFLICT");
  });

  it("valid variation links to same-project VO; COMMERCIAL may re-point voId only", async () => {
    const { body } = await createIssued({ kind: "VARIATION", voId });
    const id = body.id as string;
    const r = await routes();

    const commBad = await r.item.PATCH(
      req("PATCH", `/api/v1/lpos/${id}`, "COMMERCIAL", { description: "nope" }),
      { params: Promise.resolve({ id }) },
    );
    expect(commBad.status).toBe(403);

    const vo2 = await prisma.variationOrder.create({
      data: { projectId, voNumber: 2, title: "Second VO", submittedValueFils: 3000n },
    });
    const commGood = await r.item.PATCH(
      req("PATCH", `/api/v1/lpos/${id}`, "COMMERCIAL", { voId: vo2.id.toString() }),
      { params: Promise.resolve({ id }) },
    );
    expect(commGood.status).toBe(200);
  });

  it("AC6: FLAGGED requires a real note; flag lifecycle opens/resolves DataFlags", async () => {
    const { body } = await createIssued();
    const id = body.id as string;
    const r = await routes();

    const noNote = await r.item.PATCH(
      req("PATCH", `/api/v1/lpos/${id}`, "PROCUREMENT", { verification: "FLAGGED" }),
      { params: Promise.resolve({ id }) },
    );
    expect(noNote.status).toBe(422);

    const flagged = await r.item.PATCH(
      req("PATCH", `/api/v1/lpos/${id}`, "PROCUREMENT", { verification: "FLAGGED", flagNote: "manhole value needs check" }),
      { params: Promise.resolve({ id }) },
    );
    expect(flagged.status).toBe(200);
    // spec-010 AC6 (drawer): chain response carries the open flag note.
    const flaggedChain = await (await r.item.GET(
      new Request(`http://localhost/api/v1/lpos/${id}`, { headers: { cookie: cookies.PROCUREMENT } }),
      { params: Promise.resolve({ id }) },
    )).json();
    expect(flaggedChain.flagNote).toBe("manhole value needs check");
    const openFlag = await prisma.dataFlag.findFirst({
      where: { entityType: "Lpo", entityId: id, ruleCode: "VERIFICATION_FLAGGED", status: "OPEN" },
    });
    expect(openFlag?.message).toBe("manhole value needs check");

    await r.item.PATCH(
      req("PATCH", `/api/v1/lpos/${id}`, "PROCUREMENT", { verification: "VERIFIED" }),
      { params: Promise.resolve({ id }) },
    );
    const resolved = await prisma.dataFlag.findFirstOrThrow({
      where: { entityType: "Lpo", entityId: id },
    });
    expect(resolved.status).toBe("RESOLVED");
    expect(resolved.resolvedAt).not.toBeNull();
  });

  it("AC7: CSV export matches filtered API result exactly", async () => {
    const r = await routes();
    const query = "trade=ELECTRICAL"; // excludes PLUMBING concurrency probe & cancelled GENERAL etc.
    const jsonList = await r.lpos.GET(
      new Request(`http://localhost/api/v1/projects/${projectId}/lpos?${query}`, {
        headers: { cookie: cookies.VIEWER },
      }),
      { params: Promise.resolve({ id: String(projectId) }) },
    );
    const expected = (await jsonList.json()).items as { refNo: string; status: string }[];

    const csv = await r.exportCsv.GET(
      new Request(`http://localhost/api/v1/projects/${projectId}/lpos/export?${query}`, {
        headers: { cookie: cookies.VIEWER },
      }),
      { params: Promise.resolve({ id: String(projectId) }) },
    );
    expect(csv.headers.get("content-type")).toContain("text/csv");
    const text = await csv.text();
    const lines = text.split("\n").filter(Boolean);
    expect(lines[0]).toContain("refNo,revisionNo,supplier");
    expect(lines.length - 1).toBe(expected.length);
    for (const item of expected) {
      expect(text).toContain(item.refNo);
    }
  });

  it("AC8: FINANCE/MANAGEMENT/VIEWER mutations → 403", async () => {
    const { body } = await createIssued();
    const id = body.id as string;
    const r = await routes();
    for (const role of ["FINANCE", "MANAGEMENT", "VIEWER"]) {
      const res = await r.item.PATCH(
        req("PATCH", `/api/v1/lpos/${id}`, role, { remark: "not allowed" }),
        { params: Promise.resolve({ id }) },
      );
      expect(res.status).toBe(403);
    }
  });

  it("bad status transitions rejected (CLOSED → CANCELLED)", async () => {
    const { body } = await createIssued();
    const id = body.id as string;
    const r = await routes();
    await r.item.PATCH(req("PATCH", `/api/v1/lpos/${id}`, "PROCUREMENT", { status: "CLOSED" }), {
      params: Promise.resolve({ id }),
    });
    const bad = await r.item.PATCH(
      req("PATCH", `/api/v1/lpos/${id}`, "PROCUREMENT", { status: "CANCELLED" }),
      { params: Promise.resolve({ id }) },
    );
    expect(bad.status).toBe(422);
    expect((await bad.json()).error.code).toBe("BAD_TRANSITION");
  });
});
