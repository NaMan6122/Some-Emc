# spec-014-v1: Analytics engine & endpoints

**Status:** ACTIVE — ratified at G1 2026-08-23
**Version:** 1
**Depends On:** spec-007, spec-011, spec-012, spec-013
**Blocks:** spec-015
**Task Reference:** —

## What
Server-computed analytics per PRD §8 (TDD §8: clients never aggregate). Endpoints under `/api/v1/projects/:id/analytics/*` returning JSON payloads consumed by the dashboard screens:
- `overview` — totalLpoFils, activeCount, supplierCount, avg/median LPO, largest LPO, flaggedCount, tradeBreakdown[{trade,fils,count,pct}], monthlySeries[{month,committedFils}]
- `budget` — variance rows from spec-011 service incl. coverage gaps and threshold bands
- `cashflow` — per-month certifiedFils vs committedFils + cumulative series; retention totals; variation claim status
- `investment` — matched-window invested/recovered monthly bars, cumulative outstanding gap curve, recovery rate, peak exposure month
- `vendors` — top suppliers by spend with cumulative-share curve, repeat-supplier count, long-tail count
SQL aggregates with window functions via Prisma $queryRaw where needed; all BigInt → fils strings through jsonSafe. Read-only for every role.

## Acceptance Criteria — golden values from Job 1571 (regression anchors)
- overview.totalLpoFils = "1298411500"; supplierCount ≥ 90; largest LPO = AED 3,832,500.00.
- budget: Electrical utilization ≈ 85.03% under; HVAC ≈ 123.39% over; Plumbing excl-SWPS ≈ 117.87% over; Fire Fighting listed as coverage gap.
- cashflow.cumulativeCertifiedFils at PC14 = Σ seeded nets = 1,033,297,200 fils equivalent; retention total matches Σ retention.
- investment.outstanding final ≈ invested − recovered within matched window; recoveryRate ≈ 81.8% ±0.5pp; peak-exposure month ∈ {Jun..Dec 2025}.
- vendors.top8 share ≈ 76% ±2pp of committed spend.
- All endpoints < 500ms on seeded data; unauthenticated → 401 envelope.

## Risks
Matched-window definition (months covered by PCs) is subtle — pinned by the golden tests above before any UI consumes it.

## Rollback
Remove endpoints/service; screens degrade to empty states.
