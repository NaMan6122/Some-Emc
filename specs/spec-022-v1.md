# spec-022-v1: Cross-project LPO allocations ("50% ONLY")

**Status:** DRAFT
**Version:** 1
**Depends On:** spec-002, spec-004, spec-005, spec-007, spec-014
**Blocks:** NONE
**Task Reference:** —

## What
PRD FR-4 P1: percentage allocation of an LPO's cost to another named project. Migration adds `LpoAllocation { id BigInt @id, lpoId BigInt (Restrict FK), targetProjectId Int (Restrict FK), pct Int 1..100, note String?, createdAt }` with `@@unique([lpoId, targetProjectId])`; multiple rows per LPO allowed while Σpct ≤ 100 (server-checked in-tx). Endpoints: `GET /api/v1/lpos/:id/allocation`, `POST /api/v1/lpos/:id/allocation` (ADMIN+COMMERCIAL write; mirrors Budgets row), `DELETE /api/v1/allocations/:id` (audited). Analytics stays ADDITIVE-ONLY: overview payload gains `allocatedOutFils` (Σ pct×amount over this project's active LPOs) and `allocatedInFils` (same computed over allocations targeting this project) — no existing KPI, chart, or golden anchor changes. Allocations render in the LPO detail drawer. Seeded CROSS_JOB_SPLIT flag is NOT auto-resolved by this spec; resolving it via triage once humans record the real Ajman split remains the designed path (noted for WONT_FIX/resolve workflow).

## Acceptance Criteria
- Migration applies; seed rerun idempotent; migrate status up to date.
- Given COMMERCIAL posts `{targetProjectId, pct:50}` on an ELECTRICAL fixture LPO, then 201 + audit; overview.allocatedOutFils on the source project increases by exactly 50% of that LPO's amountFils.
- Given the same allocation viewed from the target project, then allocatedInFils reflects the identical fils figure.
- Given allocations totaling 60 then 45 on one LPO, the second POST → 422 ALLOCATION_EXCEEDS_100; given a duplicate (lpoId,targetProjectId), then 409 ALLOCATION_EXISTS.
- Given VIEWER POST/DELETE, then 403; given DELETE by COMMERCIAL, then 200 + audit and figures revert.

## Risks
Committed/variance figures deliberately stay unadjusted in v1 (additive KPIs only) — full analytic rewiring touches every golden anchor and is deferred until humans confirm the real split percentages; documented here so the limitation is visible, not silent.

## Rollback
Down-migration drops the table; remove routes/tests/dashboard drawer delta; analytics reverts by deleting two additive fields.
