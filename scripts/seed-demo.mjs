#!/usr/bin/env node
// T-046 (spec-025..028 adoption): demo data seeder for the newly added features.
//
// Seeds clearly-labelled DEMO data so the UI is alive for walkthroughs, while
// real backfill continues to arrive via scripts/import-backfill.mjs:
//   1. CostLines  — one budget per category (LABOUR_INHOUSE, LABOUR_SUBCONTRACT,
//                   SUPERVISION, ADMIN, DLP), sourceLabel prefixed "DEMO – ".
//   2. CostEntries— monthly INVOICE + PAYMENT pairs Jan–Aug of the current year,
//                   some linked to a real supplier/LPO for ledger realism.
//   3. Payment cycle dates — first 5 PCs missing applicationDate get a realistic
//                   certify→apply→due→received chain (last PC left unpaid).
//   4. LPO schedule — up to 12 active LPOs missing indent/delivery dates.
//
// Every touched row id is recorded in prisma/demo-manifest.json.
// `node scripts/seed-demo.mjs --purge` reverses EXACTLY those rows (deletes demo
// cost rows, nulls the demo PC/LPO dates) — safe on prod Neon.
//
// Run: npm run seed:demo [-- --purge]   (loads .env via --env-file)

import { existsSync, readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { dirname, join } from "node:path";
import { PrismaClient } from "@prisma/client";

const ROOT = join(dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1")), "..");
const MANIFEST = join(ROOT, "prisma", "demo-manifest.json");
const prisma = new PrismaClient();

const PURGE = process.argv.includes("--purge");
const PROJECT_CODE = "1571";
const YEAR = new Date().getUTCFullYear();
const DEMO_PREFIX = "DEMO – ";
const aed = (n) => BigInt(Math.round(n * 100));

const COST_LINE_PLAN = [
  { category: "LABOUR_INHOUSE", amountAED: 2_150_000, note: "In-house manpower deployment" },
  { category: "LABOUR_SUBCONTRACT", amountAED: 3_400_000, note: "Subcontracted labour packages" },
  { category: "SUPERVISION", amountAED: 980_000, note: "Site supervision & engineering" },
  { category: "ADMIN", amountAED: 420_000, note: "Site admin & overheads" },
  { category: "DLP", amountAED: 260_000, note: "Defects liability provisioning" },
];

// Monthly booking profile per category (share of line budget booked by month m, Jan=0).
const monthlyShare = (m) => [0.06, 0.09, 0.12, 0.14, 0.15, 0.16, 0.14, 0.14][m] ?? 0;

async function purge() {
  if (!existsSync(MANIFEST)) {
    console.log("No demo manifest found — nothing to purge.");
    return;
  }
  const m = JSON.parse(readFileSync(MANIFEST, "utf8"));
  const delEntries = m.costEntryIds?.length
    ? await prisma.costEntry.deleteMany({ where: { id: { in: m.costEntryIds.map(BigInt) } } })
    : { count: 0 };
  const delLines = m.costLineIds?.length
    ? await prisma.costLine.deleteMany({ where: { id: { in: m.costLineIds.map(BigInt) } } })
    : { count: 0 };
  let pcs = 0;
  for (const id of m.pcIds ?? []) {
    const r = await prisma.paymentCertificate.updateMany({
      where: { id: BigInt(id), applicationDate: { not: null }, notes: { contains: "[demo-dates]" } },
      data: { applicationDate: null, dueDate: null, paymentReceivedDate: null, notes: null },
    });
    pcs += r.count;
  }
  let lpos = 0;
  for (const id of m.lpoIds ?? []) {
    const r = await prisma.lpo.updateMany({
      where: { id: BigInt(id), indentDate: { not: null }, description: { contains: "[demo-schedule]" } },
      data: { indentDate: null, deliveryDate: null, description: null },
    });
    lpos += r.count;
  }
  unlinkSync(MANIFEST);
  console.log(`Purged demo data: ${delLines.count} cost lines, ${delEntries.count} cost entries, ${pcs} PC date-sets restored to null, ${lpos} LPO schedules cleared.`);
}

async function seed() {
  if (existsSync(MANIFEST)) {
    console.error(`Refusing to seed: ${MANIFEST} already exists. Run 'npm run seed:demo -- --purge' first.`);
    process.exit(1);
  }
  const project = await prisma.project.findUniqueOrThrow({ where: { code: PROJECT_CODE } });

  const manifest = { seededAt: new Date().toISOString(), projectCode: PROJECT_CODE, costLineIds: [], costEntryIds: [], pcIds: [], lpoIds: [] };

  // 1. Cost lines (budgets)
  const lineIds = {};
  for (const p of COST_LINE_PLAN) {
    const row = await prisma.costLine.create({
      data: {
        projectId: project.id,
        category: p.category,
        amountFils: aed(p.amountAED),
        sourceLabel: `${DEMO_PREFIX}${p.note}`,
      },
    });
    lineIds[p.category] = row.id;
    manifest.costLineIds.push(row.id.toString());
  }

  // 2. Monthly INVOICE + PAYMENT entries; some tied to real suppliers/LPOs.
  const lpos = await prisma.lpo.findMany({
    where: { projectId: project.id, supersededById: null },
    orderBy: { seq: "asc" },
    take: 8,
    select: { id: true, supplierId: true },
  });
  for (let month = 0; month < 8; month++) {
    const entryDate = new Date(Date.UTC(YEAR, month, 24));
    for (const p of COST_LINE_PLAN) {
      const inv = Math.round(p.amountAED * monthlyShare(month) * 0.62);
      const pay = Math.round(p.amountAED * monthlyShare(month) * 0.5);
      const anchor = lpos[(month + p.category.length) % lpos.length];
      const invRow = await prisma.costEntry.create({
        data: {
          projectId: project.id,
          category: p.category,
          entryDate,
          amountFils: aed(inv),
          kind: "INVOICE",
          supplierId: anchor?.supplierId ?? null,
          lpoId: anchor?.id ?? null,
          description: `${DEMO_PREFIX}monthly invoice`,
          reference: `DEMO/${YEAR}/${String(month + 1).padStart(2, "0")}/INV`,
        },
      });
      manifest.costEntryIds.push(invRow.id.toString());
      const payRow = await prisma.costEntry.create({
        data: {
          projectId: project.id,
          category: p.category,
          entryDate,
          amountFils: aed(pay),
          kind: "PAYMENT",
          supplierId: anchor?.supplierId ?? null,
          description: `${DEMO_PREFIX}payment against invoice`,
          reference: `DEMO/${YEAR}/${String(month + 1).padStart(2, "0")}/PAY`,
        },
      });
      manifest.costEntryIds.push(payRow.id.toString());
    }
  }

  // 3. PC payment-cycle dates — first 5 PCs without an applicationDate.
  const pcs = await prisma.paymentCertificate.findMany({
    where: { projectId: project.id, applicationDate: null },
    orderBy: { pcNumber: "asc" },
    take: 5,
  });
  const delays = [2, 9, 4, 13, null]; // days past due when money landed; last PC unpaid
  for (const [i, pc] of pcs.entries()) {
    const base = pc.invoiceDate ?? pc.periodEnd ?? new Date(Date.UTC(YEAR, 3, 15));
    const applicationDate = addDays(base, 6);
    const dueDate = addDays(applicationDate, 30);
    const received = delays[i] == null ? null : addDays(dueDate, delays[i]);
    await prisma.paymentCertificate.update({
      where: { id: pc.id },
      data: {
        applicationDate,
        dueDate,
        paymentReceivedDate: received,
        notes: appendNote(pc.notes, `[demo-dates] illustrative certification cycle`),
      },
    });
    manifest.pcIds.push(pc.id.toString());
  }

  // 4. LPO indent/delivery schedule — active LPOs missing both dates.
  const unscheduled = await prisma.lpo.findMany({
    where: { projectId: project.id, supersededById: null, indentDate: null, deliveryDate: null },
    orderBy: { seq: "asc" },
    take: 12,
  });
  for (const [i, lpo] of unscheduled.entries()) {
    const indentDate = addDays(lpo.issueDate, -2);
    const deliveryDate = addDays(lpo.issueDate, 21 + ((i * 7) % 25));
    await prisma.lpo.update({
      where: { id: lpo.id },
      data: {
        indentDate,
        deliveryDate,
        description: `${lpo.description} [demo-schedule]`,
      },
    });
    manifest.lpoIds.push(lpo.id.toString());
  }

  writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2));
  console.log(
    `Demo seed complete: ${manifest.costLineIds.length} cost lines, ${manifest.costEntryIds.length} cost entries, ${manifest.pcIds.length} PC date-sets, ${manifest.lpoIds.length} LPO schedules.\nManifest: prisma/demo-manifest.json\nPurge anytime: npm run seed:demo -- --purge`,
  );
}

function addDays(d, n) {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() + n);
  return x;
}
function appendNote(existing, addition) {
  return existing ? `${existing} ${addition}` : addition;
}

try {
  if (PURGE) await purge();
  else await seed();
} catch (err) {
  console.error(err);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
