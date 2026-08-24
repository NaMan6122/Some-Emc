import { execSync } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/server/db";
import { signSessionToken } from "@/server/auth/jwt";

// spec-018-v1 integration suite — read-only exports over the seeded project;
// no fixtures created.
let projectId = 0;
let adminCookie = "";
let viewerCookie = "";

function req(method: string, path: string, cookie?: string) {
  return new Request("http://localhost" + path, {
    method,
    headers: {
      "content-type": "application/json",
      ...(cookie ? { cookie } : {}),
    },
  });
}

async function cookieFor(email: string): Promise<string> {
  const user = await prisma.user.findUniqueOrThrow({ where: { email } });
  return "procare_session=" + (await signSessionToken({ uid: user.id, role: user.role, tv: user.tokenVersion }));
}

/** Minimal RFC-4180 parser (quoted cells contain commas in money strings). */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') {
        inQuotes = false;
      } else {
        cell += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(cell);
      cell = "";
    } else if (c === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += c;
    }
  }
  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

const EXPORT_ROUTES: Record<string, { GET: (r: Request, c: { params: Promise<{ id: string }> }) => Promise<Response> }> = {};

async function loadRoutes() {
  EXPORT_ROUTES["pcs.csv"] = await import("@/app/api/v1/projects/[id]/export/pcs.csv/route");
  EXPORT_ROUTES["variance.csv"] = await import("@/app/api/v1/projects/[id]/export/variance.csv/route");
  EXPORT_ROUTES["budget-lines.csv"] = await import("@/app/api/v1/projects/[id]/export/budget-lines.csv/route");
  EXPORT_ROUTES["vos.csv"] = await import("@/app/api/v1/projects/[id]/export/vos.csv/route");
  EXPORT_ROUTES["flags.csv"] = await import("@/app/api/v1/projects/[id]/export/flags.csv/route");
}

async function get(path: string, cookie?: string): Promise<Response> {
  const name = path.split("?")[0].split("/").pop()!;
  const mod = EXPORT_ROUTES[name];
  if (!mod) throw new Error(`No export route loaded for ${name}`);
  return mod.GET(req("GET", `/api/v1/projects/${projectId}${path}`, cookie), {
    params: Promise.resolve({ id: String(projectId) }),
  });
}

