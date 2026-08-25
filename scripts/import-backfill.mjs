#!/usr/bin/env node
// T-046 (spec-025..028 adoption): CSV backfill importer for REAL client data.
//
// Three import kinds, all dry-run by default (add --apply to write):
//
//   1. --kind costs   → cost entries against the project
//      columns: category,entryDate,kind,amountAED,description,reference,supplierName,lpoRefNo,sourceLabel
//        category     : LABOUR_INHOUSE | LABOUR_SUBCONTRACT | SUPERVISION | ADMIN | DLP | MATERIAL | OTHER
//        entryDate    : YYYY-MM-DD
//        kind         : INVOICE | PAYMENT            (default INVOICE)
//        amountAED    : decimal AED                  (converted to fils ×100)
//        supplierName : optional; must match an existing supplier name (or alias)
//        lpoRefNo     : optional; must match an active LPO refNo in this project
//        sourceLabel  : provenance tag, e.g. "JCA Labour Appendix – Aug" (recommended!)
//      header row required. Blank optional columns are fine.
//
//   2. --kind pc-dates → payment-cycle dates on existing PCs
//      columns: pcNumber,applicationDate,dueDate,paymentReceivedDate
//        pcNumber     : integer PC number within the project
//        dates        : YYYY-MM-DD or blank to leave/clear untouched? blank = skip field.
//
//   3. --kind lpo-schedule → indent/delivery dates on existing LPOs
//      columns: refNo,indentDate,deliveryDate
//        refNo        : LPO reference within the project (active revision)
//
// Usage:
//   npm run import:backfill -- --kind costs --file ./backfill/aug-costs.csv           # preview
//   npm run import:backfill -- --kind costs --file ./backfill/aug-costs.csv --apply   # write

import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";

const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const kindIdx = args.indexOf("--kind");
const fileIdx = args.indexOf("--file");
const KIND = kindIdx >= 0 ? args[kindIdx + 1] : null;
const FILE = fileIdx >= 0 ? args[fileIdx + 1] : null;
const PROJECT_CODE = "1571";

const CATEGORIES = new Set(["LABOUR_INHOUSE", "LABOUR_SUBCONTRACT", "SUPERVISION", "ADMIN", "DLP", "MATERIAL", "OTHER"]);
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const aedToFils = (s) => BigInt(Math.round(Number(s) * 100));

if (!KIND || !FILE || !["costs", "pc-dates", "lpo-schedule"].includes(KIND)) {
  console.error("Usage: node scripts/import-backfill.mjs --kind costs|pc-dates|lpo-schedule --file <csv> [--apply]");
  process.exit(1);
}

function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const header = lines[0].split(",").map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const cells = line.split(",").map((c) => c.trim());
    const row = {};
    header.forEach((h, i) => (row[h] = cells[i] ?? ""));
    return row;
  });
}

function dateOrNull(v) {
  if (!v) return undefined; // absent — don't touch
  if (!ISO_DATE.test(v)) throw new Error(`bad date "${v}" (expected YYYY-MM-DD)`);
  return new Date(`${v}T00:00:00Z`);
}

const prisma = new PrismaClient();
let errors = 0;

