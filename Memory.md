# Agent Memory

## Session Summary
Last Session: 2026-08-24 17:16
Active Task: T-030 — Implement spec-021 Bulk LPO CSV import — PENDING (next)
Last File Touched: Memory.md
Immediate Next Step: On request: POST /projects/:id/lpos/import?dry_run= with fixed-header CSV mapping, all-or-nothing commit, audit-tagged rows per spec-021. Committed through [T-029].

## Active Task
T-029 — Implement spec-020: Supplier merge UI
State: DONE
Started: 2026-08-24 16:48
Last Updated: 2026-08-24 17:16

## Task Log

### [2026-08-24 17:16] — T-029: Implement spec-020 Supplier merge UI
**Weight:** STANDARD
**State transitions:** PENDING → IN_PROGRESS (16:48) → DONE (17:16).
**Goal:** /admin/suppliers vendor-master screen — searchable table with counts/aliases/merged-indicator, scored suggestions panel, ADMIN merge form surfacing API guards inline.
**Spec Reference:** specs/spec-020-v1.md; PRD FR-3 P1.
**Approach:** Pure client screen over existing spec-006 endpoints (suggestions + merge); zero API contract change; listSuppliers gained additive `_count.lpos` include for the count column (documented in changelog). Review button pre-fills source=higher-id/target=lower-id. Non-ADMIN roles get read-only rendering; nav entry pre-existed.
**Checklist:**
  - [x] AC1 ADMIN view: 186-row table + 19 scored suggestion cards incl fixture pair @0.96
  - [x] AC2 UI merge round-trip: DB mergedIntoId set, survivor alias holds absorbed name, MERGE audit row (actor 9), row shows "merged into", pair left suggestions
  - [x] AC3 guard error inline: mocked 422 ALREADY_MERGED → banner text renders, form intact (server guards unreachable via normal flow by design)
  - [x] AC4 VIEWER: read-only note, zero controls, table renders; direct API 403 covered by spec-006 suite
  - [x] AC5 sidebar Administration entry live; unauth → /login?next=/admin/suppliers
**Outcome:** All five ACs verified in-browser with ZERO console errors. Fixture pair purged post-smoke. Real-data note: panel surfaced 18/19 open scan pairs; one fell below the top-20 suggestions cut (spec-006 documented limitation, unchanged).
**Test Evidence:** vitest 26 files / 141 tests passed; tsc clean; eslint clean incl. hooks warnings fixed; Playwright transcript in-session.
**Blockers:** NONE
**Rollback:** Remove page/client files; restore listSuppliers without _count; APIs untouched.

### [2026-08-24 16:48] — Gate G1 closure: M4 batch ratified
**Weight:** STANDARD
**State transitions:** BLOCKED → DONE (2026-08-24 16:48) — human ruled "Promote all 4".
**Checklist:**
  - [x] spec-020..023 promoted DRAFT → ACTIVE (order 020→021→022→023)
**Outcome:** M4 implementation authorized starting with the supplier merge UI.
**Test Evidence:** Manual sign-off by human on 2026-08-24 via gate question.
**Blockers:** NONE
**Rollback:** NONE.

### [2026-08-24 16:40] — T-028: Draft M4 atomic spec batch (spec-020..023)
**Weight:** SIGNIFICANT
**State transitions:** PENDING → IN_PROGRESS (16:32) → DONE (16:40); G1 presented.
**Goal:** Decompose M4 per TDD §14 (FR-10 print/PDF parity, allocations, merges UI, bulk CSV import) into atomic dependency-ordered specs and present at Gate G1.
**Spec Reference:** PRD FR-3 P1 / FR-4 P1 / FR-10; TDD §5 LpoAllocation note, §14 M4 row.
**Approach:** Four specs: merge UI consumes existing spec-006 endpoints with zero API change; bulk import is all-or-nothing with a true dry-run (financial discipline over best-effort); allocations land as new table + ADDITIVE analytics KPIs only so no golden anchor moves (full variance rewiring deferred until real split percentages are human-confirmed); print report reuses analytics services server-side with @media print CSS — browser-print PDF, zero new infra.
**Checklist:**
  - [x] spec-020-v1 Supplier merge UI
  - [x] spec-021-v1 Bulk LPO CSV import
  - [x] spec-022-v1 Cross-project LPO allocations
  - [x] spec-023-v1 Print/PDF report parity
  - [x] spec-index updated (four DRAFT rows)
  - [x] Gate G1 presented
