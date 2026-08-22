# Agent Memory

## Session Summary
Last Session: 2026-08-23 02:12
Active Task: T-008 — Implement spec-002 (DB schema foundation) — PENDING
Last File Touched: Memory.md
Immediate Next Step: Start T-008: full Prisma schema per TDD §5, initial migration, money lib + BigInt serialization convention with tests.

## Session Summary
Last Session: 2026-08-23 02:19
Active Task: T-008 — Implement spec-002 (DB schema foundation) — IN_PROGRESS
Last File Touched: Memory.md
Immediate Next Step: Write full Prisma schema per TDD §5, create initial migration, add money lib + BigInt JSON convention with tests, verify all spec-002 ACs against live DB.

## Session Summary
Last Session: 2026-08-23 02:33
Active Task: T-009 — Implement spec-003 (Auth & RBAC) — BLOCKED on Gate G1 for spec-003-v2 (DCL-001)
Last File Touched: dev-changelog.md
Immediate Next Step: On human approval of spec-003-v2 + ADR-004, implement jose-based auth layer per v2 acceptance criteria.

## Active Task
T-013 — Implement spec-007-v1: LPO register
State: PENDING
Started: —
Last Updated: 2026-08-23 03:20

## Task Log

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
- OQ-7: Retention release tracking — confirm it belongs in fast-follow (P1). — raised 2026-08-23
- OQ-8: Who is the bootstrap admin account for, and what email should own it at first login? — raised 2026-08-23
