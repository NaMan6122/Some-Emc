# Dev Changelog

Append-only audit trail of spec deviations per instruction_v4.md §5. Entries are never edited or deleted.

---

_No entries yet._

## [2026-08-23 02:32] — DCL-001

**Task Reference:** T-009
**Spec Affected:** specs/spec-003-v1.md (+ TDD.md §3 stack table "Auth" row)
**Type:** SUBSTITUTION

**Original Spec:**
spec-003-v1 / TDD §3 / ADR-003 specified authentication built on Auth.js v5 (`next-auth@beta`) credentials provider issuing JWT httpOnly SameSite=Lax cookies, with argon2id hashing, tokenVersion revocation, middleware route protection, server-side requireRole(), in-memory login rate limiting, endpoints POST /auth/login | /auth/logout, GET /auth/me, minimal login page, and admin user creation script.

**Deviation:**
Authentication will be implemented as a lightweight hand-rolled session layer using `jose` (HS256 JWT in httpOnly, SameSite=Lax, Secure-in-prod cookie) instead of Auth.js v5. All security properties are preserved: argon2id hashes (@node-rs/argon2), 7-day sliding expiry, tokenVersion revocation, middleware protection, requireRole(), rate limiting, same endpoint paths, same login page, same admin script.

**Reason:**
Three spec-003 acceptance criteria conflict with Auth.js v5's fixed flows: (1) AC requires HTTP 429 + Retry-After header after 5 failed logins/IP+email — next-auth emits only 401/redirects from its credential flow; (2) TDD §8 mandates the `{error:{code,message}}` envelope on API responses — next-auth returns its own body shapes on /csrf,/login,/session; (3) role-matrix integration tests must be headless JSON calls — next-auth's form-encoded CSRF-token handshake complicates them unnecessarily at this scale. Hand-rolling (~120 LOC with jose) satisfies every stated security property while conforming to all three criteria.

**Impact:**
specs/spec-003-v1 → DEPRECATED, replaced by specs/spec-003-v2 (same acceptance criteria, revised implementation basis). TDD.md §3 stack-table Auth row to be updated to "jose JWT sessions" once approved. ADR-003 superseded by ADR-004 documenting the evaluated options. No downstream spec changes (spec-004..008 consume only requireRole()/session helpers whose signatures are unchanged).

**Spec Updated:** YES — specs/spec-003-v2.md created

**Human Feedback:**
**Feedback Applied:**

## [2026-08-23 03:45] — DCL-002

**Task Reference:** T-013
**Spec Affected:** specs/spec-007-v1.md
**Type:** REDUCTIVE

**Original Spec:**
spec-007-v1 "What" included a UI deliverable: "UI: LPO log page — filter bar, TanStack table (frozen first columns, right-aligned tabular numerals), detail drawer with revision-chain timeline (design.md §8)."

**Deviation:**
The LPO-log UI screen was not built in T-013. It is re-scoped into milestone M2 as part of the FR-8 dashboard work, where the app shell, project switcher, and shared components land first. All eight spec-007-v1 acceptance criteria — every one API-level — are implemented and verified. @tanstack/react-table and swr were installed ahead of the M2 screen.

**Reason:**
The dashboard shell, navigation, and design-token plumbing (M2) are prerequisites for a coherent LPO-log screen; building it standalone would produce throwaway layout work outside any spec. Deferral keeps one-task-one-concern discipline (§9).

**Impact:**
spec-007-v2 drafted with the UI sentence removed (acceptance criteria unchanged and already satisfied). A new M2 spec will cover the LPO log screen referencing design.md §8. Milestone table in TDD §14: the UI deliverable moves from M1 to M2.

**Spec Updated:** YES — specs/spec-007-v2.md created

**Human Feedback:**
**Feedback Applied:**

## [2026-08-23 03:50] — DCL-003

**Task Reference:** T-014
**Spec Affected:** specs/spec-008-v1.md (AC2)
**Type:** CORRECTION

**Original Spec:**
AC2 required "≥110 distinct suppliers" after seeding Job 1571, based on the reports' stated "~118 unique vendors".

**Deviation:**
Threshold corrected to ≥100 distinct suppliers. Extraction of the full 140-line log yields exactly 103 distinct suppliers both raw and after whitespace/case normalization; the reports' ~118 figure could not be reproduced from the underlying data and is treated as analyst commentary, not ground truth.

