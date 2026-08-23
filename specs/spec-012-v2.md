# spec-012-v2: Payment certificates module

**Status:** DRAFT — threshold/figure correction per DCL-004; pending G1 ratification
**Version:** 2
**Supersedes:** spec-012-v1
**Depends On:** spec-004, spec-005
**Blocks:** spec-013, spec-014
**Task Reference:** T-019

## What
Unchanged from spec-012-v1: `GET|POST /api/v1/projects/:id/pcs`, `PATCH|DELETE /api/v1/pcs/:id`. Fields per TDD §5 (pcNumber gapless, periodLabel/dates, gross/retention/net fils, variationClaimFils, statedCumulativeFils optional, status DRAFT→SUBMITTED→CERTIFIED→PAID, provenance enum, notes). Integrity rules server-side: net = gross − retention; duplicate pcNumber → 409; gap → advisory DataFlag PC_GAP; arithmetic mismatch → 422 ARITHMETIC_MISMATCH; cross-check recomputes cumulative certified vs statedCumulativeFils at zero tolerance → CUMULATIVE_MISMATCH flags. Status transitions forward-only, PAID only from CERTIFIED. ADMIN+FINANCE write per TDD §7 matrix ("FINANCE writes" in v1 read as shorthand — the matrix is authoritative); others read. Mutations audited. Admin screen: PC log table + create/edit form + status workflow buttons.

## Acceptance Criteria
Identical to v1 except AC1's total figure:
- Seeded 14 PCs load with exact fils figures and per-row provenance (PC01 SOURCE_DOCUMENT … PC03 CLIENT_SUMMARY …); Σ net payable = **1,033,197,800 fils = AED 10,331,978.00** — the row-sum of the extracted dataset, consistent with the reports' rounded "10.33M certified".
- FINANCE creates a valid PC → 201; VIEWER → 403.
- POST with retention ≠ gross−net → 422 ARITHMETIC_MISMATCH with field detail.
- Creating PC16 while PC15 missing → 201 but PC_GAP flag auto-raised naming the missing number.
- statedCumulativeFils off by >0 → CUMULATIVE_MISMATCH flag with both values in the message; status transitions validated (PAID only from CERTIFIED).

## Changes vs v1
1. AC1 total corrected: 10,332,972.00 → 10,331,978.00 AED (see DCL-004).

## Risks
Unchanged from v1: legacy OCR-derived retention values are estimates — provenance badges must surface this in UI so estimates are never mistaken for source figures.

## Rollback
Remove routes/service/screen; PC rows persist.
