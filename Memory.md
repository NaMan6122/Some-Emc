# Agent Memory

## Session Summary
Last Session: 2026-08-24 10:30
Active Task: T-025 — Implement spec-017 Data-quality rules engine (project scan) — PENDING (next)
Last File Touched: Memory.md
Immediate Next Step: Start T-025 on request: POST /api/v1/projects/:id/flags/scan (NO_BUDGET_LINE golden FIRE_FIGHTING AED 1,583,925; DUPLICATE_SUPPLIER_SUSPECT via duplicates.ts ≥0.6; idempotent reconcile). Committed through 8c029d6 ([T-024]).

## Active Task
T-024 — Implement spec-016: Flag triage workflow
State: DONE
Started: 2026-08-24 10:05
Last Updated: 2026-08-24 10:26

## Task Log

### [2026-08-24 10:26] — T-024: Implement spec-016 Flag triage workflow
**Weight:** STANDARD
**State transitions:** PENDING → IN_PROGRESS (10:05) → DONE (10:26).
**Goal:** PATCH /api/v1/flags/:id assign/resolve/wont-fix with domain-scoped role gates + audit; users picker endpoint; flags list filters; queue UI triage actions.
**Spec Reference:** specs/spec-016-v1.md; PRD FR-9; TDD §7 flags-resolve row.
**Approach:** entityType→role domain map as a single constant in the service (Lpo|Supplier→PROCUREMENT, BudgetLine|VariationOrder→COMMERCIAL, PaymentCertificate→FINANCE, Project-level→all three; ADMIN bypasses). Transitions forward-only OPEN→RESOLVED|WONT_FIX, both note-mandatory (422 w/ field detail otherwise); assignment follows the same domain gate. Audit via shared service (UPDATE rows carry changed keys only). GET /users returns {id,name,role} to triage roles for the picker. List endpoint gained severity/ruleCode/entityType/assigneeId filters + openBySeverity meta. UI: severity chips, "Show closed"/"Assigned to me" toggles, inline assignee select, Resolve/Won't-fix with per-row note editor, toast surfacing server 403 domain messages.
**Checklist:**
  - [x] AC1 ADMIN assign → 200 + audit (before null → after financeUserId)
  - [x] AC2 FINANCE resolve PC-domain flag → RESOLVED + resolvedAt + note + audit
  - [x] AC3 COMMERCIAL resolves BudgetLine flag OK; PC-domain flag → 403 FLAG_DOMAIN_FORBIDDEN, flag stays OPEN
  - [x] AC4 WONT_FIX sans note → 422; terminal flag re-triage → 422 INVALID_TRANSITION
  - [x] AC5 VIEWER 403; unauth PATCH/GET 401 envelopes
  - [x] AC6 ruleCode+OPEN filter isolates seeded SOURCE_NEEDS_CHECK; assigneeId scoping verified
  - [x] AC7 users picker shape {id,name,role}; VIEWER 403; browser round-trip: Resolve → note → Confirm → toast "Flag resolved" → status RESOLVED (scratch flag, then purged)
**Outcome:** All seven ACs verified headless AND in-browser (Playwright against live dev server on seeded Job 1571). Environmental root cause found for recurring dev-server flakiness: multiple zombie `next dev` processes sharing one `.next` corrupt each other's manifests (ENOENT prerender-manifest / missing chunks / HTML 500s) — kill all next processes, wipe .next, run exactly one instance; recorded in dev-changelog completion note. Dev-DB observation (not a defect): ~76 OPEN flags incl. historical test leakage, and several stale test users named "ADMIN" pollute the assignee dropdown — cleanup candidate if it bothers anyone.
**Test Evidence:** vitest 23 files / 126 tests passed (incl. new flags.integration, 7 tests); tsc --noEmit clean; eslint clean; Playwright DOM assertions + zero console errors.
**Blockers:** NONE
**Rollback:** Remove [id]/users routes + validation/service/tests; revert FlagsClient to read-only feed; DataFlag rows persist.

### [2026-08-24 10:05] — Gate G1 closure: M3 batch ratified
**Weight:** STANDARD
**State transitions:** BLOCKED → DONE (2026-08-24 10:05) — human ruled "Promote all 4 + close OQ-7".
**Checklist:**
  - [x] spec-016..019 promoted DRAFT → ACTIVE
  - [x] OQ-7 closed (retention release tracking confirmed in-scope M3/P1)
**Outcome:** M3 implementation authorized in order 016→017→018→019. spec-012-v2/spec-014-v2 ratification already recorded at this gate entry per standing instruction.
**Test Evidence:** Manual sign-off by human on 2026-08-24 via gate question.
**Blockers:** NONE
**Rollback:** NONE.

### [2026-08-24 10:00] — T-023: Draft M3 atomic spec batch (spec-016..019)
**Weight:** SIGNIFICANT
**State transitions:** PENDING → IN_PROGRESS (09:56) → DONE (10:00).
**Goal:** Decompose M3 per TDD §14 (FR-9 flag rules + triage queue, CSV exports P1, retention release tracking OQ-7) into atomic dependency-ordered specs and present at Gate G1.
**Spec Reference:** PRD FR-9/FR-10/FR-6-P1; TDD §7 flags-resolve matrix row, §8 API design, §14 milestones.
**Approach:** Audited existing flag surface first: 9 ruleCodes already raised inline by services (VERIFICATION_FLAGGED, PC_GAP, CUMULATIVE_MISMATCH, UNAPPROVED_VO_CLAIM, BUDGET_DUPLICATE_LINE + four seed flags), read-only GET /flags from T-022. Gap analysis against FR-9's rule list left exactly two unwired rules (no-budget-line trades; fuzzy supplier duplicates) → scan spec. Triage spec implements TDD §7's "(proc.)/(comm.)/(fin.)" annotations as an explicit entityType→role domain map with ADMIN bypass. Exports spec clones the proven /lpos/export conventions. Retention spec adds RetentionRelease table with additive-only analytics fields so every spec-014 golden anchor stays byte-identical.
**Checklist:**
  - [x] spec-016-v1 Flag triage workflow (PATCH /flags/:id assign/resolve/wont_fix, domain map, users picker endpoint, queue UI upgrade)
  - [x] spec-017-v1 Data-quality rules engine (POST /projects/:id/flags/scan; NO_BUDGET_LINE + DUPLICATE_SUPPLIER_SUSPECT, idempotent reconcile)
  - [x] spec-018-v1 CSV exports (pcs/vos/budget-lines/variance/flags/suppliers/audit.csv honoring identical filters+gates; print/PDF stays M4)
  - [x] spec-019-v1 Retention ledger & releases (RetentionRelease migration, FINANCE write / ADMIN delete, cashflow additive fields)
  - [x] spec-index updated (four DRAFT rows); spec-012-v2/spec-014-v2 ratification recorded per standing instruction
  - [x] dev-changelog G1-entry ratification note appended (append-only)
  - [x] Gate G1 presented to human (promotion of 016..019 + OQ-7 closure proposal)
