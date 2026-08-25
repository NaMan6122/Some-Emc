# spec-030-v1: Cost-to-complete, forecast & profit margin (Phase 2 — derived analytics)

**Status:** ACTIVE — promoted at G1 2026-08-25
**Version:** 1
**Depends On:** spec-002, spec-011, spec-014, spec-028, spec-029
**Blocks:** NONE
**Task Reference:** T-043

## What
Pure computation layer over existing data — zero new data entry. New analytics endpoint `GET /projects/:id/analytics/costs` returning, per project and per trade/category where applicable: `originalBudget` (Σ contract value + budget lines incl. JCA + cost lines), `committedFils` (active LPOs + VO-exposed amounts), `actualCostFils` (Σ CostEntry), `costToCompleteFils = max(0, originalBudget − committed − actual)` (open-commitment aware: committed not yet invoiced counts toward CTC only via the max(0) guard — formula pinned here and unit-tested), `forecastFinalFils = actualCost + costToComplete + openCommitmentsNotYetInvoiced` (pinned definition: forecast = actual + remaining commitments + estimated remainder), and `marginPct = (contractValue − forecastFinal) ÷ contractValue × 100` (signed). Dashboard: new **"Cost Control"** tab (sidebar Analytics group) rendering waterfall-style cards (Budget → Committed → Actual → Forecast) + margin KPI + per-category table reusing spec-028 categories plus MATERIAL/OTHER rollup. All figures BigInt-exact downstream, rounded once at display. Definitions above ARE the spec — any client-side reinterpretation requires a version bump, not silent drift.

## Acceptance Criteria
- Empty-costs project: forecast equals committed + 0 actuals case renders without NaN; margin negative allowed and displayed with minus (danger tint).
- Fixture: budget 1,000,000; commitments 400,000; actuals 250,000 → CTC 350,000, forecast 600,000, margin +40.00% (asserted to the fils/pct).
- Overrun case: actuals alone exceed budget → CTC floors at 0, forecast reflects overrun, margin negative.
- Per-category rows sum to the project totals row (conservation asserted).
- VIEWER reads; no mutation endpoints exist (structural test like spec-004's).
- Tab renders on mobile (grid stacks) and print layer hides chrome (reuses spec-023 pattern).

## Risks
Forecast is only as honest as entry discipline — UI labels state assumptions ("remaining commitments counted at face value"). Trade-level mapping of generic cost entries relies on the category enum, not per-LPO trade joins.

## Rollback
Remove endpoint/tab/service tests; no schema changes.