**Outcome:** Four DRAFT specs filed; implementation order 020→021→022→023 on promotion.
**Test Evidence:** N/A — spec drafting task.
**Blockers:** NONE — gate ruling pending.
**Rollback:** Delete specs/spec-020..023-v1.md; revert spec-index rows.

### [2026-08-24 16:32] — Gate G5 closure: M3 milestone complete
**Weight:** STANDARD
**State transitions:** BLOCKED → DONE (2026-08-24 16:32) — human ruled "Confirm M3 + plan M4 + archive".
**Checklist:**
  - [x] M3 milestone confirmed COMPLETE (spec-016..019 IMPLEMENTED)
  - [x] M4 planning authorized (TDD §14 remainder)
  - [x] M1/M2-era Task Log entries archived to memory-archive/phase-1-2.md (through T-022)
**Outcome:** M3 closed: triage queue operational with 18 real Job 1571 findings, rules engine live, seven CSV exporters, retention ledger with untouched golden anchors. M4 spec drafting begins (T-028).
**Test Evidence:** Manual sign-off by human on 2026-08-24 via gate question.
**Blockers:** NONE
**Rollback:** NONE.

### [2026-08-24 16:21] — T-027: Implement spec-019 Retention ledger & releases — M3 complete
**Weight:** STANDARD
**State transitions:** PENDING → IN_PROGRESS (16:07) → DONE (16:21).
**Goal:** RetentionRelease migration + FINANCE-gated release API with admin-only audited delete + additive cashflow fields, anchors untouched.
**Spec Reference:** specs/spec-019-v1.md; PRD FR-6 P1 / OQ-7 (closed at G1 2026-08-24).
**Approach:** New RetentionRelease model (optional pcId aggregates across certificates; Restrict FKs; index projectId+releasedAt). POST+GET under /projects/:id/retention-releases, DELETE top-level /retention-releases/:id ADMIN-only; NO PATCH (immutable financial record). Validation: positive moneyString, ISO releasedAt, pcId must belong to the project. cashflow() gains retentionReleasedFils + retentionHeldFils (= total − released, honest negative allowed) as ADDITIVE fields only. PC dashboard "Retention held" card splits certified − released when releases exist.
**Checklist:**
  - [x] Migration applied; migrate status up to date; seed rerun idempotent (0 new rows)
  - [x] AC2 FINANCE post vs PC13 "50,000.00" → 201 fils-exact + CREATE audit; GET newest-first
  - [x] AC3 cashflow: total 48909700 unchanged, released 5000000, held 43909700 (anchors byte-identical)
  - [x] AC4 COMMERCIAL/VIEWER POST 403; FINANCE DELETE 403; ADMIN DELETE 200 + audit; held returns to 48909700
  - [x] AC5 zero/negative/malformed amounts → 422
  - [x] Live HTTP smoke mirrors headless results exactly (incl. correction-path delete)
**Outcome:** All five ACs verified headless AND live. M3 milestone COMPLETE: spec-016..019 all IMPLEMENTED (triage queue, rules engine, exports, retention ledger).
**Test Evidence:** vitest 26 files / 141 tests passed (incl. new retention.integration); tsc --noEmit clean; eslint clean; prisma migrate status clean; live curls in-session.
**Blockers:** NONE
**Rollback:** Down-migration drops table; remove routes/service/validation/tests/dashboard tweak.

