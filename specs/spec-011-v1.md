# spec-011-v1: Budgets module (JCA lines)

**Status:** ACTIVE — ratified at G1 2026-08-23
**Version:** 1
**Depends On:** spec-004, spec-005
**Blocks:** spec-014
**Task Reference:** —

## What
PRD FR-5: `GET|POST /api/v1/projects/:id/budget-lines`, `PATCH|DELETE /api/v1/budget-lines/:id`. Fields: trade, category (MATERIALS|LABOUR|OTHER), amountFils (decimal-string input), sourceLabel, refDate, note. Budget sets: lines carry an optional setId; analytics use the latest refDate set per project. Variance service computes committed vs budget per trade with utilization % and status bands (under <90% success / watch 90–100% warning / over >100% danger) plus coverage gaps (trades with committed spend and no budget line — e.g. Fire Fighting on Job 1571). ADMIN/COMMERCIAL write; others read. Mutations audited. Minimal admin screen section under Administration → Projects → Budget tab.

## Acceptance Criteria
- Seeded Job 1571 budget lines load exactly: Electrical 7,000,000.00 / HVAC 500,000.00 / Plumbing 300,000.00 (JCA Appendix I–III).
- COMMERCIAL creates a line → 201 persisted + audit CREATE; FINANCE attempt → 403.
- Duplicate trade+category within the same active set is allowed but flagged by rule BUDGET_DUPLICATE_LINE (advisory).
- PATCH amountFils audits only the changed key; DELETE of a line referenced by analytics still allowed (soft via deletedAt? no — hard delete + audit, variance recomputes).
- GET /api/v1/projects/:id/variance returns per-trade rows {trade, budgetFils, committedFils, utilizationPct, status} including a FIRE_FIGHTING row flagged "no JCA line" coverage gap.

## Risks
Committed-value definition must exclude CANCELLED/SWPS-style out-of-scope packages — configurable exclusions arrive with this spec as Project.excludedRefs? NO schema change: exclusion via Lpo.remark convention deferred; v1 counts all non-cancelled latest-revision LPOs in-trade (documented limitation).

## Rollback
Remove routes/service/screen; budget rows persist harmlessly.