try {
  const project = await prisma.project.findUniqueOrThrow({ where: { code: PROJECT_CODE } });
  const rows = parseCsv(readFileSync(FILE, "utf8"));
  console.log(`Import ${KIND}: ${rows.length} rows from ${FILE} — mode: ${APPLY ? "APPLY" : "DRY-RUN"}\n`);

  // caches for lookups
  const supplierCache = new Map(); // lower(name) -> id|null
  async function supplierIdByName(name) {
    if (!name) return null;
    const key = name.toLowerCase();
    if (!supplierCache.has(key)) {
      const s =
        (await prisma.supplier.findUnique({ where: { name } })) ??
        (await prisma.supplier.findFirst({ where: { aliases: { array_contains: [name] } } }));
      supplierCache.set(key, s?.id ?? null);
    }
    return supplierCache.get(key);
  }
  const lpoCache = new Map();
  async function activeLpoByRef(refNo) {
    if (!refNo) return null;
    if (!lpoCache.has(refNo)) {
      const l = await prisma.lpo.findFirst({ where: { projectId: project.id, refNo, supersededById: null } });
      lpoCache.set(refNo, l?.id ?? null);
    }
    return lpoCache.get(refNo);
  }

  for (const [i, row] of rows.entries()) {
    const lineNo = i + 2; // +header
    try {
      if (KIND === "costs") {
        const category = row.category?.toUpperCase();
        if (!CATEGORIES.has(category)) throw new Error(`unknown category "${row.category}"`);
        const entryDate = dateOrNull(row.entryDate);
        if (!entryDate) throw new Error("entryDate is required");
        const kindU = (row.kind || "INVOICE").toUpperCase();
        if (!["INVOICE", "PAYMENT"].includes(kindU)) throw new Error(`kind must be INVOICE|PAYMENT, got "${row.kind}"`);
        if (!(Number(row.amountAED) > 0)) throw new Error(`amountAED invalid: "${row.amountAED}"`);
        const supplierId = await supplierIdByName(row.supplierName);
        if (row.supplierName && supplierId == null) throw new Error(`supplier not found: "${row.supplierName}"`);
        const lpoId = await activeLpoByRef(row.lpoRefNo);
        if (row.lpoRefNo && lpoId == null) throw new Error(`active LPO not found: "${row.lpoRefNo}"`);
        console.log(`#${lineNo} COST ${category}/${kindU} ${row.entryDate} AED ${row.amountAED}${supplierId ? ` sup:${supplierId}` : ""}${lpoId ? ` lpo:${lpoId}` : ""}`);
        if (APPLY) {
          await prisma.costEntry.create({
            data: {
              projectId: project.id,
              category,
              entryDate,
              kind: kindU,
              amountFils: aedToFils(row.amountAED),
              description: row.description || null,
              reference: row.reference || null,
              supplierId,
              lpoId,
            },
          });
        }
      } else if (KIND === "pc-dates") {
        const pcNumber = Number(row.pcNumber);
        if (!Number.isInteger(pcNumber)) throw new Error(`pcNumber invalid: "${row.pcNumber}"`);
        const pc = await prisma.paymentCertificate.findFirst({ where: { projectId: project.id, pcNumber } });
        if (!pc) throw new Error(`PC #${pcNumber} not found in project`);
        const data = {};
        for (const f of ["applicationDate", "dueDate", "paymentReceivedDate"]) {
          const v = dateOrNull(row[f]);
          if (v !== undefined) data[f] = v;
        }
        console.log(`#${lineNo} PC ${pcNumber}: ${JSON.stringify(data)}`);
        if (APPLY && Object.keys(data).length) await prisma.paymentCertificate.update({ where: { id: pc.id }, data });
      } else {
        const refNo = row.refNo;
        const lpo = refNo ? await activeLpoByRef(refNo) : null;
        if (!lpo) throw new Error(`active LPO not found: "${refNo}"`);
        const data = {};
        for (const f of ["indentDate", "deliveryDate"]) {
          const v = dateOrNull(row[f]);
          if (v !== undefined) data[f] = v;
        }
        console.log(`#${lineNo} LPO ${refNo}: ${JSON.stringify(data)}`);
        if (APPLY && Object.keys(data).length) await prisma.lpo.update({ where: { id: BigInt(lpo) }, data });
      }
    } catch (err) {
      errors++;
      console.error(`#${lineNo} ERROR: ${err.message}`);
    }
  }

  console.log(`\nDone: ${rows.length} rows, ${errors} errors${errors ? " — nothing written for failed rows" : ""}.`);
  if (!APPLY) console.log("This was a DRY-RUN. Re-run with --apply to write.");
  else console.log(APPLY && errors ? "Applied with errors — review above." : "All rows applied to the database.");
  process.exitCode = errors ? 1 : 0;
} catch (err) {
  console.error(err);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