### [2026-08-24 16:06] — T-026: Implement spec-018 CSV exports
**Weight:** STANDARD
**State transitions:** PENDING → IN_PROGRESS (10:50) → BLOCKED (11:30, docker storage) → IN_PROGRESS (11:35) → DONE (16:06).
**Goal:** CSV export everywhere a filter exists: pcs/vos/budget-lines/variance/flags + suppliers + audit.csv, cloning lpos/export conventions.
**Spec Reference:** specs/spec-018-v1.md; PRD FR-10 P1; print/PDF stays M4.
**Approach:** Shared src/lib/csv.ts (csvEscape/toCsv/csvResponse); seven route files with literal ".csv" path segments matching spec URLs; read gates mirror JSON counterparts (requireAuth; audit ADMIN); money as fils-exact formatMoney strings; bounded takes (5000). flags filter builder extracted to services/flags.ts flagListWhere for parity with the JSON feed. Variance CSV reuses computeVariance directly so cells byte-match the JSON endpoint.
**Checklist:**
  - [x] AC1 pcs.csv: header exact, 14 rows, PC03 retention "AED 0.00", PC07 claim "AED 55,665.00", statuses match DB
  - [x] AC2 variance.csv figures byte-match GET /variance for all 7 trades (ELECTRICAL under golden)
  - [x] AC3 budget-lines.csv carries 3 JCA lines incl "AED 7,000,000.00"; vos.csv header-only on empty register
  - [x] AC4 suppliers.csv?q=SILVER filtered rows w/ aliases JSON + lpoCount; full export larger than filtered
  - [x] AC5 VIEWER audit.csv 403; ADMIN entity filter honored; unauth 401 all endpoints; malformed from= 422
  - [x] Live HTTP smoke: all seven endpoints correct content-type/rows; unauth 401
**Outcome:** All five ACs verified headless + live. Environmental interruption logged separately (docker volume I/O error → Docker Desktop restart healed it, zero data loss). Three test-harness bugs caught and fixed en route (dynamic import vs vite alias; default-param cookie masking an unauth negative; suite-order dependence replaced by hermetic stamped fixture).
**Test Evidence:** vitest 25 files / 137 tests passed (incl. new csv-export.integration, 6 tests); tsc --noEmit clean; eslint clean; live curls in-session.
**Blockers:** NONE
**Rollback:** Remove src/lib/csv.ts + seven export routes + test; JSON endpoints unaffected.

### [2026-08-24 11:35] — T-026 unblocked: Docker restart healed the volume
**Weight:** TRIVIAL (blocker-resolution log)
**State transitions:** BLOCKED → IN_PROGRESS (11:35) after Gate G4 self-clear via human "Continue" directive.
**Resolution:** Quit + reopened Docker Desktop via osascript; VM came back healthy; `procare-db` restarted clean; first query succeeded (797 users intact). Volume recreation NOT needed.
**Blockers:** NONE

### [2026-08-24 11:30] — T-026 BLOCKED: dev Postgres storage failure
**Weight:** STANDARD (blocker log per §11)
**State transitions:** IN_PROGRESS → BLOCKED (11:30).
**Blocker:** Every DB query fails with `FATAL: could not open file "global/pg_filenode.map": I/O error` — the Docker Desktop VM's storage layer is failing. `docker ps` / `docker compose ps` hang indefinitely; port 5433 still accepts TCP. First observed when the csv-export suite's seed step failed mid-run.
**Progress before blocker (safe):** All seven exporters written (shared src/lib/csv.ts + pcs/vos/budget-lines/variance/flags/suppliers/audit.csv routes) with role gates mirroring JSON counterparts; tsc --noEmit clean after fixing CsvCell typings on jsonSafe output.
**Recovery assessment:** Dev volume worst-case recreation loses NOTHING irreplaceable — schema re-applies via prisma migrations, Job 1571 reseeds via npm run seed:job1571, scanned flags regenerate via one POST scan. No production data exists anywhere in this stack.
**Unblock path:** Human restarts Docker Desktop (or authorizes agent to via osascript); then G4: verify container, migrate status, reseed, resume test run.
**Blockers:** THIS (docker VM storage).
**Rollback:** N/A.