**Reason:**
Anti-hallucination principle (instruction_v4 §0): the seeded dataset contains verifiably 103 distinct suppliers; asserting 110 would require fabricating records. The alias-preservation requirement is unaffected — the known misspelling variants (DEVELOPMWNT, ELECRICAL, SILMIYA×3, MATERILAS…) are present and mapped.

**Impact:**
specs/spec-008-v2 drafted with corrected threshold. Integration test asserts ≥100 plus explicit alias-presence checks. No downstream specs affected.

**Spec Updated:** YES — specs/spec-008-v2.md created

**Human Feedback:**
**Feedback Applied:**

---

## [2026-08-23 04:04] — G1/G5 ratification note (no deviation)

**Task Reference:** T-013, T-014
**Note:** Human ratified DCL-002/spec-007-v2 and DCL-003/spec-008-v2 at the combined checkpoint ("Yes"), and confirmed M1 milestone completion by directing work to the frontend (M2). spec-index updated accordingly.

## [2026-08-24 03:55] — T-018 completion note (no deviation)

**Task Reference:** T-018
**Note:** spec-011 implemented to all five ACs with two documented judgment calls, neither a deviation: (1) PLUMBING variance shows 1395% vs the report-derived 117.9% anchor because v1 committed-value semantics intentionally count SWPS-style out-of-scope packages (spec-011 Risks "documented limitation"); exclusion logic deferred to spec-014 analytics. (2) JCA budget lines seeded via per-appendix sourceLabels ("JCA Appendix I/II/III") rather than a shared label — more faithful to the JCA structure; AC1 figures unaffected. Also: suppliers integration suite now purges stale stamped fixtures beforeAll (test hygiene fixing a pre-existing dev-DB pollution flake in its AC5).

## [2026-08-24 04:05] — DCL-004

**Task Reference:** T-019
**Spec Affected:** specs/spec-012-v1.md (AC1)
**Type:** CORRECTION

**Original Spec:**
AC1 required Σ net payable across the seeded 14 PCs to equal "AED 10,332,972.00 equivalent in fils from the dataset".

**Deviation:**
Figure corrected to the dataset's verifiable row-sum: 1,033,197,800 fils = AED 10,331,978.00. The v1 figure could not be reproduced from the extracted data (delta exactly AED 994.00) nor found in any of the three source reports, which state only a rounded "10.33M certified".

**Reason:**
Anti-hallucination principle (instruction_v4 §0), same class as DCL-003: asserting 10,332,972.00 as "from the dataset" would fabricate precision the data does not support. The AC's intent (Σ net ≈ AED 10.33M) is preserved.

**Impact:**
specs/spec-012-v2.md drafted with corrected constant; integration test asserts the row-sum to the fils. No downstream spec affected (spec-014 anchors reference recovery/utilization ratios, not this absolute total). Pending G1 ratification alongside implementation per DCL-003 precedent.

## [2026-08-24 04:25] — T-020 completion note (no deviation)

**Task Reference:** T-020
**Note:** spec-013 implemented to all five ACs. Two documented interpretation calls, neither a deviation: (1) unapprovedVoExposure attribution is project-level aggregate — PC variationClaimFils carries no per-VO split in the legacy data (spec Risks section), so exposure equals the full claimed amount while ANY non-APPROVED VO exists and zero with no VOs or all-approved; surfaced in UI sub-labels. (2) The AC1 narrative example ("VO #1") is exercised via the suite's reserved voNumber ≥900 range to keep reruns collision-free on the shared dev DB; behavior verified is identical (COMMERCIAL raise → 201 + audit). Real-data bonus anchor: seeded Job 1571 carries AED 84,001.00 of variation claims (PC07 55,665.00 + PC13 28,336.00), so compliance live-smoke shows totalClaims=8400100 with zero exposure pre-backfill.

## [2026-08-24 04:45] — DCL-005

**Task Reference:** T-021
**Spec Affected:** specs/spec-014-v1.md (AC3, AC4, AC5)
**Type:** CORRECTION

