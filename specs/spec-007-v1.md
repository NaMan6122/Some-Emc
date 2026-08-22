# spec-007-v1: LPO register

**Status:** DRAFT
**Version:** 1
**Depends On:** spec-003, spec-004, spec-005, spec-006
**Blocks:** spec-008
**Task Reference:** —

## What
The core register per PRD FR-4: `POST|GET /api/v1/projects/:id/lpos`, `PATCH /api/v1/lpos/:id`, `POST /api/v1/lpos/:id/revisions`. Auto ref generation per project sequence preserving the `TEMW/REF/LPO//NNN` prefix style; kind/status/verification enums; optional `voId` link required when `kind=VARIATION`. Revision rule: PATCH touching financial fields (`amountFils, supplierId, trade, issueDate, vatRate, voId`) on an ISSUED LPO creates a successor (revisionNo+1, chain rooted at revisionOfId, predecessor `supersededBy` set, original immutable); descriptive fields (description, remark) edit in place with audit. Filters: trade, status, verification, supplierId, date range, free-text q (supplier/material/ref), sort, cursor pagination; default listing shows latest revisions only. Filtered CSV export endpoint. UI: LPO log page — filter bar, TanStack table (frozen first columns, right-aligned tabular numerals), detail drawer with revision-chain timeline (design.md §8). Roles: PROCUREMENT RW; COMMERCIAL may PATCH only `voId`; FINANCE/MANAGEMENT/VIEWER R.

## Acceptance Criteria
- Given concurrent double-submit of two new LPOs, exactly one returns 201 with next sequence/ref; the other retries or fails 409 — no duplicate `(projectId, refNo)`.
- Given PATCH of `amountFils` on an ISSUED LPO, a successor revision is created (revisionNo = prev+1), predecessor row shows `supersededBy`, and default list/KPI inputs count only the latest non-cancelled revision.
- Given PATCH changing only `remark`, the row updates in place (no new revision) and an audit entry exists.
- Given CANCELLED status, the LPO is excluded from totals but remains visible with strike-through treatment.
- Given `kind=VARIATION` with missing/foreign-project/unknown `voId`, response is 422.
- Given verification set to FLAGGED without a ≥3-char note, response is 422.
- Given CSV export with active filters, output rows match the filtered API result set exactly (header + decimal amounts).
- Given COMMERCIAL session PATCHing any field other than `voId`, response is 403; VIEWER mutations are 403.

## Risks
Revision semantics are the highest-complexity area of M1 — behavior anchored by golden integration tests (chain integrity, totals counting latest revisions only).

## Rollback
Disable the route group behind a feature flag; seeded/imported data remains intact.
