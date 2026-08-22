# spec-015-v1: Dashboard screens (ProCare tabs, live)

**Status:** ACTIVE — ratified at G1 2026-08-23
**Version:** 1
**Depends On:** spec-009, spec-010, spec-014; design.md §8–§11
**Blocks:** NONE
**Task Reference:** —

## What
The six live dashboard pages consuming spec-014 payloads, styled strictly from design.md:
1. **Overview** — 6 KPI cards (Total LPO Value, Active LPOs, Suppliers Used, Avg/Median, Largest, Flagged), spend-by-trade horizontal bar, trade-mix donut toggle, monthly commitment area chart, housekeeping callouts.
2. **Budget vs Actual** — variance table with status pills + utilization bars, coverage-gap list, budget-vs-committed grouped bars.
3. **Payment Certificates** — monthly certified-vs-procurement paired bars with dashed cumulative overlays, PC log table (provenance chips per §7), retention KPIs.
4. **Investment** — invested/recovered paired bars, cumulative outstanding-gap area, recovery-rate + peak-exposure stat cards.
5. **Vendors & LPO Log** — embeds spec-010 screen beneath a top-supplier Pareto chart (bars + cumulative % line).
6. **Data Flags** — placeholder queue fed by existing flags API subset (full FR-9 queue is M3): severity dot, rule code mono chip, age, message.
All charts follow design.md §9 (horizontal-only gridlines, dark tooltips with fils-exact values, accessible summaries). SWR revalidation on focus; skeleton states mirror layout.

## Acceptance Criteria
- Overview KPIs render exactly the golden values from spec-014 tests (AED 12,984,115.00 total; 140 active; largest AED 3,832,500.00).
- Budget tab renders HVAC row with danger pill "123.4%" and Fire Fighting gap notice "no JCA line".
- Investment tab shows recovery rate ≈81.8% and peak exposure within Jun–Dec 2025 band.
- Every chart has an aria-label summary; every money figure uses tabular numerals; provenance chips visible wherever PC figures appear (OCR EST etc.).
- All six routes reachable from sidebar; deep links restore project context via ?project=1571.
- Lighthouse a11y spot check: no contrast violations on light+dark for text tokens.

## Risks
Chart-heavy pages risk jank — mitigated by SWR caching, server aggregation, and Recharts memoization; drill-down interactions deferred to P1.

## Rollback
Screens are additive; analytics endpoints remain usable standalone.