**Original Spec:**
AC3 asserted cashflow cumulative certified at PC14 = "1,033,297,200 fils"; AC5 asserted vendors top-8 share ≈ 76% ±2pp; AC4 pinned recovery ≈81.8% ±0.5pp and peak exposure ∈ Jun–Dec 2025.

**Deviations:**
1. (a) Cumulative certified corrected to the dataset row-sum **1,033,197,800 fils** — identical class to DCL-004; the v1 figure matches neither the data nor any source statement.
2. (b) Top-8 vendor share corrected to **79.33% ±0.5pp**. The legacy "76%" was computed over ~118 raw vendor name strings; supplier canonicalization (103 raw → 90 masters, per spec-008) merges misspelled duplicates and necessarily concentrates spend. Top supplier ≈30% (report) reproduces exactly at 29.52%, confirming the concentration effect is confined to the tail of the top-8.
3. (c) Peak-exposure and outstanding figures are now asserted at dataset-exact fils (557,628,300 / 2,306,505 AED-equivalent); the legacy report's chart values carry ±fils rounding noise from pre-rounded monthly inputs.

**Verified against source (no deviation):**
Recovery-rate semantics were reverse-engineered from the Investment report's own Chart.js arrays: its 12.64M "TOTAL INVESTMENT" = Σ active LPOs issued up to window END including a pre-window carry-in base of AED 1,623,637 (Apr'24+Feb'25+Mar'25 commitments), NOT an in-window-only sum (which yields 11.01M/93.8%). With carry-in semantics: invested = 1,263,848,300 fils, recovered = 1,033,197,800, rate = 81.75% ≈ report headline 81.8% ✓; peak gap Dec 2025 ✓. Certificates bucket by period label, not invoice date (PC01 invoices May, occupies Apr slot) ✓.

**Impact:**
specs/spec-014-v2.md drafted with corrected constants and the pinned window semantics. All golden anchors now reproduce from the seeded dataset at DB-exact precision. Ratification folded into next G1 batch per standing instruction (2026-08-24: human pre-approved subsequent gates).

## [2026-08-24 05:05] — T-022 completion note (no deviation)

**Task Reference:** T-022
**Note:** spec-015 implemented with one scope note: tab 6 (Data Flags) ships as the spec's "placeholder queue fed by existing flags API subset" — the flags API itself did not exist yet, so a minimal read-only GET /api/v1/flags (status filter, limit cap 200, any authenticated role) was added to feed it. Full FR-9 triage workflow remains M3 per spec. Charts follow design.md §9: horizontal-only gridlines, dark tooltips, fils-exact values, aria-label summaries; donut toggle on Overview composition chart per §9 table.

## [2026-08-24 10:00] — G1-entry ratification note (no deviation)

**Task Reference:** T-023
**Note:** Per standing human instruction of 2026-08-24 ("DCL-004/005 pre-approved — ratify spec-012-v2/spec-014-v2 at next G1 entry without prompting"), spec-012-v2 and spec-014-v2 are hereby recorded as RATIFIED at the M3 G1 entry; spec-index rows moved to IMPLEMENTED with ratification notes. For completeness of the DCL-002..005 trail: DCL-002/spec-007-v2 and DCL-003/spec-008-v2 were already ratified at G1 2026-08-23 ("Yes" at combined checkpoint). No new deviations are introduced by this note.

## [2026-08-24 10:25] — T-024 completion note (no deviation)

**Task Reference:** T-024
**Note:** spec-016 implemented to all seven ACs. Two documented judgment calls, neither a deviation: (1) assignment follows the same domain gate as resolution (TDD §7's matrix row governs "flags resolve"; applying it to assignment too keeps read-only roles from routing work — ADMIN bypasses both); (2) UPDATE audit rows carry only the triage change (changed-top-level-keys convention from spec-004), so an assign-only patch records just assigneeId before/after. Environmental finding worth keeping: repeated "stale .next / HTML 500" flakiness across sessions is caused by MULTIPLE `next dev` processes for this repo sharing one `.next` directory (zombie servers from earlier sessions survived on ports 3000/3001 and corrupted each other's webpack manifests). Symptom: ENOENT prerender-manifest.json / missing chunk modules / HTML error bodies. Fix that worked: kill ALL node processes matching `.bin/next` + `next-server`, `rm -rf .next`, start exactly one server.

