#!/usr/bin/env node
// spec-008-v1: extract Job 1571 seed data from the delivered ProCare HTML reports.
// Reads the inline JS arrays (items/trades/months) and the PC table rows,
// writes prisma/seed-data/job1571.json. Deterministic: same inputs → identical output.
// Fails loudly if the expected structures are missing (fail-fast guard).

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SOURCES = [
  "midisland_1571_procurement_PC_ Invsetment - 24 07 26 (1).html", // newest — canonical
  "midisland_1571_procurement_PC _ dashboard.html",
  "midisland_1571_full_report.html",
];

function readSource() {
  for (const f of SOURCES) {
    try {
      const html = readFileSync(join(ROOT, f), "utf8");
      if (html.includes("const items=[")) return { file: f, html };
    } catch {
      /* try next */
    }
  }
  throw new Error("No report file containing items[] found — extraction aborted");
}

function extractItems(html) {
  const m = html.match(/const items=\[\s*([\s\S]*?)\n\];/);
  if (!m) throw new Error("items[] array not found");
  const out = [];
  const rowRe = /\{s:"((?:[^"\\]|\\.)*)",m:"((?:[^"\\]|\\.)*)",t:"([^"]*)",r:"([^"]*)",d:"([^"]*)",a:([\d.]+),rk:"((?:[^"\\]|\\.)*)"\}/g;
  let row;
  while ((row = rowRe.exec(m[1])) !== null) {
    out.push({
      supplier: row[1],
      material: row[2],
      trade: row[3],
      refNo: row[4],
      date: row[5],
      amountAED: Number(row[6]),
      remark: row[7],
    });
  }
  return out;
}

function extractPcRows(html) {
  // PC log table rows: PCxx | Period | Invoice date | Net payable | Retention | Procurement | Note
  const rows = [];
  const trRe = /<tr><td[^>]*>(PC\d+)<\/td>(.*?)<\/tr>/g;
  let tr;
  while ((tr = trRe.exec(html)) !== null) {
    const cells = tr[2].match(/<td[^>]*>(.*?)<\/td>/g) ?? [];
    const text = cells.map((c) =>
      c.replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim(),
    );
    rows.push({ pc: tr[1], cells: text });
  }
  return rows;
}

const MONTHS = {
  Jan: "01", Feb: "02", Mar: "03", Apr: "04", May: "05", Jun: "06",
  Jul: "07", Aug: "08", Sep: "09", Oct: "10", Nov: "11", Dec: "12",
};

function parseLpoDate(d) {
  // "02 Jun 2025"
  const [dd, mon, yyyy] = d.trim().split(/\s+/);
  if (!MONTHS[mon]) return null;
  return `${yyyy}-${MONTHS[mon]}-${dd.padStart(2, "0")}`;
}

function parseInvoiceDate(s) {
  if (!s || s === "—") return null;
  return parseLpoDate(s.replace(/^(\d+) /, "$1 "));
}

function toFils(aedString) {
  // Inputs are comma-grouped integers or decimals; float math is safe at this scale.
  const s = (aedString ?? "").trim();
  if (s === "" || s === "—" || /n\/a/i.test(s)) return null;
  const n = Number(s.replace(/,/g, ""));
  return Number.isFinite(n) ? Math.round(n * 100) : null;
}

function mapPcs(rows) {
  const provenanceByPc = {
    PC01: "SOURCE_DOCUMENT", PC02: "SOURCE_DOCUMENT", PC03: "CLIENT_SUMMARY",
    PC04: "SOURCE_DOCUMENT", PC05: "OCR_ESTIMATE", PC06: "OCR_ESTIMATE",
    PC07: "SOURCE_DOCUMENT", PC08: "OCR_ESTIMATE", PC09: "OCR_ESTIMATE",
    PC10: "OCR_ESTIMATE", PC11: "OCR_ESTIMATE", PC12: "OCR_ESTIMATE",
    PC13: "SOURCE_DOCUMENT", PC14: "OCR_ESTIMATE",
  };
  return rows.map((r) => {
    const [period, invoiceDate, net, retention, , note] = r.cells;
    const netFils = toFils(net);
    const retFils = toFils(retention) ?? 0;
    const variationMatch = note?.match(/AED ([\d,]+) variation/);
    return {
      pcNumber: Number(r.pc.slice(2)),
      periodLabel: period ?? "",
      invoiceDate: parseInvoiceDate(invoiceDate ?? ""),
      netFils,
      retentionFils: retFils,
      variationClaimFils: variationMatch ? toFils(variationMatch[1]) : 0,
      provenance: provenanceByPc[r.pc] ?? "IMPORTED_REPORT",
      notes: note && note.length > 0 ? note : null,
    };
  });
}

// ---- main ----
const { file, html } = readSource();
const items = extractItems(html);
if (items.length < 140) throw new Error(`Expected ≥140 LPO lines, got ${items.length} — aborting`);

const pcRaw = extractPcRows(html);
const pcs = mapPcs(pcRaw.filter((r) => /^PC\d+$/.test(r.pc)));
if (pcs.length !== 14) throw new Error(`Expected 14 payment certificates, got ${pcs.length} — aborting`);

// Spot checks (spec-008 AC1)
const top = items.reduce((a, b) => (b.amountAED > a.amountAED ? b : a));
if (Math.round(top.amountAED * 100) !== 383250000) throw new Error("Top LPO spot check failed");
const pc13 = pcs.find((p) => p.pcNumber === 13);
if (pc13.netFils !== 164429700) throw new Error("PC13 net payable spot check failed");

const out = {
  extractedFrom: file,
  extractedAt: null, // deterministic output: no timestamp
  project: {
    code: "1571",
    name: "Mid Island Parkway Phase 1C",
    mainContractor: "China Harbour Engineering Co. LLC (CHEC)",
    contractValueAED: 18786625,
    contractRef: "CHEC-MIP1C-B2-2025-006",
  },
  lpos: items.map((i) => ({
    supplier: i.supplier,
    description: i.material,
    trade: i.trade,
    refNo: i.refNo,
    issueDate: parseLpoDate(i.date),
    amountFils: Math.round(i.amountAED * 100),
    kind: i.remark.toUpperCase().includes("VARIATION") ? "VARIATION" : i.refNo.includes("INTERNAL") ? "INTERNAL_TRANSFER" : "STANDARD",
    remark: i.remark || null,
  })),
  pcs,
};

const outFile = join(ROOT, "prisma", "seed-data", "job1571.json");
mkdirSync(dirname(outFile), { recursive: true });
writeFileSync(outFile, JSON.stringify(out, null, 2) + "\n");
console.log(`Extracted ${out.lpos.length} LPOs and ${out.pcs.length} PCs from "${file}" → ${outFile}`);
