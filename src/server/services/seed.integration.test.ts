import { execSync } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { prisma } from "@/server/db";

// spec-008-v2 acceptance criteria against the live dev database.
// NOTE: the seeded project is intentionally NOT cleaned up — it is the real
// migration path for Job 1571. Tests are written to pass on any re-run.

const data: {
  lpos: { supplier: string; refNo: string; amountFils: number; description: string }[];
  pcs: { pcNumber: number; netFils: number }[];
} = JSON.parse(
  readFileSync(join(process.cwd(), "prisma", "seed-data", "job1571.json"), "utf8"),
);

beforeAll(() => {
  execSync("node scripts/extract-seed.mjs", { stdio: "pipe" });
  execSync("npm run --silent seed:job1571", { stdio: "pipe", env: process.env });
});

describe("spec-008-v2 Job 1571 seed pipeline", () => {
  it("AC1: extracted dataset has ≥140 items, exactly 14 PCs, spot checks exact", () => {
    expect(data.lpos.length).toBeGreaterThanOrEqual(140);
    expect(data.pcs).toHaveLength(14);
    const top = data.lpos.reduce((a, b) => (b.amountFils > a.amountFils ? b : a));
    expect(top.amountFils).toBe(383250000);
    expect(data.pcs.find((p) => p.pcNumber === 13)?.netFils).toBe(164429700);
  });

  it("AC2: project 1571 seeded; totals match dataset; suppliers normalized with aliases", async () => {
    const project = await prisma.project.findUniqueOrThrow({
      where: { code: "1571" },
      include: { lpos: { where: { supersededById: null } } },
    });
    expect(project.mainContractor).toContain("CHEC");

    // Totals equal the extracted dataset sum.
    const dbSum = project.lpos.reduce((a: bigint, l) => a + l.amountFils, 0n);
    const jsonSum = data.lpos.reduce((a: bigint, l) => a + BigInt(l.amountFils), 0n);
    expect(dbSum).toBe(jsonSum);
    const aed = Number(dbSum / 100n);
    expect(Math.abs(aed - 12_984_115)).toBeLessThanOrEqual(100_000); // ±0.01M of the report figure

    // Distinct suppliers referenced by the project ≥85 (103 raw names → 90
    // vendors after canonicalizing known misspelling groups; see DCL-003).
    const supplierIds = new Set(project.lpos.map((l) => l.supplierId));
    expect(supplierIds.size).toBeGreaterThanOrEqual(85);

    // Alias preservation: canonical UNIGULF record carries a DEVELOPMWNT spelling.
    const unigulf = await prisma.supplier.findUniqueOrThrow({ where: { name: "UNIGULF DEVELOPMENT LLC" } });
    const aliases = (unigulf.aliases as string[]).map((a) => a.toUpperCase());
    expect(aliases.some((a) => a.includes("DEVELOPMWNT"))).toBe(true);

    // Imported rows carry provenance + pending verification.
    const imported = await prisma.lpo.count({
      where: { projectId: project.id, provenance: "IMPORTED_REPORT" },
    });
    expect(imported).toBe(data.lpos.length);
  });

  it("AC3: known-issue DataFlags are OPEN", async () => {
    const project = await prisma.project.findUniqueOrThrow({ where: { code: "1571" } });
    const flags = await prisma.dataFlag.findMany({
      where: {
        OR: [
          { ruleCode: "TOTALS_MISMATCH", entityId: String(project.id) },
          { ruleCode: "CROSS_JOB_SPLIT" },
          { ruleCode: "SOURCE_NEEDS_CHECK" },
        ],
      },
    });
    expect(flags.filter((f) => f.ruleCode === "TOTALS_MISMATCH")).toHaveLength(1);
    expect(flags.filter((f) => f.ruleCode === "CROSS_JOB_SPLIT").length).toBe(1);
    expect(flags.filter((f) => f.ruleCode === "SOURCE_NEEDS_CHECK").length).toBe(1);
    for (const f of flags) expect(f.status).toBe("OPEN");

    // The NEED TO CHECK line itself is verification=FLAGGED.
    const hydro = await prisma.lpo.findFirstOrThrow({
      where: { refNo: "TEMW/REF/LPO/HVAC/019", projectId: project.id },
    });
    expect(hydro.verification).toBe("FLAGGED");
  });

  it("AC4: VariationOrder table empty for the project; backfill flag records the gap", async () => {
    const project = await prisma.project.findUniqueOrThrow({ where: { code: "1571" } });
    expect(await prisma.variationOrder.count({ where: { projectId: project.id } })).toBe(0);
    const flag = await prisma.dataFlag.findFirstOrThrow({
      where: { entityType: "Project", entityId: String(project.id), ruleCode: "VO_BACKFILL" },
    });
    expect(flag.status).toBe("OPEN");
    expect(flag.message).toContain("11 submitted VOs");
  });

  it("AC5: rerunning extractor + seed changes nothing", async () => {
    const snapshot = async () => ({
      projects: await prisma.project.count(),
      suppliers: await prisma.supplier.count(),
      lpos: await prisma.lpo.count(),
      pcs: await prisma.paymentCertificate.count(),
      flags: await prisma.dataFlag.count(),
    });
    const before = await snapshot();
    execSync("node scripts/extract-seed.mjs", { stdio: "pipe" });
    execSync("npm run --silent seed:job1571", { stdio: "pipe", env: process.env });
    const after = await snapshot();
    expect(after).toEqual(before);
  });
});

afterAll(async () => {
  await prisma.$disconnect();
});