beforeAll(async () => {
  execSync("npm run --silent seed:job1571", { stdio: "pipe", env: process.env });
  projectId = (await prisma.project.findUniqueOrThrow({ where: { code: "1571" } })).id;
  adminCookie = await cookieFor("admin@trends.local");
  viewerCookie = await cookieFor("viewer@trends.local");
  await loadRoutes();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("spec-018 CSV exports", () => {
  it("AC1: pcs.csv — 14 rows, fils-exact AED cells, PC03 retention zero", async () => {
    const res = await get("/export/pcs.csv", adminCookie);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/csv; charset=utf-8");
    const rows = parseCsv(await res.text());
    expect(rows[0]).toEqual([
      "pcNumber", "periodLabel", "invoiceDate", "grossAED", "retentionAED",
      "netPayableAED", "variationClaimAED", "status", "provenance",
    ]);
    expect(rows).toHaveLength(15);
    const byNumber = new Map(rows.slice(1).map((r) => [r[0], r]));
    expect(byNumber.get("3")![4]).toBe("AED 0.00"); // source said "n/a" → stored 0
    expect(byNumber.get("7")![6]).toBe("AED 55,665.00"); // dataset variation claim
    // Status cells must match the seeded dataset exactly.
    const pc14 = await prisma.paymentCertificate.findUniqueOrThrow({
      where: { projectId_pcNumber: { projectId, pcNumber: 14 } },
      select: { status: true },
    });
    expect(byNumber.get("14")![7]).toBe(pc14.status);
  });

  it("AC2: variance.csv figures byte-match the variance JSON endpoint", async () => {
    const { GET } = await import("@/app/api/v1/projects/[id]/variance/route");
    const jsonRes = await GET(req("GET", `/api/v1/projects/${projectId}/variance`, adminCookie), {
      params: Promise.resolve({ id: String(projectId) }),
    });
    const items = (await jsonRes.json()).items as { trade: string; budgetFils: string; committedFils: string; utilizationPct: number; status: string }[];

    const csvRes = await get("/export/variance.csv", adminCookie);
    const rows = parseCsv(await csvRes.text());
    expect(rows[0]).toEqual(["trade", "budgetAED", "committedAED", "utilizationPct", "status"]);
    const byTrade = new Map(rows.slice(1).map((r) => [r[0], r]));
    expect(rows).toHaveLength(items.length + 1);

    const fmt = (filsStr: string) =>
      "AED " + (BigInt(filsStr) / 100n).toLocaleString("en-US") + "." + (BigInt(filsStr) % 100n).toString().padStart(2, "0");
    for (const item of items) {
      const r = byTrade.get(item.trade)!;
      expect(`${r[1]}|${r[2]}|${r[3]}|${r[4]}`).toBe(
        `${fmt(item.budgetFils)}|${fmt(item.committedFils)}|${String(item.utilizationPct)}|${item.status}`,
      );
    }
    // Spot golden: Electrical under at ~85%.
    expect(byTrade.get("ELECTRICAL")![4]).toBe("under");
  });

  it("AC3: budget-lines.csv carries the three JCA lines; vos.csv header-only on empty register", async () => {
    const bl = await get("/export/budget-lines.csv", adminCookie);
    const rows = parseCsv(await bl.text());
    expect(rows[0]).toEqual(["trade", "category", "amountAED", "sourceLabel", "refDate", "note"]);
    expect(rows).toHaveLength(4);
    expect(rows[1].join(",")).toContain("AED 7,000,000.00");

    const vos = await get("/export/vos.csv", adminCookie);
    const vRows = parseCsv(await vos.text());
    expect(vRows[0][0]).toBe("voNumber");
    expect(vRows).toHaveLength(1); // seeded Job 1571 has zero VO rows
  });

  it("AC4: suppliers.csv honors ?q= with aliases/lpoCount/mergedIntoId columns", async () => {
    const { GET } = await import("@/app/api/v1/suppliers/export.csv/route");
    const res = await GET(req("GET", "/api/v1/suppliers/export.csv?q=SILVER", adminCookie));
    expect(res.status).toBe(200);
    const rows = parseCsv(await res.text());
    expect(rows[0]).toEqual(["id", "name", "aliases", "mergedIntoId", "lpoCount"]);
    expect(rows.length).toBeGreaterThanOrEqual(2);
    for (const r of rows.slice(1)) {
      expect(r[1]).toContain("SILVER");
      expect(() => JSON.parse(r[2])).not.toThrow();
    }

    const all = await GET(req("GET", "/api/v1/suppliers/export.csv", adminCookie));
    const allRows = parseCsv(await all.text());
    expect(allRows.length - 1).toBeGreaterThan(rows.length - 1);
  });

  it("AC5: gates and validation — VIEWER audit.csv 403, ADMIN filter honored, unauth 401, malformed 422", async () => {
    const auditRoute = await import("@/app/api/v1/audit.csv/route");

    const denied = await auditRoute.GET(req("GET", "/api/v1/audit.csv", viewerCookie));
    expect(denied.status).toBe(403);

    const filtered = await auditRoute.GET(req("GET", "/api/v1/audit.csv?entity=DataFlag", adminCookie));
    expect(filtered.status).toBe(200);
    const rows = parseCsv(await filtered.text());
    expect(rows.length).toBeGreaterThan(1);
    for (const r of rows.slice(1)) expect(r[3]).toBe("DataFlag");

    const unauth = await auditRoute.GET(req("GET", "/api/v1/audit.csv"));
    expect(unauth.status).toBe(401);

    const malformed = await auditRoute.GET(req("GET", "/api/v1/audit.csv?from=not-a-date", adminCookie));
    expect(malformed.status).toBe(422);

    for (const path of ["/export/pcs.csv", "/export/variance.csv", "/export/budget-lines.csv", "/export/vos.csv", "/export/flags.csv"]) {
      const r = await get(path, undefined);
      expect(r.status).toBe(401);
    }
  });

  it("flags.csv honors ruleCode filter and includes triage state", async () => {
    // Hermetic fixture: other suites purge the scan ruleCodes in their
    // afterAll, so this test owns a stamp-unique flag instead.
    const created = await prisma.dataFlag.create({
      data: { entityType: "Project", entityId: "csvspec-fixture", ruleCode: "CSV_SPEC", severity: "LOW", message: "csv fixture", status: "OPEN" },
    });
    try {
      const res = await get("/export/flags.csv?ruleCode=CSV_SPEC", adminCookie);
      const rows = parseCsv(await res.text());
      expect(rows[0]).toContain("resolutionNote");
      expect(rows).toHaveLength(2);
      expect(rows[1][1]).toBe("CSV_SPEC");
    } finally {
      await prisma.dataFlag.delete({ where: { id: created.id } });
    }
  });
});