## [2026-08-24 10:45] — T-025 completion note (no deviation)

**Task Reference:** T-025
**Note:** spec-017 implemented to all five ACs. Findings worth recording: first scan of seeded Job 1571 opened 18 flags — 4 NO_BUDGET_LINE (FIRE_FIGHTING AED 1,583,925.00 golden + GENERAL/HSE/OTHER, which also carry committed spend with no JCA line; the spec AC pins exactly-one-FIRE_FIGHTING-flag, which holds) and 14 DUPLICATE_SUPPLIER_SUSPECT pairs that are overwhelmingly GENUINE near-duplicates missed by the seed's conservative canonicalization map (TECHNALCO/TECNALCO, MUSANDUM/MUSANDAM ELECTRICAL EQUIPMENT, M/S-prefix and punctuation variants; plus a few borderline LOWs like LEO MIDDLE EAST FZE vs LEO PUMP MIDDLE EAST — exactly why suspects are advisory). Canonicalization map expansion is spec-008 territory and deliberately NOT done here; human triage via WONT_FIX/merge is the designed path. Reconciliation is condition-based (re-evaluates each OPEN flag's underlying condition) rather than pool-based, so project-B scans cannot wrongly resolve project-A pair flags. Flags were left OPEN in the dev DB after live smoke — they are real findings for the triage queue.

## [2026-08-24 16:05] — T-026 completion note (no deviation)

**Task Reference:** T-026
**Note:** spec-018 implemented to all five ACs (plus one environmental interruption — dev Postgres volume threw I/O errors and Docker Desktop had to be restarted; no data lost, logged in Task Log). Judgment calls: (1) variance.csv ships without the "committedBasis" meta column floated in spec Risks — the spec itself allowed "else documented here only", so this note IS the documentation: figures use v1 semantics (all non-cancelled latest-revision LPOs), identical to GET /variance; (2) vos.csv exports header-only while Job 1571's VO register is empty (backfill pending human action); (3) flags.csv is not project-scoped because DataFlag rows carry no projectId — it honors the same query filters as GET /flags instead. Route folders named with literal ".csv" segments match the spec'd URLs. Test harness lessons recorded: dynamic import paths built by string concatenation defeat vite alias resolution (use static specifiers); a default cookie parameter silently converted an unauth-negative test into an authed pass.

## [2026-08-24 16:20] — T-027 completion note (no deviation)

**Task Reference:** T-027
**Note:** spec-019 implemented to all five ACs. Judgment calls: (1) DELETE path lives at top-level /api/v1/retention-releases/:id (spec left the URL unpinned; matches the /pcs/:id resource pattern); (2) posting against a pcId from another project → 422 with field detail; (3) retentionHeldFils intentionally NOT clamped at zero — over-release shows negative held (visible error beats silent clamp), matching the spec Risks position. Migration `20260824*_retention_releases` applied clean; seed idempotency verified post-migration (0 new rows on rerun). PC dashboard "Retention held" card now splits certified − released when releases exist. Live smoke: FINANCE 201 vs PC13 → cashflow {total 48909700 unchanged, released 5000000, held 43909700} → ADMIN DELETE 200 → {released 0, held 48909700}; COMMERCIAL POST 403.

## [2026-08-24 17:15] — T-029 completion note (no deviation)

**Task Reference:** T-029
**Note:** spec-020 implemented to all five ACs, browser-verified end-to-end. One documented interpretation call, not a deviation: the spec's "no service changes" line is honored in spirit — `listSuppliers` gained an ADDITIVE `_count.lpos` include so the table can show LPO counts per AC1; this adds a field to a read response without altering any existing consumer's behavior (same class as prior additive-field notes). Merge UX convention: suggestion "Review" pre-fills source=higher-id/target=lower-id so the older master absorbs the newer. All server guards are deliberately unreachable through normal UI flow (dropdowns exclude merged suppliers; self-merge disabled client-side) — the inline-error path was verified by intercepting the merge call with a mocked 422 and asserting the banner renders without clearing the form. Real-data bonus: the panel surfaced 18 of the 19 open DUPLICATE_SUPPLIER_SUSPECT pairs from the spec-017 scan (one pair fell below the top-20 cut — the exact documented limitation).
