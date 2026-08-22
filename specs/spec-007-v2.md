# spec-007-v2: LPO register

**Status:** DRAFT — re-scope per DCL-002; awaiting Gate G1 ratification (implementation of the API scope already verified under v1)
**Version:** 2
**Depends On:** spec-003, spec-004, spec-005, spec-006
**Blocks:** spec-008
**Task Reference:** T-013

## What
The LPO register API — identical to v1 except that the UI screen bullet is removed and re-scoped to M2 dashboard work (see DCL-002). `POST|GET /api/v1/projects/:id/lpos`, `GET|PATCH /api/v1/lpos/:id`, `POST /api/v1/projects/:id/lpos/revisions` (alias), `GET /api/v1/projects/:id/lpos/export` (CSV). Auto ref generation per project sequence in the `TEMW/REF/LPO//NNN` style; revisions append an R-suffix (`…//061R1`) while each revision occupies its own per-project seq slot; chains linked via revisionOfId/supersededById. Financial edits on ISSUED records create revisions; descriptive fields edit in place; status transitions validated. VARIATION kind requires a same-project voId. FLAGGED verification requires a ≥3-char note and opens/resolves DataFlag rows. Filters: trade, status, verification, supplierId, date range, case-insensitive free-text q, sort, cursor pagination, includeSuperseded; totals meta (activeCount/activeSumFils) respects filters and always excludes CANCELLED unless explicitly requested. Roles: ADMIN/PROCUREMENT write; COMMERCIAL only voId patches; FINANCE/MANAGEMENT/VIEWER read-only.

## Acceptance Criteria
_Unchanged from v1 — all eight verified 2026-08-23 (see Memory.md T-013):_
1. Concurrent creation never yields duplicate `(projectId, refNo)` — retries allocate distinct sequences.
2. Financial PATCH on ISSUED → successor (revisionNo+1), predecessor immutable with supersededBy set; default list shows latest only; totals reflect latest non-cancelled.
3. Descriptive-only PATCH edits in place + audit, no revision.
4. CANCELLED visible via filter but excluded from default totals.
5. VARIATION linkage: missing voId → 422 VO_REQUIRED; foreign/unknown VO → 422 VO_INVALID; voId on non-VARIATION → 422 KIND_VO_CONFLICT.
6. FLAGGED without ≥3-char note → 422; valid note opens a DataFlag; VERIFIED resolves it.
7. CSV export matches filtered API result exactly (header + one row per item).
8. COMMERCIAL non-voId patch → 403; FINANCE/MANAGEMENT/VIEWER mutations → 403.

## Risks
Revision semantics remain the most intricate area — golden integration tests (75-test suite) anchor chain integrity and totals behavior.

## Rollback
Remove routes/service/validation/tests; imported data persists.
