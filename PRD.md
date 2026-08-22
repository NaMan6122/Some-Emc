# PRD — ProCare Platform (Trends Electro-Mechanical Works LLC)

**Status:** APPROVED — human sign-off 2026-08-23 (owner: Human, per instruction_v4.md §4.1)
**Version:** 0.1
**Date:** 2026-08-23
**Companion:** [TDD.md](./TDD.md) v0.1

---

## 1. Background

Trends Electro-Mechanical Works LLC (TEMW) is an MEP subcontractor in Abu Dhabi, UAE, executing subcontract packages for main contractors such as China Harbour Engineering Co. (CHEC). Reference engagement: **Mid Island Parkway Phase 1C, Job 1571**, contract `CHEC-MIP1C-B2-2025-006`, base subcontract value **AED 18,786,625 (excl. VAT)**.

Today, procurement and contract finances are managed in spreadsheets:

- An **LPO log** — Local Purchase Orders issued to suppliers: 146 slots, 140 active lines, ~118 unique suppliers.
- A **payment certificate log** — monthly progress claims PC01–PC14 billed to CHEC.
- A **JCA material budget** — Appendix I–III breakdown by trade.

Analytics are produced manually as static HTML reports ("ProCare", branded by RAIZE). Three sample reports for Job 1571 exist in this repository and define the target analytical output.

## 2. Problem Statement

The spreadsheet process already exhibits structural failure modes visible in the source data:

| Observed issue in Job 1571 data | Consequence |
|---|---|
| Serial numbers reused (#129 used 3×), 12 dead "NOT IN USE" slots | No reliable unique identity for an LPO |
| Revisions tracked by renaming refs with "R1" suffixes | Revision history scattered; superseded values unclear |
| One entry flagged **"NEED TO CHECK"**, another split "50% ONLY" across a different job | Unresolved integrity questions; cross-project cost allocation done informally |
| Two footer grand totals disagree by **~AED 248K** | No single authoritative total; reconciliation risk |
| Supplier names misspelled ("DEVELOPMWNT", "ELECRICAL CENTER") | Phantom vendors distort vendor analytics |
| AED 130,566 claimed against variation orders that are 0% approved | Revenue claimed ahead of contractual approval goes untracked |
| Reports rebuilt by hand per snapshot | Days of analyst effort; stale between snapshots |

## 3. Goals

1. **G1 — Single source of truth.** All LPOs, suppliers, budgets, payment certificates, and variations live in one validated system of record; totals always computed server-side.
2. **G2 — Self-serve dashboards.** The existing ProCare report tabs become live dashboard pages, always current.
3. **G3 — Financial control.** Budget variance, cash exposure, retention ledger, and unapproved-variation claims continuously visible with threshold alerts.
4. **G4 — Data quality governance.** Records carry verification status and provenance; flags surface in a review queue with resolution workflow.
5. **G5 — Multi-project platform.** Every entity project-scoped; Job 1571 is the seed dataset (an Ajman Hospital job is already referenced in its data).
6. **G6 — Production grade.** Role-based auth, audit trail, validated inputs, backups, standard deployment tooling. *(Stack decision confirmed by human: Next.js + PostgreSQL.)*

## 4. Non-Goals (v1)

- Full ERP: payroll, HR, plant/equipment, timesheets.
- E-procurement: supplier portal, RFQ/quoting workflows.
- Automated OCR/AI extraction from scanned invoices (manual entry with provenance marking instead).
- Multi-currency (AED-only assumed — OQ-1).
- Arabic localization (OQ-2).

## 5. Personas & Roles

| Persona | Role key | Primary use |
|---|---|---|
| Managing Director / GM | `MANAGEMENT` | Cash exposure, recovery rate, budget alerts |
| Procurement / Purchase team | `PROCUREMENT` | Create/revise LPOs, manage suppliers |
| QS / Commercial team | `COMMERCIAL` | JCA budgets, variation orders, VO↔LPO linkage |
| Finance / Accounts | `FINANCE` | Payment certificates, retention, certification status |
| System administrator | `ADMIN` | Users, roles, projects, supplier merges, audit log |
| Viewer (auditor / RAIZE analyst) | `VIEWER` | Read-only dashboards & exports |

*(Role set proposed by Agent; confirm at sign-off.)*

## 6. Evidence Base (Job 1571)

All figures below were read directly from the three source reports:

- **Procurement:** AED 12.98M committed across 140 active LPOs incl. 5% VAT; avg LPO AED 92.7K, median AED 4.8K; largest single LPO AED 3.83M (storm water pumping station, Jun 2025).
- **Trade mix (committed):** Electrical 46%, Plumbing 32%, Fire Fighting 12%, General 5%, HVAC 5%, HSE <0.1%.
- **Vendors:** 118 unique suppliers; top 8 = 76% of spend; top supplier ≈ 30%; 18 repeat suppliers (≥2 LPOs).
- **Budget (JCA materials):** Electrical 7.00M / HVAC 0.50M / Plumbing 0.30M → utilization Electrical 85.0% (under), HVAC 123.4% (over), Plumbing excl. SWPS 117.9% (over). Storm water package sits outside the JCA (specialist subcontract); Fire Fighting has no visible budget line.
- **Billing:** PC01–PC14 (periods Apr 2025 – May 2026); cumulative net payable certified AED 10.33M (~52% of base contract); retention withheld AED 489K+; figures cross-checked to PC13's own cumulative total to the fils.
- **Variations:** claim revised from AED 2,044,853 (PC07) → AED 1,735,257 (PC13); 11 VOs all "Submitted", 0 approved; AED 130,566 (~7.5%) claimed against them.
- **Investment view (Apr'25–May'26 matched window):** invested AED 12.64M, recovered AED 10.33M, outstanding AED 2.31M, recovery rate 81.8%; gap peaked AED 5.0–5.6M during Jun–Dec 2025.

## 7. Functional Requirements

Priority key: **P0** = launch-blocking, **P1** = fast-follow, **P2** = later.

### FR-1 Authentication & User Management — P0
- Email + password login; persistent sessions; logout.
- Roles per §5 assigned by ADMIN; company-wide scope (per-project restriction deferred — OQ-5).
- Password policy: min length 10; hashed storage; failed-login rate limiting.
- Acceptance: unauthenticated access redirects to login; role gates enforced server-side.

### FR-2 Projects — P0
- CRUD: code (e.g., `1571`), name, main contractor/client, base contract value excl. VAT, VAT %, status (`ACTIVE | ON_HOLD | CLOSED`), start/end dates.
- All other entities project-scoped; project switcher in dashboard header.
- Seed: Mid Island Parkway Phase 1C fully loaded from current reports.

### FR-3 Suppliers (Vendor Master) — P0
- CRUD with normalized name; original raw spellings from import preserved as aliases.
- Vendor analytics: spend, LPO count, first/last activity, share of project spend, repeat-supplier flag.
- P1: merge tool for duplicate supplier records (typo variants), preserving history + audit.

### FR-4 LPO Register (core) — P0
- Fields: project, unique ref (auto-generated per-project sequence; prefix segments preserved), supplier, trade, description/material, issue date, amount **incl. VAT** (VAT % snapshotted per line), remark, kind (`STANDARD | VARIATION | INTERNAL_TRANSFER`), status (`DRAFT | ISSUED | CLOSED | CANCELLED`).
- **Revisions:** financially relevant edits to an ISSUED LPO create a successor revision linked to its predecessor (displayed like today's `061R1`); predecessor superseded; chain retained.
- **Verification workflow:** every LPO carries verification status (`PENDING | VERIFIED | FLAGGED`) + provenance note; FLAGGED enters the queue (FR-9).
- **Cross-project cost split** (the "50% ONLY" case): P1 percentage allocation of an LPO to another named project, reflected in analytics.
- Search/filter/sort (supplier, trade, date range, value, status, flag); CSV export of any filtered view.
- Bulk CSV import with column mapping + dry-run validation report (P1).

### FR-5 Budgets (JCA lines) — P0
- Budget lines per project: trade, category (`MATERIALS | LABOUR | OTHER`), amount, source label (e.g., "JCA Appendix I–III"), reference date, notes.
- Multiple budget sets over time; analytics compare against the latest.
- Variance engine: committed vs budget per trade, utilization %, warn ≥90%, alert >100% (thresholds configurable).

### FR-6 Payment Certificates — P0
- Fields: sequential PC number, period label + start/end, invoice date, gross, retention, net payable, variation claim included, stated cumulative-to-date (optional), status (`DRAFT | SUBMITTED | CERTIFIED | PAID`), provenance (`SOURCE_DOCUMENT | OCR_ESTIMATE | CLIENT_SUMMARY | DERIVED`), notes.
- Integrity rules: net = gross − retention (validated); PC numbers gapless per project (gaps raise a flag — mirrors how PC02 was reconstructed analytically).
- Retention ledger: cumulative held; release recording P1 (OQ-7).
- Cross-check panel recomputes cumulative certified vs any stated figure — automates today's manual "verified to the fils" check.

### FR-7 Variation Orders — P0
- Fields: VO number, title, status (`DRAFT | SUBMITTED | APPROVED | REJECTED`), submitted value, approved value/date on approval, approval ref.
- LPOs taggable `VARIATION`, linkable to a specific VO.
- **Compliance alert:** value claimed via PCs against non-APPROVED VOs surfaced on dashboard (currently AED 130,566 / 0% approved).

### FR-8 Analytics Dashboards — P0
Live pages mirroring the existing ProCare tabs:
1. **Overview** — headline KPIs, spend by trade, trade mix, monthly commitment trend, housekeeping summary.
2. **Budget vs Actual** — budget vs committed by trade, variance table, over-budget alerts, explicit coverage gaps ("Fire Fighting: no JCA line").
3. **Payment Certificates** — monthly certified vs procurement (monthly + cumulative), PC log, retention KPIs, variation-claim status.
4. **Investment** — investment vs recovery bars, cumulative outstanding-gap curve, recovery-rate KPI, peak-exposure stat.
5. **Vendors & LPO Log** — top-supplier concentration chart, full searchable/filterable log.
6. **Data Flags** — open-items queue plus housekeeping summary.

KPI formulas in §8. Chart drill-down to filtered lists P1.

### FR-9 Data Quality Queue — P0
Rule-based auto-flags with severity, status (`OPEN | RESOLVED | WONT_FIX`), assignee, resolution note:
- irregular/duplicate reference patterns;
- trades with committed spend but no budget line;
- PC gaps or cumulative mismatch beyond tolerance;
- claims against unapproved VOs above threshold;
- imported records in unverified state (e.g., "NEED TO CHECK" line);
- suspected duplicate suppliers (fuzzy match).

Resolution writes an audit entry. Seed pre-populates known Job 1571 flags so day-one state matches reality.

### FR-10 Exports & Reporting — P1
- CSV export everywhere a filter exists.
- Print/PDF stylesheet reproducing current static-report structure (cover, exec summary, sections). Monthly snapshot scheduling P2.

### FR-11 Audit Trail — P0
- Every create/update/status-change/delete logs actor, timestamp, entity, before/after diff; immutable; admin viewer.

## 8. Dashboard KPI Definitions

| KPI | Formula (server-computed) |
|---|---|
| Total LPO value | Σ active (non-cancelled, latest-revision) LPO amounts incl. VAT |
| Active LPOs | Count of latest-revision, non-cancelled LPOs |
| Suppliers used | Distinct suppliers with ≥1 active LPO |
| Avg / median LPO | Mean & median active LPO amount |
| Largest LPO | MAX(active LPO amount) |
| Flagged LPOs | Count where verification ≠ VERIFIED or revision/variation markers |
| Committed (matched) | Σ active LPOs in trades having a budget line |
| Utilization | Committed ÷ budget per trade |
| Certified to date | Σ PC net payable (CERTIFIED/PAID) |
| % of contract | Certified ÷ base contract value |
| Retention held | Σ PC retention not released |
| Outstanding investment | Cumulative commitments − cumulative certified (matched window) |
| Recovery rate | Recovered ÷ invested over months covered by PCs |
| Unapproved VO exposure | Σ variation-linked claims where VO ≠ APPROVED |

## 9. Key Workflows

- **W1 LPO lifecycle:** draft → issue (ref locked) → close. Financial correction ⇒ new revision; predecessor superseded. Cancel retains history.
- **W2 Monthly PC cycle:** enter PC → integrity checks (net=gross−retention, sequence, cumulative) → CERTIFIED → PAID on receipt.
- **W3 Variation flow:** raise VO → SUBMITTED → APPROVED (value/date recorded); compliance flags clear once linked claims reference approved VOs.
- **W4 Flag resolution:** flag raised automatically → assignee resolves by fixing/correcting data or marking WONT_FIX with reason → audit entry.

## 10. Migration & Seeding

Job 1571 loaded from the three reports: 140 LPO lines, 14 PCs, 3 JCA budget lines, VO summary (11 VOs), ~118 suppliers (with normalization map for known misspellings). All imported rows marked provenance=IMPORTED_REPORT and verification=PENDING except where reports verified them; known issues seeded as OPEN flags (S.No 83 "NEED TO CHECK", 50% cross-job split, footer-total discrepancy note).

## 11. Non-Functional Requirements

- **Performance:** dashboards < 1.5 s p95 at ~10k LPO/project scale; log queries paginated.
- **Security:** server-enforced RBAC, hashed passwords, rate-limited login, no secrets in code.
- **Auditability:** full change history for financial entities.
- **Backups:** daily DB backup, documented restore procedure (target RPO ≤ 24 h — hosting-dependent, OQ-3).
- **Browsers:** evergreen Chrome/Edge/Safari/Firefox; responsive down to tablet width.

## 12. Success Metrics

- Report production time: days → minutes (self-serve).
- Zero hand-maintained totals: all aggregates recomputed server-side.
- Flag aging: every OPEN flag has owner + age visible; none older than agreed SLA.
- Adoption: procurement/finance teams enter data directly within one month of rollout.

## 13. Assumptions

- Amounts recorded inclusive of VAT as displayed in the source logs, with VAT % snapshotted per line.
- One company (TEMW), multiple projects; no inter-company accounting.
- The three HTML reports are faithful representations of the underlying spreadsheet as of their generation dates.

## 14. Open Questions

See `Memory.md` Open Questions (OQ-1 … OQ-8). None block PRD approval except OQ-1 (currency), which affects the TDD money design.