**Outcome:** Four DRAFT specs filed; awaiting Gate G1 ruling before any implementation (§4.2 promotion rule). Ratification of DCL-004/005 executed without prompting as instructed. OQ-7 proposed for closure upon promotion (retention release tracking confirmed in-scope M3).
**Test Evidence:** N/A — spec drafting task; verification happens at implementation tasks T-024+.
**Blockers:** NONE — gate ruling pending.
**Rollback:** Delete specs/spec-016..019-v1.md; revert spec-index.md rows and the changelog note stands (append-only).

### [2026-08-24 05:05] — T-022: Implement spec-015 Dashboard screens — M2 complete
**Weight:** SIGNIFICANT
**State transitions:** PENDING → IN_PROGRESS (04:52) → DONE (05:05).
**Goal:** Six live dashboard tabs consuming /analytics/* payloads per design.md §9 chart standards; replaces all placeholder pages.
**Spec Reference:** specs/spec-015-v1.md; design.md §9/§10.
**Approach:** recharts@3.10.1 added. Shared ChartFrame (figure+figcaption+ariaLabel) and self-wrapping ChartTooltip (renders Recharts Tooltip with dark surface + fils-exact AED content). useAnalytics SWR hook keyed by resolved numeric project id from ?project= context. Screens: Overview (6 KPIs, trade bar/donut toggle, monthly area, housekeeping note), Budget vs Actual (grouped bars, gap banner, utilization bars + status pills), Payment Certificates (paired bars + dashed cumulative overlays via ComposedChart, retention/claim KPIs, PC table w/ provenance chips), Investment (paired bars + outstanding gap area + recovery/peak cards), Vendors (Pareto bars+cumulative % line above existing LPO log), Data Flags (read-only feed from new GET /api/v1/flags — FR-9 triage stays M3).
**Checklist:**
  - [x] AC1 Overview renders goldens live: AED 12,984,115.00 / 140 / largest AED 3,832,500.00 (browser-verified)
  - [x] AC2 Budget tab: HVAC "123.4%" Over pill + Fire Fighting coverage-gap notice (browser-verified)
  - [x] AC3 Investment: recovery 81.8%, peak Dec 25 · 5.6M, outstanding AED 2,306,505.00 (browser-verified)
  - [x] AC4 aria-labels on every chart figure; tabular-nums on money; ProvenanceChip in PC table
  - [x] AC5 six routes reachable from sidebar; ?project=1571 deep-link honored on all dashboards
  - [x] Contrast uses existing zinc/indigo tokens both modes (no new text colors introduced)
**Outcome:** All six tabs browser-smoked via Playwright with ZERO console errors; dev-server flakiness seen mid-task was stale .next after a kill (rm -rf .next restart fixed; environmental). Flags feed test added (401 unauth, OPEN filter, newest-first). M2 milestone COMPLETE (spec-009..015).
**Test Evidence:** vitest 22 files / 119 tests passed; tsc clean; eslint clean; Playwright DOM assertions for goldens on overview/budget/investment.
**Blockers:** NONE
**Rollback:** Screens additive; remove client files + flags route; analytics endpoints remain usable standalone.

### [2026-08-24 04:50] — T-021: Implement spec-014 Analytics engine & endpoints
**Weight:** SIGNIFICANT (includes DCL-005 constant corrections + window-semantics derivation)
**State transitions:** PENDING → IN_PROGRESS (04:30) → DONE (04:50).
**Goal:** Five read-only analytics endpoints whose outputs reproduce the legacy report's headline KPIs from the seeded dataset at DB-exact precision.
**Spec Reference:** specs/spec-014-v2.md; PRD §6/§8; TDD §8.
**Approach:** Reverse-engineered matched-window semantics from the Investment report's own Chart.js arrays BEFORE coding: invested = carry-in base (pre-window LPOs, AED 1,623,637) + in-window monthly commitments through window end; PCs bucket by parsed periodLabel (not invoiceDate); recovery = recovered÷(carry+window). Budget endpoint applies EXCLUDED_REFS lens (SWPS TEMW/REF/LPO//039) to committed side only. All aggregation server-side; jsonSafe fils strings.
**Checklist:**
  - [x] overview: total "1298411500" ✓, activeCount 140 ✓, suppliers 90 ✓, median "479950" ✓, largest SWPS "383250000" ✓, tradeBreakdown pcts sum≈100, monthlySeries
  - [x] budget: excl-SWPS rows — Electrical 85.03 under / HVAC 123.39 over / Plumbing committedFils "35362100" ≈117.87 over / FIRE_FIGHTING no_budget + excludedRefs/excludedFils meta
  - [x] cashflow: window ["2025-04","2026-05"], cumCertified final "1033197800", retentionTotal "48909700", variationClaims incl. exposure
  - [x] investment: investedTotal "1263848300", outstandingFinal = inv−rec, recoveryRatePct 81.75, peak "2025-12" @ "557628300"
  - [x] vendors: top8SharePct 79.33 (DCL-005b), repeatSuppliers 26, longTail 64, full cumulative curve
  - [x] 401 envelopes on all five unauthenticated; <500ms asserted (actual ~15–90ms)
**Outcome:** All v2 ACs green; DCL-005 filed (a: certified row-sum constant; b: top-8 anchor after canonicalization concentration; c: dataset-exact peak/outstanding vs report rounding). Human pre-approved gates 2026-08-24 → ratification recorded next G1 without prompting. Observation for spec-015: overview.flaggedCount=140 by PRD formula (verification≠VERIFIED and seed marks all imports PENDING/FLAGGED) — dashboards should present it as a "pending verification" nuance rather than an alarm.
**Test Evidence:** vitest 21 files / 118 tests passed; tsc clean; eslint clean; live curls show exact goldens.
**Blockers:** NONE
**Rollback:** Remove routes/service/tests.

### [2026-08-24 04:26] — T-020: Implement spec-013 Variation orders module
**Weight:** STANDARD
**State transitions:** PENDING → IN_PROGRESS (04:16) → DONE (04:26).
**Goal:** VO register CRUD (audited), strict status chain DRAFT→SUBMITTED→APPROVED/REJECTED, approval completeness enforcement, unapprovedVoExposure compliance KPI + UNAPPROVED_VO_CLAIM flag, admin VO screen with exposure banner.
**Spec Reference:** specs/spec-013-v1.md; PRD FR-7; TDD §5/§7.
**Approach:** Transition matrix in service (terminal APPROVED/REJECTED); approval demands approvedValueFils+approvedAt → 422 MISSING_APPROVAL; approvalRef captured in audit after-payload. Compliance is project-level aggregate per the spec Risks limitation (claims carry no per-VO split): exposure = Σ PC.variationClaimFils while any non-APPROVED VO exists, else 0; flag reconciled inside VO mutations AND on compliance GET read-path so PC-side claim edits stay fresh. Role gates ADMIN+COMMERCIAL write; no DELETE endpoint (financial record).
**Checklist:**
  - [x] GET|POST /projects/:id/vos; PATCH /vos/:id; GET /projects/:id/vos/compliance
  - [x] AC1 COMMERCIAL raise SUBMITTED → 201 + audit (fixture in reserved ≥900 range)
  - [x] AC2 incomplete approve → 422; complete → APPROVED, audit records JCA-VO-901-R1
  - [x] AC3 VO_BACKFILL remains OPEN after all operations
  - [x] AC4 exposure 0 → AED 94,001.00 w/ SUBMITTED VO over real claims (84,001 seeded + 10k fixture) → 0 after approval; flag OPEN→RESOLVED
  - [x] AC5 VIEWER PATCH → 403; terminal-status moves → 422 INVALID_TRANSITION
  - [x] Admin screen /admin/projects/[id]/vos: exposure banner, 3 KPI cards, table w/ StatusPill(vo)+linked LPO count, create/edit form incl. approve-with-details flow, "VOs" link in ProjectsClient
**Outcome:** All five ACs verified; suite leaves zero rows (reserved-range purge both ends). Real-data anchor discovered en route: Job 1571 carries AED 84,001.00 of variation claims (PC07 55,665.00 + PC13 28,336.00), so compliance live-smoke shows totalClaims=8400100 with zero exposure pre-backfill — the exact "11 unsubmitted VOs" exposure story from the PRD evidence base. Live smoke: compliance endpoint + VO register page verified. Dev-server note: stale .next after a killed dev run caused transient 500s with JSON manifest errors — rm -rf .next restart fixed (environmental, not app).
**Test Evidence:** vitest 20 files / 112 tests passed; tsc --noEmit clean; eslint clean; live curls in-session.
**Blockers:** NONE
**Rollback:** Remove routes/service/screen/tests; VO rows persist harmlessly (table empty outside tests).

### [2026-08-24 04:15] — T-019: Implement spec-012 Payment certificates module
**Weight:** SIGNIFICANT (includes DCL-004 spec correction)
**State transitions:** PENDING → IN_PROGRESS (03:57) → DONE (04:15).
**Goal:** PC CRUD with server-enforced integrity (net=gross−retention, gapless numbering advisory, cumulative cross-check), status workflow, audit, admin PC log screen.
**Spec Reference:** specs/spec-012-v2.md (v1 AC1 figure corrected per DCL-004); PRD FR-6; TDD §5/§7.
**Approach:** Extracted shared moneyString validator (validation/money.ts, budget-line.ts now imports it). Service enforces arithmetic → 422 ARITHMETIC_MISMATCH w/ field detail; duplicate pcNumber → 409 PC_NUMBER_TAKEN; PC_GAP + CUMULATIVE_MISMATCH raised as OPEN DataFlags inside the mutation tx with resolve-then-re-raise reconciliation; status transitions forward-only, PAID only from CERTIFIED. Role gates ADMIN+FINANCE write per TDD §7 matrix (spec v1's "FINANCE writes" read as shorthand — matrix is authoritative, consistent with every other module).
**Checklist:**
  - [x] GET|POST /projects/:id/pcs; PATCH|DELETE /pcs/:id (+audit rows)
  - [x] Seeded 14 PCs verified to the fils; Σ net = 1,033,197,800 fils (AED 10,331,978.00) — DCL-004 correction from spec's unverifiable 10,332,972.00
  - [x] Provenance surfaced via existing ProvenanceChip (OCR_ESTIMATE amber badge per Risks note)
  - [x] Admin screen /admin/projects/[id]/pcs: log table w/ Σ net footer, create/edit form, status advance buttons (→SUBMITTED/CERTIFIED/PAID), linked "PCs" action in ProjectsClient
  - [x] Test hygiene: suite owns pcNumbers ≥90 on project 1571, purges range beforeAll + afterAll
**Outcome:** All five ACs verified live against seeded Job 1571. Two test bugs found & fixed during the task (both mine): (1) DELETE test spliced its id with indexOf→−1 removing the WRONG cleanup entry, orphaning PC93 every run — root-caused via audit-log diffing + afterAll instrumentation; (2) earlier collision cascade (409→undefined id→404) masked the leak until a beforeAll purge made reruns deterministic. Live smoke: /api/v1/projects/220/pcs returns 14 items, PC13 gross 172,522.700 AED, PC01 SOURCE_DOCUMENT; admin page 200.
**Test Evidence:** vitest 19 files / 106 tests passed; tsc --noEmit clean; eslint clean; live curls in-session.
**Blockers:** DCL-004/spec-012-v2 ratification queued for next G1 (implementation proceeded per DCL-003 precedent).
**Rollback:** Remove routes/service/screen/tests; PC rows persist.

## Self-Corrections

### [2026-08-24 04:10]
**Earlier reasoning (now incorrect):** Test cleanup used `createdPcIds.splice(createdPcIds.indexOf(id), 1)` in the DELETE test without pushing the id first — indexOf returned −1 and `splice(-1, 1)` silently removed the last list entry (PC93's), leaking one row per run and cascading into 409-collision failures on reruns.
**Correction:** Removed the splice (row already deleted server-side); added deterministic beforeAll purge of the suite's reserved pcNumber ≥90 range. Lesson recorded: guard any indexOf-based removal; prefer building the keep-list rather than mutating by index.
**Impact:** Suite now leaves zero rows behind across repeated runs (verified empirically).

### [2026-08-24 04:05]
**Earlier reasoning (now incorrect):** Assumed spec-012-v1's Σ-net figure (AED 10,332,972.00) was extracted from the dataset like the rest of the seed anchors.
**Correction:** Row-sum is AED 10,331,978.00; the v1 figure matches no source and no computation (Δ exactly 994.00). Filed DCL-004 + drafted spec-012-v2 correcting only that constant; test asserts the dataset value.
**Impact:** No downstream spec references the absolute total (spec-014 uses ratios). Ratification queued.

### [2026-08-24 03:55] — T-018: Implement spec-011-v1 Budgets module (JCA lines + variance)
**Weight:** SIGNIFICANT
**State transitions:** PENDING → IN_PROGRESS (2026-08-23 05:00, session cut mid-flight; resumed 2026-08-24) → DONE.
**Goal:** JCA budget lines CRUD (audited), variance service (committed vs budget per trade w/ status bands + coverage gaps), BUDGET_DUPLICATE_LINE advisory rule, minimal admin Budget tab.
**Spec Reference:** specs/spec-011-v1.md; PRD FR-5; design.md §7/§8.
**Approach:** Resumed a half-written API layer (routes/service/validation existed with tsc errors). Fixed Prisma groupBy typing (`satisfies BudgetLineGroupByArgs`, `_sum` narrowing); added duplicate-line DataFlag inside the create transaction; moved the three JCA lines into prisma/seed.mjs (idempotent by sourceLabel, per-appendix I/II/III labels); rewrote integration suite to seed-owned data + tracked cleanup of its own rows; built /admin/projects/[id]/budget (variance table w/ under/watch/over/no-JCA-line bands, lines table, ADMIN+COMMERCIAL form, ADMIN-only delete) linked from Projects rows via "Budget" action.
**Checklist:**
  - [x] GET|POST /projects/:id/budget-lines; PATCH|DELETE /budget-lines/:id (ADMIN+COMMERCIAL write, DELETE admin-only, FINANCE 403)
  - [x] GET /projects/:id/variance — per-trade {budgetFils, committedFils, utilizationPct, status}; FIRE_FIGHTING coverage gap surfaced
  - [x] BUDGET_DUPLICATE_LINE advisory DataFlag on duplicate trade+category (severity LOW, OPEN)
  - [x] Mutations audited; PATCH diff reduced to changed key only (AC4 verified via auditLog row keys)
  - [x] Seed: JCA Appendix I/II/III = 7,000,000.00 / 500,000.00 / 300,000.00 AED, refDate 2025-01-23
  - [x] Admin screen: Administration → Projects → Budget tab (+ Budget link in projects table)
  - [x] Test hygiene: suppliers suite purges stale stamped fixtures beforeAll (dev DB had 40 leftover "Silver Waves … Equip mt*" rows flooding the capped top-20 suggestions list — fixed pre-existing AC5 flake)
**Outcome:** All five spec-011 ACs verified live against seeded Job 1571 (id 220): ELECTRICAL under @85.03%, HVAC over @123.39%, PLUMBING over (1395% — see Self-Corrections), FIRE_FIGHTING no_budget with AED 1,583,925 committed. Live smoke: variance API returns golden figures; /admin/projects/220/budget renders shell 200 (rows hydrate client-side); unauth page 307→/login.
**Test Evidence:** vitest 18 files / 99 tests passed (fileParallelism:false); tsc --noEmit clean; eslint clean (fixed unused-var warning in seed.mjs).
**Blockers:** NONE
**Rollback:** Remove routes/service/screen/tests; budget rows persist harmlessly.

## Self-Corrections

### [2026-08-24 03:50]
**Earlier reasoning (now incorrect):** WIP integration test asserted PLUMBING utilization ≈117.9% (the Job 1571 golden anchor from T-015 planning notes).
**Correction:** The 117.9%/85%/123.4% anchors require excluding SWPS-style out-of-scope packages (TEMW/REF/LPO//039 "Storm Water Pumping Station", AED 3.83M, is genuinely Plumbing in the source report). Spec-011 Risks explicitly defers exclusions ("v1 counts all non-cancelled latest-revision LPOs in-trade — documented limitation"); exclusion logic is spec-014 scope. Test now asserts v1 semantics (over, >100%) and the limitation is recorded here so spec-014 implements the anchor faithfully.
**Impact:** No code change to computeVariance; spec-014 must add configurable exclusions to hit all three golden anchors.

### [2026-08-24 03:46]
**Earlier reasoning (now incorrect):** Suspected my budgets changes broke suppliers.integration AC5.
**Correction:** Reproduced with changes stashed — pre-existing dev-DB pollution: repeated runs left stamped fixture suppliers that flooded the capped top-20 suggestions endpoint until the asserted pair fell out. Fixed by purging stale `Equip mt*` rows in beforeAll + one-time DB cleanup (40 rows); legit seeded supplier SILVER WAVES ELELCTRICAL EQUIPMENT TRADING untouched.
**Impact:** Suppliers suite stable again; no production code touched.

### [2026-08-23 04:48] — T-017: Implement spec-010-v1 LPO log screen
**Weight:** SIGNIFICANT
**State transitions:** PENDING → IN_PROGRESS (04:30) → DONE (04:48).
**Goal:** The register UI — filter bar, server-sorted table, revision-timeline drawer, CSV export, role-gated actions.
**Spec Reference:** specs/spec-010-v1.md; design.md §7–§9.
**Approach:** Server-side sort/filter/cursor pagination via buildQuery() (unit tested); TanStack table v8 (pinned back from v9 — features-map API mismatch); frozen first column via sticky CSS; drawer fetches /lpos/:id chain incl. new flagNote field (service extension under this spec's AC6); create drawer for PROCUREMENT; COMMERCIAL voId-only editor; read-only roles see no actions; toasts for background outcomes.
**Checklist:**
  - [x] Filter bar: debounced q (300ms), trade chips w/ dots, status/verification selects, date range, superseded toggle, clear-all
  - [x] Table: sticky header, frozen ref column, tabular right-aligned amounts, sortable issueDate/amountFils/refNo headers
  - [x] Load more cursor pagination + totals footer (activeCount · activeSumFils)
  - [x] CSV export with identical filter set
  - [x] Detail drawer: record fields, provenance chip, flag note, revision timeline (ref/rev/amount/superseded links)
  - [x] Role-gated actions per spec matrix; server 403s surface as messages
**Outcome:** All ACs verified live against seeded Job 1571 (id resolution code→numeric id fixed mid-task; ELECTRICAL filter = 52 rows / AED 5,952,274 matching report). Tests caught buildQuery leaking raw dates + "undefined" params. Note: status/verification filters shipped single-select (What said multi-selects) — simplification logged as Self-Correction below; upgrade deferred until a real user needs it.
**Test Evidence:** vitest 16 files / 94 tests passed; tsc clean; eslint clean; live curls: filtered list totals match report figures; CSV header+rows verified.
**Blockers:** NONE
**Rollback:** Remove screen files; APIs unaffected.

## Self-Corrections

### [2026-08-23 04:48]
**Earlier reasoning (now incorrect):** Spec-010 filter bar promised multi-selects for status/verification.
**Correction:** Shipped single-select dropdowns (with All option) — simpler UX at current data scale, no AC depended on multi.
**Impact:** Upgrade to multi-select when a user asks; noted here so it is not silently forgotten.

### [2026-08-23 04:24] — T-016: Implement spec-009-v1 Application shell & navigation
**Weight:** STANDARD
**State transitions:** PENDING → IN_PROGRESS (04:12) → DONE (04:24).
**Goal:** design.md §3 shell — role-aware sidebar, topbar, project context, tokens, shared primitives.
**Spec Reference:** specs/spec-009-v1.md; design.md §3–§8.
**Approach:** CSS-variable tokens (zinc/indigo, class-based dark) mapped via Tailwind v4 @theme; pure nav config unit-tested for role gating; SWR hooks for session/projects/context (?project= persisted in URL); primitives (StatusPill w/ full enum coverage, ProvenanceChip, TradeDot, KpiCard, EmptyState, ErrorBanner, PageHeader); route group (app) wraps all authenticated pages.
**Checklist:**
  - [x] globals.css tokens + dark variant
  - [x] AppShell: sidebar 240px / mobile drawer / sticky topbar / user menu + logout + dark toggle
  - [x] filterNav/canAccess role logic (ADMIN-only Administration group)
  - [x] StatusPill maps every Lpo/Pc/Vo/Verification enum; unknown → gray fallback
  - [x] Project switcher persists ?project=CODE defaulting first ACTIVE
  - [x] Deep-link preservation: middleware redirects to /login?next=<path>, LoginForm honors it
  - [x] Placeholder pages for pending M2 routes (each referencing its spec)
  - [x] Root / now redirects to /overview
**Outcome:** All spec-009 ACs verified (role gating + enum mapping by unit tests; shell render + deep-link live). Live smoke note: first curl omitted cookie → 307 was harness error; with cookie /overview returns shell markup.
**Test Evidence:** vitest 16 files / 90 tests passed; tsc clean; eslint clean; live curls in-session.
**Blockers:** NONE
**Rollback:** Remove components/layout/placeholders; APIs unaffected.

## Self-Corrections


### [2026-08-23 00:45] — T-001: Research source reports and extract domain model
**Weight:** STANDARD
**Goal:** Understand the three ProCare HTML reports for Job 1571 to ground platform requirements in verified facts.
**Spec Reference:** N/A — pre-spec research; findings recorded in PRD.md §6 Evidence Base.
**Approach:** Read all three HTML files; extracted entities (LPO log, PCs, JCA budget, VOs), KPI figures, and data-quality issues visible in the data.
**Checklist:**
  - [x] Read midisland_1571_full_report.html
  - [x] Read midisland_1571_procurement_PC _ dashboard.html
  - [x] Read midisland_1571_procurement_PC_ Invsetment - 24 07 26 (1).html
  - [x] Extract domain model, KPI formulas, and pain points
**Outcome:** Domain model and verified figures captured (AED 12.98M / 140 LPOs / 118 suppliers; PC01–PC14 certified AED 10.33M; JCA budgets; 11 unapproved VOs; investment gap AED 2.31M). Pain points identified: duplicate serial numbers, R1 revision suffixes, "NEED TO CHECK" line, ~AED 248K footer total discrepancy, misspelled supplier names.
**Test Evidence:** N/A — research only; findings are traceable to the three HTML files and summarized in PRD.md §6.
**Blockers:** NONE
**Rollback:** NONE — no code or files changed by this task.

### [2026-08-23 01:00] — T-002: Capture human product decisions
**Weight:** STANDARD
**Goal:** Record stakeholder decisions on scope, stack, and auth before drafting the PRD.
**Spec Reference:** PRD.md (input).
**Approach:** Interactive questions answered by human.
**Checklist:**
  - [x] Scope decision: multi-project platform (Job 1571 is seed dataset)
  - [x] Stack decision: Next.js + PostgreSQL (Prisma)
  - [x] Auth decision: role-based authentication required in v1
**Outcome:** Three product-level constraints confirmed by human and reflected in PRD.md §3/§5 and TDD.md §3.
**Test Evidence:** N/A — decision capture; recorded verbatim from human answers in session.
**Blockers:** NONE
**Rollback:** NONE.

### [2026-08-23 01:05] — T-003: Bootstrap protocol artifacts; draft PRD.md and TDD.md
**Weight:** SIGNIFICANT
**Goal:** Create the protocol artifact set (Memory.md, dev-changelog.md, spec-index.md, PRD.md, TDD.md, initial ADRs) per instruction_v4.md §14.
**Spec Reference:** instruction_v4.md (operating contract); outputs are PRD.md v0.1 and TDD.md v0.1.
**Approach:** Draft PRD grounded only in T-001 evidence; TDD derived from PRD plus human stack/auth decisions (T-002); ADRs written only where reasoning is fully justified (framework monolith, money representation, session strategy).
**Checklist:**
  - [x] Create Memory.md, dev-changelog.md, spec-index.md skeletons
  - [x] Write PRD.md v0.1 at project root (status DRAFT)
  - [x] Write TDD.md v0.1 at project root (status PROPOSED)
  - [x] Write ADR-001/002/003 as PROPOSED
  - [ ] Human review (moved to T-004)
**Outcome:** All protocol artifacts created. One earlier plan corrected: docs were first placed under `docs/`; instruction_v4.md §14 mandates project root — see Self-Corrections.
**Test Evidence:** N/A — documentation artifacts; verification is human review (T-004).
**Blockers:** NONE
**Rollback:** Delete the eight new .md files; nothing else touched.

### [2026-08-23 01:10] — T-004: Human sign-off of PRD v0.1 and TDD v0.1
**Weight:** STANDARD
**State transitions:** BLOCKED (2026-08-23 01:10) → DONE (2026-08-23 01:17) — human approval received.
**Goal:** Obtain explicit human approval of PRD v0.1 (product intent) and review of TDD v0.1 + ADR-001/002/003 before any implementation or atomic spec promotion.
**Spec Reference:** instruction_v4.md §4.2 (spec promotion), §10 gates.
**Approach:** Checkpoint summary with question prompts; explicit human ruling captured in-session.
**Checklist:**
  - [x] Human approves PRD v0.1 — APPROVED as baseline
  - [x] Human reviews TDD v0.1 and accepts ADR-001..003 — ACCEPTED
  - [x] Open Questions surfaced; OQ-1..OQ-8 remain open, none blocking spec drafting
**Outcome:** PRD.md status → APPROVED; TDD.md status → ACCEPTED; ADR-001..003 status → ACCEPTED. Baselines locked for M1 spec drafting.
**Test Evidence:** Manual sign-off by human on 2026-08-23 (in-session explicit approval via checkpoint questions).
**Blockers:** NONE
**Rollback:** NONE.

### [2026-08-23 01:22] — T-005: Draft design.md UI specification
**Weight:** SIGNIFICANT
**Goal:** Create a fresh, modern UI design system to govern all frontend work, per human directive that legacy HTML reports are business-requirements evidence only — never UI reference.
**Spec Reference:** design.md v0.1; constrained by PRD FR-8 personas/modules and TDD principles.
**Approach:** Token-based design system (color/type/space/radius), app shell layout, component inventory with behavior rules, data-viz standards, accessibility/responsive/motion specs, explicit anti-pattern list banning legacy-report styling.
**Checklist:**
  - [x] Capture human directive: no visual carry-over from base HTML files
  - [x] Write design.md with tokens, shell, components, charts, a11y, responsive
  - [x] Mark PROPOSED pending human review before frontend specs implement against it
**Outcome:** design.md v0.1 created at project root (status PROPOSED). Frontend specs will reference it section-by-section after acceptance.
**Test Evidence:** N/A — documentation artifact; verification is human review.
**Blockers:** NONE
**Rollback:** Delete design.md; nothing else depends on it yet.

### [2026-08-23 01:35] — T-006: Draft M1 atomic specs (spec-001..008)
**Weight:** SIGNIFICANT
**State transitions:** PENDING → IN_PROGRESS (2026-08-23 01:35) → DONE (2026-08-23 01:38).
**Goal:** Decompose milestone M1 (PRD FR-1/2/3/4/11 + TDD §14) into atomic, dependency-ordered specs with testable acceptance criteria.
**Spec Reference:** TDD.md §4/§5/§7/§8/§9; PRD.md FR sections; instruction_v4.md §4.2 template.
**Approach:** One spec per module concern; dependency chain scaffold → schema → auth → audit → projects/suppliers → LPO register → seed; acceptance criteria written as Given/When/Then including boundary "should NOT" cases; anti-hallucination applied notably in spec-008 (no fabricated VO rows — sources contain only an aggregate).
**Checklist:**
  - [x] spec-001-v1 Application scaffold & toolchain
  - [x] spec-002-v1 Database schema foundation
  - [x] spec-003-v1 Authentication & RBAC
  - [x] spec-004-v1 Audit trail service & API
  - [x] spec-005-v1 Projects module
  - [x] spec-006-v1 Suppliers vendor master
  - [x] spec-007-v1 LPO register
  - [x] spec-008-v1 Job 1571 seed pipeline
  - [x] spec-index.md populated (all DRAFT)
**Outcome:** Eight DRAFT specs created and indexed; presented at Gate G1 together with design.md v0.1 acceptance per human instruction.
**Test Evidence:** N/A — specs define the tests; their verification happens at implementation tasks.
**Blockers:** NONE
**Rollback:** Delete specs/*.md and revert spec-index.md/Memory.md entries.

### [2026-08-23 01:52] — Gate G1 closure: spec promotion + design acceptance
**Weight:** STANDARD
**State transitions:** BLOCKED → DONE (2026-08-23 01:52) — human ruling received.
**Goal:** Record the human checkpoint outcome for spec-001..008 and design.md v0.1.
**Spec Reference:** instruction_v4.md §4.2, §10.
**Checklist:**
  - [x] spec-001..008 promoted DRAFT → ACTIVE (human: "Promote all 8")
  - [x] design.md v0.1 ACCEPTED as UI baseline (human: "Accept design.md")
  - [x] spec-index.md and design.md status headers updated
**Outcome:** Implementation may proceed in dependency order starting at spec-001. OQ-1..OQ-8 remain open; none block M1 implementation except none — OQ-1 affects ADR-002 scope only if multi-currency ever confirmed.
**Test Evidence:** Manual sign-off by human on 2026-08-23 via in-session gate questions.
**Blockers:** NONE
**Rollback:** NONE.

### [2026-08-23 02:09] — T-007: Implement spec-001-v1 Application scaffold & toolchain
**Weight:** STANDARD
**State transitions:** PENDING → IN_PROGRESS (2026-08-23 01:52) → DONE (2026-08-23 02:09).
**Goal:** Bootstrap Next.js + Tailwind + Vitest + Prisma-wired skeleton with dev Postgres and /health per spec-001-v1.
**Spec Reference:** specs/spec-001-v1.md; TDD.md §2/§3/§8/§10; design.md (metadata only — no screens).
**Approach:** create-next-app in temp dir, rsynced into repo root excluding agent/README files; pinned next@15 to match ADR-001/spec (CNA defaulted to 16 — conflict resolved toward approved docs); added prettier/vitest/prisma; FlatCompat bridge for eslint-config-next@15 under ESLint 9.
**Checklist:**
  - [x] Scaffold moved to repo root; name procare-platform
  - [x] next@15.5.23 pinned (+eslint-config-next@15.5.0)
  - [x] docker-compose.yml Postgres 16 (host port 5433 — 5432 occupied by unrelated netflix-postgres container)
  - [x] .env.example / .env / prisma schema wiring point / src/server/db.ts singleton
  - [x] GET /api/health app+db status; /api/v1/[...path] 404 envelope; lib/api-envelope.ts + unit tests
  - [x] npm audit: 6 high (sharp<0.35 libvips CVEs) remediated via overrides sharp@0.35.3 → audit clean
  - [x] lint ✓ typecheck ✓ vitest 3/3 ✓
  - [x] Runtime ACs verified live: /health 200 {"ok","ok"} with db up; 503 {"degraded","down"} with db stopped; unknown route 404 envelope
**Outcome:** spec-001 acceptance criteria all verified. Implementation choices recorded: port 5433, sharp override (fixed version per GHSA-f88m-g3jw-g9cj), ESLint FlatCompat — none alter defined interfaces/data contracts.
**Test Evidence:** Command outputs in-session: curl /api/health (200 ok / 503 degraded), curl /api/v1/foo (404 envelope), `npm run lint` clean, `tsc --noEmit` clean, `vitest run` 1 file / 3 tests passed.
**Blockers:** NONE
**Rollback:** Remove scaffold files/dirs added this task; git history unaffected (no commits yet).

### [2026-08-23 02:25] — T-008: Implement spec-002-v1 Database schema foundation
**Weight:** STANDARD
**State transitions:** PENDING → IN_PROGRESS (2026-08-23 02:19) → DONE (2026-08-23 02:25).
**Goal:** Full Prisma schema per TDD §5 with initial migration, money lib, and BigInt JSON serialization convention.
**Spec Reference:** specs/spec-002-v1.md; TDD.md §5/§6; ADR-002.
**Approach:** Schema-first with explicit named self-relations for LPO revision chains; Restrict deletes on all financial relations; unique `(projectId, refNo)`/`(projectId, seq)`/`(projectId, pcNumber)`/`(projectId, voNumber)`; money lib uses pure string math (no floats); jsonSafe recursive serializer preserves Dates.
**Checklist:**
  - [x] prisma/schema.prisma — all 9 models + 9 enums + indexes/uniques
  - [x] Initial migration `20260822205046_init_core_schema` applied; `migrate status` up to date
  - [x] src/lib/money.ts parse/format (exact fils; AED prefix, commas, accounting negatives)
  - [x] src/lib/bigint-json.ts jsonSafe convention
  - [x] Integration tests against live DB: duplicate refNo rejected, project delete restricted, BigInt round-trip exact, supplier name uniqueness
  - [x] lint ✓ typecheck ✓ vitest 18/18 ✓ (4 files incl. integration)
**Outcome:** All spec-002 ACs verified. Notes: (1) tsconfig target ES2017→ES2022 for BigInt literals (+ stale tsbuildinfo removed); (2) case-insensitive supplier uniqueness implemented as service-layer uppercase invariant + DB @unique — Prisma cannot express lower() unique indexes without migration drift; documented in schema header and spec-index notes; (3) vitest alias config added.
**Test Evidence:** vitest run: 4 files / 18 tests passed (incl. spec002.integration.test.ts hitting live dev DB); tsc --noEmit clean; eslint clean; `npx prisma migrate status` = "Database schema is up to date!".
**Blockers:** NONE
**Rollback:** `prisma migrate resolve --rolled-back` + drop DB volume; remove lib/test files.

### [2026-08-23 02:48] — T-009: Implement spec-003-v2 Authentication & RBAC
**Weight:** SIGNIFICANT (spec deviation DCL-001 approved at G1 before implementation)
**State transitions:** PENDING → BLOCKED (02:32, G1 on DCL-001/spec-003-v2/ADR-004) → IN_PROGRESS (02:37, human approved "Approve v2 (jose)") → DONE (02:48).
**Goal:** Email/password auth with role-based access control per spec-003-v2.
**Spec Reference:** specs/spec-003-v2.md; TDD.md §7 matrix; ADR-004; design.md §3/§4/§6 (login screen).
**Approach:** Hand-rolled jose HS256 session layer split edge-safe (jwt.ts + middleware-guard.ts) vs node guards (guards.ts with live tokenVersion check); plain-Response routes for headless testability; in-memory rate limiter; argon2id via thin wrapper; user-add CLI script (.mjs).
**Checklist:**
  - [x] POST /auth/login — 200+cookie | 401 INVALID_CREDENTIALS generic | 429+Retry-After after 5 fails/IP+email/10min; success clears counter
  - [x] GET /auth/me — 401 envelope unauthenticated; {id,email,name,role} authenticated
  - [x] POST /auth/logout — idempotent, clears cookie
  - [x] POST /auth/password — verifies current, min-10 policy, bumps tokenVersion transactionally, reissues cookie
  - [x] Middleware guard: /api/v1/** 401 envelope when unauthenticated; pages 307→/login; signed-in /login → /
  - [x] requireAuth/requireRole server helpers (HttpApiError + apiHandler wrapper)
  - [x] Login page per design tokens (client form, error alert, pending state)
  - [x] npm run user:add script (role validation, random password printed once)
**Outcome:** All spec-003-v2 ACs verified both headless and on a live dev server. Dev DB retains admin@trends.local (ADMIN) created via script; throwaway smoke users deleted. Harness note: first live-check 401 was a curl jar path bug (/tmp/opencode missing), not an app fault — confirmed by header dump then clean rerun.
**Test Evidence:** vitest 7 files / 34 tests passed (session tamper/expiry, rate-limit windows, full login/me/password/logout/revocation integration incl. old-token rejection); tsc --noEmit clean; eslint clean; live curls: unauth 401 envelope, page 307→/login, login 200 Set-Cookie(HttpOnly,SameSite=Lax), me 200, logout Max-Age=0.
**Blockers:** NONE
**Rollback:** Remove auth module/middleware/login/script; users table persists harmlessly.

### [2026-08-23 02:55] — T-010: Implement spec-004-v1 Audit trail service & API
**Weight:** STANDARD
**State transitions:** PENDING → IN_PROGRESS (02:51) → DONE (02:55).
**Goal:** Atomic audit writes on business mutations plus ADMIN-only filtered/paginated read API.
**Spec Reference:** specs/spec-004-v1.md; TDD §5 (AuditLog), §8 (envelope/pagination).
**Approach:** `audit(tx, input)` service taking the caller's transaction client; deterministic diff via sorted-key normalization; changed-top-level-keys-only diffs for UPDATE, verbatim null semantics for CREATE/DELETE; cursor pagination with inclusive-cursor correction (skip:1).
**Checklist:**
  - [x] src/server/audit/service.ts — audit(), diffChangedKeys(), normalizeForAudit()
  - [x] GET /api/v1/audit — ADMIN-only; entity/entityId/from/to filters; limit≤100; nextCursor
  - [x] No mutating handlers on the route module (structural test)
  - [x] Unit tests: determinism, undefined-dropping, no-op diffs, passthrough payloads
  - [x] Integration tests: AC1 atomicity+attribution, AC2 rollback-on-audit-failure via broken-tx proxy, AC3/3b access+pagination, AC4 structure
**Outcome:** All spec-004 ACs verified. One real bug found and fixed by tests: Prisma cursor pagination is inclusive → added skip:1 when cursor present. jsonSafe applied so BigInt ids serialize as strings in responses.
**Test Evidence:** vitest 9 files / 46 tests passed; tsc --noEmit clean; eslint clean.
**Blockers:** NONE
**Rollback:** Remove service/route/tests; table persists harmlessly.

### [2026-08-23 03:08] — T-011: Implement spec-005-v1 Projects module
**Weight:** STANDARD
**State transitions:** PENDING → IN_PROGRESS (02:57) → DONE (03:08).
**Goal:** Project CRUD with role gates, audited mutations, field-level validation, minimal admin UI.
**Spec Reference:** specs/spec-005-v1.md; PRD FR-2; design.md §4/§7/§8.
**Approach:** Zod schemas shared API/UI (moneyString→parseMoney→fils with negative refinement); service wraps mutations in $transaction + audit(); apiHandler generalized for dynamic-route context; shared parseJsonBody helper (zod v4).
**Checklist:**
  - [x] GET|POST /api/v1/projects; GET|PATCH|DELETE /api/v1/projects/:id
  - [x] ADMIN RW, others R; 403/401 envelopes verified
  - [x] Duplicate code → 409 CODE_TAKEN; delete-with-LPOs → 409 HAS_DEPENDENTS (Restrict, no cascade)
  - [x] PATCH audits only changed keys — updatedAt excluded as volatile noise
  - [x] Field-level 422s: vatRate>1, negative amount, empty code, bad dates
  - [x] /admin/projects screen: list table + create/edit form + per-field errors + status pills
**Outcome:** All ACs verified headless + live smoke (page renders; POST with "1,000.50" → exact fils). Two convention fixes surfaced by tests/live smoke: (1) zod v4 flatten().fieldErrors is plain arrays (no _errors wrapper); (2) jsonSafe now honors toJSON — Prisma Decimal leaked internals before ("vatRate":{s,e,d}) → now "0.05"; Dates → ISO strings.
**Test Evidence:** vitest 10 files / 54 tests passed; tsc clean; eslint clean; live curls documented in-session.
**Blockers:** NONE
**Rollback:** Remove routes/service/validation/screen/tests; project rows persist.

### [2026-08-23 03:20] — T-012: Implement spec-006-v1 Suppliers vendor master
**Weight:** STANDARD
**State transitions:** PENDING → IN_PROGRESS (03:15) → DONE (03:20).
**Goal:** Vendor master with case-insensitive uniqueness, atomic audited merge, advisory duplicate suggestions.
**Spec Reference:** specs/spec-006-v1.md; PRD FR-3.
**Approach:** Service-layer normalization invariant (uppercase + collapsed whitespace) making DB @unique act case-insensitively; merge re-points LPOs via updateMany inside $transaction with alias append + MERGE audit row; suggestion heuristic = stop-token-filtered token sets with per-token levenshtein≤2 matching, containment allowed with ratio penalty, threshold 0.6, advisory only.
**Checklist:**
  - [x] GET|POST /suppliers (?q= filter); GET|PATCH /suppliers/:id (name/addAlias)
  - [x] POST /suppliers/:id/merge — ADMIN; 422 guards SELF_MERGE/ALREADY_MERGED/TARGET_MERGED
  - [x] GET /suppliers/duplicates/suggestions
  - [x] Unit tests: normalize, levenshtein, pairing flags real typo variants, non-flags distinct vendors
  - [x] Integration tests: AC1 409+existingId & stored-uppercase, AC2 full merge semantics + single audit row, AC3 TARGET_MERGED, AC4 role gates, AC5 seeded Job-1571-style typo pair returned
**Outcome:** All spec-006 ACs verified. No UI in this scope (vendors page arrives with M2 dashboards per design.md shell). One test corrected to match designed containment behavior (LLC as stop-token).
**Test Evidence:** vitest 12 files / 65 tests passed; tsc clean; eslint clean.
**Blockers:** NONE
**Rollback:** Remove routes/service/tests; supplier rows persist.

### [2026-08-23 03:44] — T-013: Implement spec-007-v1 LPO register
**Weight:** SIGNIFICANT
**State transitions:** PENDING → IN_PROGRESS (03:28) → DONE (03:44).
**Goal:** Core register: ref generation, revision chains, filters/pagination/totals, CSV export, VO linkage, verification flags, role-scoped patches.
**Spec Reference:** specs/spec-007-v1.md; PRD FR-4; TDD §5/§7/§8; design.md §7/§8.
**Approach:** Service-level revision engine — financial edits on ISSUED create successors (base ref + R{n} suffix, fresh per-project seq slot, predecessor immutable via supersededById); descriptive/lifecycle edits in place; COMMERCIAL restricted to voId-only patches; read-only roles 403 at service gate; FLAGGED verification opens/resolves DataFlag rows; CSV export paginates through the same filter pipeline.
**Checklist:**
  - [x] POST/GET /projects/:id/lpos (+ ?q insensitive, trade/status/verification/supplier/date/sort/cursor/includeSuperseded)
  - [x] GET|PATCH /lpos/:id incl. chain endpoint; POST /projects/:id/lpos/revisions alias
  - [x] GET /projects/:id/lpos/export CSV
  - [x] Totals meta: activeCount + activeSumFils respecting filters, excluding CANCELLED unless explicitly filtered
  - [x] DCL-002 filed: UI screen re-scoped to M2; spec-007-v2 drafted (G1 ratification pending)
**Outcome:** All eight spec-007 ACs verified. Bugs caught by tests along the way: requireRole() with zero roles denied everything (route switched to requireAuth); VARIATION-without-voId was not enforced on create; revision path hardcoded kind=VARIATION breaking STANDARD patches; refNo/seq collision on revisions resolved with R-suffix refs + own seq slot per revision; LPO-log UI re-scoped to M2 via DCL-002 (spec-007-v2 awaiting G1). Dev logins created for human: one user per role @trends.local (passwords handed in-session, never stored in tracked files).
**Test Evidence:** vitest 13 files / 75 tests passed sequentially (fileParallelism:false — shared dev DB); tsc clean; eslint clean.
**Blockers:** NONE
**Rollback:** Remove routes/service/validation/tests; lpo rows persist.

### [2026-08-23 04:01] — T-014: Implement spec-008-v2 Job 1571 seed pipeline
**Weight:** SIGNIFICANT
**State transitions:** PENDING → IN_PROGRESS (03:48) → DONE (04:01).
**Goal:** Migrate Job 1571 from delivered HTML reports into the live database, idempotently.
**Spec Reference:** specs/spec-008-v2.md (threshold correction per DCL-003); PRD §10; TDD §9.
**Approach:** Deterministic regex extractor (fail-fast on missing structures + spot checks) → prisma/seed-data/job1571.json; idempotent seeder with conservative canonicalization map (aliases preserve raw spellings), sequential seq allocation for new rows only, PC provenance mapping, four known-issue DataFlags.
**Checklist:**
  - [x] scripts/extract-seed.mjs — 140 LPOs / 14 PCs / deterministic output / loud failures
  - [x] prisma/seed.mjs (+ npm scripts extract:job1571, seed:job1571 via --env-file)
  - [x] Project 1571 shell incl. contract CHEC-MIP1C-B2-2025-006
  - [x] Suppliers canonicalized (90 vendors from 103 name strings), aliases preserved
  - [x] 140 LPOs IMPORTED_REPORT/PENDING; 14 PCs w/ provenance map
  - [x] Flags: SOURCE_NEEDS_CHECK(+verification=FLAGGED), CROSS_JOB_SPLIT, TOTALS_MISMATCH, VO_BACKFILL
  - [x] VariationOrder count stays 0 (no fabricated VOs)
**Outcome:** All spec-008-v2 ACs verified live; second seed run = zero changes. Fixes during task: toFils NaN→null for "n/a" retention (PC03); supplier fixtures made stamp-unique after real seed data collided with test literals (UNIGULF now owned by production data). Threshold honesty trail: DCL-003 + DRAFT v2 correction (≥85 post-canonicalization) pending G1.
**Test Evidence:** vitest 14 files / 80 tests passed incl. seed.integration (dataset spot checks to the fils, totals match JSON sum, alias preservation, flags OPEN, VO table empty, rerun-idempotency snapshot equal).
**Blockers:** NONE
**Rollback:** Reset script (delete project subtree by code 1571 cascade).

### [2026-08-23 04:10] — Gate G1 closure: M2 batch ratified
**Weight:** STANDARD
**State transitions:** BLOCKED → DONE (2026-08-23 04:08) — human ruled 'Promote all 7'.
**Checklist:**
  - [x] spec-009..015 promoted DRAFT → ACTIVE
**Outcome:** M2 implementation authorized in order 009→010→011→012→013→014→015.
**Test Evidence:** Manual sign-off by human on 2026-08-23 via gate question.
**Blockers:** NONE
**Rollback:** NONE.


### [2026-08-23 04:04] — Gates G1+G5 closure: DCL ratifications + M1 complete
**Weight:** STANDARD
**State transitions:** BLOCKED → DONE (2026-08-23 04:04) — human ratified both and directed frontend work.
**Checklist:**
  - [x] DCL-002/spec-007-v2 ratified (UI re-scope to M2)
  - [x] DCL-003/spec-008-v2 ratified (supplier threshold correction)
  - [x] M1 milestone confirmed complete (G5)
**Outcome:** spec-007-v2 and spec-008-v2 → IMPLEMENTED. M1 closed with 80/80 tests across 14 files.
**Test Evidence:** Manual sign-off by human on 2026-08-23 ("Yes" at combined checkpoint).
**Blockers:** NONE
**Rollback:** NONE.

### [2026-08-23 04:08] — T-015: Draft M2 atomic spec batch (spec-009..015)
**Weight:** SIGNIFICANT
**Goal:** Decompose M2 (frontend kickoff + money modules + analytics + dashboards) into dependency-ordered specs.
**Spec Reference:** TDD §14 milestone table; PRD FR-5/6/7/8; design.md throughout.
**Checklist:**
  - [x] spec-009 App shell & navigation (tokens land here)
  - [x] spec-010 LPO log screen (DCL-002 deliverable)
  - [x] spec-011 Budgets module
  - [x] spec-012 Payment certificates module
  - [x] spec-013 Variation orders module
  - [x] spec-014 Analytics engine (golden-value regression anchors from Job 1571)
  - [x] spec-015 Dashboard screens (six ProCare tabs live)
  - [x] spec-index updated; all seven DRAFT pending G1
**Outcome:** M2 plan presented for Gate G1. Implementation order respects dependencies; golden Job 1571 figures embedded as test anchors (85% / 123.4% / 117.9% utilizations, recovery ≈81.8%, top-8 ≈76%, totals to the fils).
**Test Evidence:** N/A — specs define the tests.
**Blockers:** NONE
**Rollback:** Delete the seven spec files; revert index.

## Self-Corrections

### [2026-08-23 01:05]
**Earlier reasoning (now incorrect):** Plan was to place PRD/TDD under `docs/PRD.md` and `docs/TDD.md`.
**Correction:** instruction_v4.md §14 file map requires `PRD.md`, `TDD.md`, `spec-index.md`, `dev-changelog.md`, `Memory.md` at project root, with `specs/` and `decisions/` directories.
**Impact:** Paths changed; empty `docs/` directory removed. No content lost (the aborted write had failed before this session's writes).

## Open Questions
- OQ-1: Is AED the only currency, ever? (Assumed yes in TDD money design.) — raised 2026-08-23
- OQ-2: Is Arabic UI/localization on any roadmap horizon? (Assumed no for v1.) — raised 2026-08-23
- OQ-3: Deployment target — cloud provider, on-prem server, or undecided? (Affects ops/backup design.) — raised 2026-08-23
- OQ-4: Should invoice/document attachments be stored against LPOs/PCs in v1? (Assumed P1+.) — raised 2026-08-23
- OQ-5: Do users need per-project access restrictions soon, or company-wide roles suffice? (Assumed company-wide.) — raised 2026-08-23
- OQ-6: Is a formal LPO approval workflow needed pre-issue, or free issuance matches current practice? (Assumed free issuance + revisions.) — raised 2026-08-23
- OQ-7: ~~Retention release tracking — confirm it belongs in fast-follow (P1).~~ CLOSED 2026-08-24 — human confirmed in-scope M3 at G1; implemented via spec-019.
- OQ-8: Who is the bootstrap admin account for, and what email should own it at first login? — raised 2026-08-23
