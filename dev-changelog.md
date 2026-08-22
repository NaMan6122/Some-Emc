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
