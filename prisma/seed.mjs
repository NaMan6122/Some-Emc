#!/usr/bin/env node
// spec-008-v2: idempotent seed of Job 1571 from prisma/seed-data/job1571.json.
// Run: npm run seed:job1571   (loads .env via --env-file)

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { PrismaClient } from "@prisma/client";

const ROOT = join(dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1")), "..");
const data = JSON.parse(readFileSync(join(ROOT, "prisma", "seed-data", "job1571.json"), "utf8"));
const prisma = new PrismaClient();

const normalize = (s) =>
  s.trim().toUpperCase().replace(/\s+/g, " ").replace(/^[.\- ]+/, "").trim();

// Conservative canonicalization of known misspelling groups seen in the log.
const CANON = new Map(
  Object.entries({
    "M/S UNIGULF DEVELOPMWNT LLC": "UNIGULF DEVELOPMENT LLC",
    "M/S UNIGULF DEVELOPMENT LLC": "UNIGULF DEVELOPMENT LLC",
    "M/S ELECRICAL CENTER": "ELECTRICAL CENTER",
    "M/S ELECTRICAL CENTER": "ELECTRICAL CENTER",
    "M/S AL SILMIYA HARDWARES L.L.C": "AL SILMIYA HARDWARES L.L.C",
    "M/S AL SILMIYA HARDWARES LLC": "AL SILMIYA HARDWARES L.L.C",
    "M/SAL SILMIYA HARDWARES LLC": "AL SILMIYA HARDWARES L.L.C",
    "M/S BAHARI & MAZROEIL.L.C": "BAHRI & MAZROEI TRADING CO LLC",
    "M/S METAL CRAFT BUILDING & CONSTRUCTION MATERIALS TRADING L.":
      "METAL CRAFT BUILDING & CONSTRUCTION MATERIALS TRADING L.L.C",
    "M/S METAL CRAFT BUILDING & CONSTRUCTION MATERILAS TRADING L.":
      "METAL CRAFT BUILDING & CONSTRUCTION MATERIALS TRADING L.L.C",
    "M/S ROYAL EMIRATES HARDWARE TRADING LLC": "ROYAL EMIRATES HARDWARES TRADING L.L.C",
    "M/S ROYAL EMIRATES HARDWARES TRADING L.L.C": "ROYAL EMIRATES HARDWARES TRADING L.L.C",
    "M/S ROYAL EMIRATES TRADING LLC": "ROYAL EMIRATES TRADING LLC",
    "M/S AL NAHAR SATATIONARY": "AL NAHAR STATIONARY",
    "M/S AL ANAHR STATIONARY": "AL NAHAR STATIONARY",
    "M/S AL NAHAR STATIONARY": "AL NAHAR STATIONARY",
    "M/S MEW SMART OFFICE AUTOMATION LLC": "NEW SMART OFFICE AUTOMATION L.L.C",
    "M/S NEW SMART OFFICE AUTOMATION L.L.C": "NEW SMART OFFICE AUTOMATION L.L.C",
    "M/S WORLD TTANSPORT SOLE PROPERTORSHIP L.L.C": "WORLD TRANSPORT SOLE PROPERTORSHIP L.L.C",
    "M/S WORLD TRANSPORT SOLE PROPERTORSHIP L.L.C": "WORLD TRANSPORT SOLE PROPERTORSHIP L.L.C",
    "M/S SKILLSAFE TRIANING AND INSPECTTION SERVICES": "SKILLSAFE TRAINING AND INSPECTION SERVICES",
    "M/S SKILLSAFE TRAINING AND INSPECTION SERVICES": "SKILLSAFE TRAINING AND INSPECTION SERVICES",
    "M/S OROSTAR EXPROOF ELELCTRUICAL MATERILAS TRADING LLC":
      "OROSTAR EXPROOF ELECTRICAL MATERIALS TRADING LLC",
    "M/S OROSTAR EXPROOF ELECTRICAL MATERIALS TRADING LLC":
      "OROSTAR EXPROOF ELECTRICAL MATERIALS TRADING LLC",
    "M/S HYDRO SANIATRY WARE TRADING": "HYDRO SANITARY WARE TRADING",
    "M/S . HYDRO SANITARY WARE TRADING": "HYDRO SANITARY WARE TRADING",
    "M/S S.S.G . TRADING L.L.C": "S.S.G. TRADING L.L.C",
    "M/SS.S.G. TRADING L.L.C": "S.S.G. TRADING L.L.C",
    "M/S MUSANDAM ELECTRICAL EQUIPMENT": "MUSANDAM ELECTRICAL EQUIPMENT CO LLC",
    "M/S MUSANDAM ELECTRICAL EQUIPMENT CO LLC": "MUSANDAM ELECTRICAL EQUIPMENT CO LLC",
  }).map(([k, v]) => [normalize(k), v]),
);

function canonSupplier(raw) {
  const normRaw = normalize(raw);
  const target = CANON.get(normRaw);
  return {
    name: target ? normalize(target) : normRaw,
    alias: raw.trim(),
  };
}

const TRADE_MAP = {
  Electrical: "ELECTRICAL",
  Plumbing: "PLUMBING",
  HVAC: "HVAC",
  "Fire Fighting": "FIRE_FIGHTING",
  General: "GENERAL",
  HSE: "HSE",
  "Plumbing/Electrical": "OTHER",
  Internal: "OTHER",
};

function monthBounds(label) {
  const m = label.match(/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) (\d{4})$/);
  if (!m) return { start: null, end: null };
  const idx = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"].indexOf(m[1]);
  const start = new Date(Date.UTC(Number(m[2]), idx, 1));
  const end = new Date(Date.UTC(Number(m[2]), idx + 1, 0));
  return { start, end };
}

