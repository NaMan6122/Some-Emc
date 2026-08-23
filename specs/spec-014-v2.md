# spec-014-v2: Analytics engine & endpoints

**Status:** DRAFT — constant corrections per DCL-005; ratified-at-G1 v1 remains ACTIVE for all non-numeric scope
**Version:** 2
**Supersedes:** spec-014-v1
**Depends On:** spec-007, spec-011, spec-012, spec-013
**Blocks:** spec-015
**Task Reference:** T-021

## What
Unchanged from v1: five read-only endpoints under `/api/v1/projects/:id/analytics/*` (`overview`, `budget`, `cashflow`, `investment`, `vendors`); server-computed per PRD §8; BigInt → fils strings via jsonSafe; read-only for every authenticated role (401 envelope otherwise).

Matched-window semantics pinned by implementation against the legacy Investment report's own chart arrays:
- Window months = months covered by PCs (Apr 2025 – May 2026 for Job 1571).
- Invested(month) = Σ active-LPO amounts issued in that calendar month.
- Active LPOs issued before the window collapse into a carry-in base added to cumulative invested from month one (= report "TOTAL INVESTMENT 12.64M").
- Certificates bucket by period label ("Upto 25 Jun 2025" → Jun 2025), falling back to invoice date.
- recoveryRate = cumulative recovered ÷ (carry-in + Σ window invested).
- Budget-variance lens excludes out-of-scope packages (EXCLUDED_REFS = TEMW/REF/LPO//039, storm-water SWPS outside JCA) from committed side only; register endpoints stay faithful to source.

## Acceptance Criteria — corrected golden values
- overview.totalLpoFils = "1298411500"; supplierCount ≥ 90; largest LPO = AED 3,832,500.00; median = 479,950 fils.
- budget: Electrical ≈ 85.03% under; HVAC ≈ 123.39% over; Plumbing excl-SWPS committed = 35,362,100 fils ≈ 117.87% over; Fire Fighting coverage gap; excludedFils = 383,250,000.
- cashflow.cumulativeCertifiedFils at PC14 = **1,033,197,800 fils** (dataset row-sum — v1's 1,033,297,200 was unverifiable, cf. DCL-004); retentionTotalFils = 48,909,700; carryInFils = 162,363,700.
- investment.investedTotalFils = **1,263,848,300**; outstandingFinal = invested − recovered; recoveryRate ≈ **81.75% ±0.5pp** of the 81.8% report headline; peak-exposure month ∈ {Jun..Dec 2025} → Dec 2025, outstandingFils = **557,628,300** (report printed 5,576,280 with its own rounding).
- vendors.top8SharePct = **79.33% ±0.5pp** (v1's "76% ±2pp" derived from the legacy report's 118 raw-vendor grouping and is unreproducible after canonicalization to 90 suppliers — DCL-005b).
- All endpoints < 500ms on seeded data; unauthenticated → 401 envelope.

## Changes vs v1
1. AC3 cumulative certified constant corrected (DCL-005a).
2. AC5 top-8 share anchor replaced with canonicalized-dataset value (DCL-005b).
3. AC4 peak-exposure/outstanding asserted at dataset-exact fils rather than the report's rounded chart values.

## Risks
Unchanged from v1: matched-window subtleties are pinned by these tests before UI consumption.

## Rollback
Remove endpoints/service; screens degrade to empty states.