### [2026-08-24 10:46] — T-025: Implement spec-017 Data-quality rules engine
**Weight:** STANDARD
**State transitions:** PENDING → IN_PROGRESS (10:32) → DONE (10:46).
**Goal:** POST /api/v1/projects/:id/flags/scan evaluating NO_BUDGET_LINE + DUPLICATE_SUPPLIER_SUSPECT idempotently with condition-based reconciliation.
**Spec Reference:** specs/spec-017-v1.md; PRD FR-9; reuses budgets.computeVariance semantics + duplicates.findDuplicatePairs heuristic.
**Approach:** NO_BUDGET_LINE = variance rows status "no_budget" (committed>0 ∧ no line), one Project-flag per trade; message leads with trade token for matching. Pair flags are Supplier-entity with entityId composite "smallerId:largerId". Reconciliation is CONDITION-based: each OPEN flag re-checked against current data (budget line appeared / side merged / similarity dropped) → RESOLVED w/ note "Auto-resolved by scan"; creation side dedupes on entityId. Roles ADMIN/PROCUREMENT/COMMERCIAL/FINANCE via requireRole.
**Checklist:**
  - [x] AC1 seeded scan: exactly one FIRE_FIGHTING flag @ AED 1,583,925.00; qualifying set == variance no_budget trades; budgeted trades absent
  - [x] AC2 second scan opened 0 / resolved 0; flag ids unchanged
  - [x] AC3 adding FIRE_FIGHTING budget line → flag RESOLVED w/ auto-note; GENERAL stays OPEN
  - [x] AC4 SCAN17 typo-pair fixtures → one pair flag naming both; after merge → auto-RESOLVED
  - [x] AC5 VIEWER 403; unauth 401 envelope
  - [x] Live HTTP smoke: unauth 401 → first scan {opened:18} → rescan {0,0}
**Outcome:** First real scan surfaced 4 budget-gap flags + 14 supplier-pair flags — the pairs are overwhelmingly genuine near-duplicates missed by the seed's conservative canonicalization (TECHNALCO/TECNALCO, MUSANDUM/MUSANDAM, M/S-prefix variants); a few borderline LOWs are advisory by design (WONT_FIX path). Canonicalization map expansion deliberately NOT done here (spec-008 territory). The 18 flags left OPEN in dev DB as genuine day-one queue items. Test bug caught en route: suite initially assumed only 4 openings and used wrong PROCUREMENT login email (actual: purchase@trends.local).
**Test Evidence:** vitest 24 files / 131 tests passed (incl. new flags-scan.integration, 5 tests); tsc --noEmit clean; eslint clean; live curls in-session.
**Blockers:** NONE
**Rollback:** Remove scan route/service/tests; DataFlag rows persist harmlessly.

_Entries through T-022 (M1/M2 phases) archived to memory-archive/phase-1-2.md._

## Open Questions
- OQ-1: Is AED the only currency, ever? (Assumed yes in TDD money design.) — raised 2026-08-23
- OQ-2: Is Arabic UI/localization on any roadmap horizon? (Assumed no for v1.) — raised 2026-08-23
- OQ-3: Deployment target — cloud provider, on-prem server, or undecided? (Affects ops/backup design.) — raised 2026-08-23
- OQ-4: Should invoice/document attachments be stored against LPOs/PCs in v1? (Assumed P1+.) — raised 2026-08-23
- OQ-5: Do users need per-project access restrictions soon, or company-wide roles suffice? (Assumed company-wide.) — raised 2026-08-23
- OQ-6: Is a formal LPO approval workflow needed pre-issue, or free issuance matches current practice? (Assumed free issuance + revisions.) — raised 2026-08-23
- OQ-7: ~~Retention release tracking — confirm it belongs in fast-follow (P1).~~ CLOSED 2026-08-24 — human confirmed in-scope M3 at G1; implemented via spec-019.
- OQ-8: Who is the bootstrap admin account for, and what email should own it at first login? — raised 2026-08-23