async function ensureFlag(where, create) {
  const existing = await prisma.dataFlag.findFirst({ where });
  if (!existing) await prisma.dataFlag.create({ data: create });
}

const counts = { suppliers: 0, lpos: 0, pcs: 0, flags: 0 };

try {
  // 1. Project shell
  const project = await prisma.project.upsert({
    where: { code: data.project.code },
    update: {},
    create: {
      code: data.project.code,
      name: data.project.name,
      mainContractor: data.project.mainContractor,
      contractValueFils: BigInt(data.project.contractValueAED) * 100n,
      vatRate: 0.05,
      status: "ACTIVE",
      startedAt: new Date("2025-01-23"),
    },
  });

  // 2. Suppliers + aliases (idempotent)
  const supplierCache = new Map(); // canonical name -> id
  for (const line of data.lpos) {
    const { name, alias } = canonSupplier(line.supplier);
    let id = supplierCache.get(name);
    if (id === undefined) {
      let s = await prisma.supplier.findUnique({ where: { name } });
      if (!s) {
        s = await prisma.supplier.create({ data: { name, aliases: [] } });
        counts.suppliers++;
      }
      const aliases = Array.isArray(s.aliases) ? [...s.aliases] : [];
      if (alias.toUpperCase() !== name && !aliases.includes(alias)) {
        await prisma.supplier.update({ where: { id: s.id }, data: { aliases: [...aliases, alias] } });
      }
      id = s.id;
      supplierCache.set(name, id);
    } else {
      const s = await prisma.supplier.findUniqueOrThrow({ where: { id } });
      const aliases = Array.isArray(s.aliases) ? [...s.aliases] : [];
      if (alias.toUpperCase() !== name && !aliases.includes(alias)) {
        await prisma.supplier.update({ where: { id }, data: { aliases: [...aliases, alias] } });
      }
    }
    line._supplierId = id;
  }

  // 3. LPOs — upsert by (projectId, refNo); seq only allocated for new rows.
  let seq = (await prisma.lpo.aggregate({ where: { projectId: project.id }, _max: { seq: true } }))._max.seq ?? 0;
  for (const l of data.lpos) {
    const exists = await prisma.lpo.findFirst({ where: { projectId: project.id, refNo: l.refNo } });
    if (exists) continue;
    seq += 1;
    await prisma.lpo.create({
      data: {
        projectId: project.id,
        refNo: l.refNo,
        seq,
        supplierId: l._supplierId,
        trade: TRADE_MAP[l.trade] ?? "OTHER",
        description: l.description,
        issueDate: new Date(l.issueDate),
        amountFils: BigInt(l.amountFils),
        vatRate: 0.05,
        kind: l.kind,
        status: "ISSUED",
        verification: "PENDING",
        provenance: "IMPORTED_REPORT",
        remark: l.remark,
      },
    });
    counts.lpos++;
  }

  // 4. Payment certificates
  for (const pc of data.pcs) {
    const exists = await prisma.paymentCertificate.findFirst({
      where: { projectId: project.id, pcNumber: pc.pcNumber },
    });
    if (exists) continue;
    const { start, end } = monthBounds(pc.periodLabel.startsWith("Upto") ? pc.periodLabel.replace("Upto ", "") : pc.periodLabel);
    await prisma.paymentCertificate.create({
      data: {
        projectId: project.id,
        pcNumber: pc.pcNumber,
        periodLabel: pc.periodLabel,
        periodStart: pc.periodLabel.startsWith("Upto") ? null : start,
        periodEnd: pc.periodLabel.startsWith("Upto") && pc.invoiceDate ? new Date(pc.invoiceDate) : end,
        invoiceDate: pc.invoiceDate ? new Date(pc.invoiceDate) : null,
        grossFils: BigInt(pc.netFils + pc.retentionFils),
        retentionFils: BigInt(pc.retentionFils),
        netPayableFils: BigInt(pc.netFils),
        variationClaimFils: BigInt(pc.variationClaimFils),
        status: "CERTIFIED",
        provenance: pc.provenance,
        notes: pc.notes,
      },
    });
    counts.pcs++;
  }

  // 5. Known-issue DataFlags
  const hydro = await prisma.lpo.findFirst({ where: { projectId: project.id, refNo: "TEMW/REF/LPO/HVAC/019" } });
  if (hydro) {
    await ensureFlag(
      { entityType: "Lpo", entityId: String(hydro.id), ruleCode: "SOURCE_NEEDS_CHECK" },
      {
        entityType: "Lpo",
        entityId: String(hydro.id),
        ruleCode: "SOURCE_NEEDS_CHECK",
        severity: "HIGH",
        message: "Source sheet marks this entry 'NEED TO CHECK' (S.No 83, Hydro Point manhole)",
      },
    );
    counts.flags++;
    if (hydro.verification === "PENDING") {
      await prisma.lpo.update({ where: { id: hydro.id }, data: { verification: "FLAGGED" } });
    }
  }

  const fastTrack = await prisma.lpo.findFirst({ where: { projectId: project.id, refNo: "TEMW/REF/LPO//084" } });
  if (fastTrack) {
    await ensureFlag(
      { entityType: "Lpo", entityId: String(fastTrack.id), ruleCode: "CROSS_JOB_SPLIT" },
      {
        entityType: "Lpo",
        entityId: String(fastTrack.id),
        ruleCode: "CROSS_JOB_SPLIT",
        severity: "MEDIUM",
        message: "Remark '50% ONLY' — remainder billed to Ajman Hospital job; cross-project allocation pending",
      },
    );
    counts.flags++;
  }

  const pid = String(project.id);
  await ensureFlag(
    { entityType: "Project", entityId: pid, ruleCode: "TOTALS_MISMATCH" },
    {
      entityType: "Project",
      entityId: pid,
      ruleCode: "TOTALS_MISMATCH",
      severity: "HIGH",
      message: "Source sheet footer grand totals disagree by ~AED 248K; authoritative total under investigation",
    },
  );
  await ensureFlag(
    { entityType: "Project", entityId: pid, ruleCode: "VO_BACKFILL" },
    {
      entityType: "Project",
      entityId: pid,
      ruleCode: "VO_BACKFILL",
      severity: "MEDIUM",
      message: "PC13 variation summary references 11 submitted VOs; individual records absent from source — backfill required",
    },
  );

  console.log(
    `Seed complete: project ${project.code} · new suppliers ${counts.suppliers} · new LPOs ${counts.lpos} · new PCs ${counts.pcs} · flags ensured`,
  );
} finally {
  await prisma.$disconnect();
}
