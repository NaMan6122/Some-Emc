# spec-012-v1: Payment certificates module

**Status:** ACTIVE — ratified at G1 2026-08-23
**Version:** 1
**Depends On:** spec-004, spec-005
**Blocks:** spec-013, spec-014
**Task Reference:** —

## What
PRD FR-6: `GET|POST /api/v1/projects/:id/pcs`, `PATCH|DELETE /api/v1/pcs/:id`. Fields per TDD §5 (pcNumber gapless, periodLabel/dates, gross/retention/net fils, variationClaimFils, statedCumulativeFils optional, status DRAFT→SUBMITTED→CERTIFIED→PAID, provenance enum, notes). Integrity rules enforced server-side: net = gross − retention; pcNumber unique + no gaps on CERTIFIED+ (gap → DataFlag PC_GAP); arithmetic mismatch → 422. Cross-check service recomputes cumulative certified and compares to statedCumulativeFils when present (tolerance 0) — mismatches raise CUMULATIVE_MISMATCH flags. FINANCE writes; others read. Mutations audited. Admin screen: PC log table + create/edit form + status workflow buttons.

## Acceptance Criteria
- Seeded 14 PCs load with exact fils figures and per-row provenance (PC01 SOURCE_DOCUMENT … PC03 CLIENT_SUMMARY …); Σ net payable = AED 10,332,972.00 equivalent in fils from the dataset.
- FINANCE creates a valid PC → 201; VIEWER → 403.
- POST with retention ≠ gross−net → 422 ARITHMETIC_MISMATCH with field detail.
- Creating PC16 while PC15 missing → 201 but PC_GAP flag auto-raised naming the missing number.
- statedCumulativeFils off by >0 → CUMULATIVE_MISMATCH flag with both values in the message; status transitions validated (PAID only from CERTIFIED).

## Risks
Legacy OCR-derived retention values are estimates — provenance badges must surface this in UI (spec-015) so estimates are never mistaken for source figures.

## Rollback
Remove routes/service/screen; PC rows persist.
