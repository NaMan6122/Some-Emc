# spec-029-v1: Cost actuals ledger (Phase 1 — actual costs)

**Status:** ACTIVE — promoted at G1 2026-08-25
**Version:** 1
**Depends On:** spec-002, spec-004, spec-028
**Blocks:** spec-030
**Task Reference:** T-042

## What
The missing half of the money picture. ProCare today tracks commitments (LPOs) and money-in (PC certifications) but not what TEMW actually PAYS. This spec introduces the company-wide **actual-cost entry**: `CostEntry` (introduced generically in spec-028) is promoted to the canonical actuals ledger with an extended shape: `CostEntry { projectId, category (CostCategory + MATERIAL, OTHER), supplierId? → Supplier, lpoId? → Lpo (optional commitment linkage), entryDate, amountFils (>0), kind { INVOICE, PAYMENT }, description?, reference? (invoice number), createdAt }`. Rules: an INVOICE books what a supplier/subcontractor billed; a PAYMENT books cash actually paid; both are FINANCE+ADMIN writes, audited, immutable-on-edit (delete+re-enter by ADMIN). LPO linkage is optional metadata — no automatic accrual from LPOs (an issued LPO is a commitment, not a cost until invoiced). GET endpoints filter by project/category/date-range/supplier with running totals; CSV export included in the existing export family (`cost-entries.csv`). The four spec-028 overviews continue to work unchanged — their "actuals" now come from this same table (category-scoped).

## Acceptance Criteria
- Migration adds MATERIAL/OTHER to CostCategory and the new nullable columns (supplierId, lpoId, kind default INVOICE) with Restrict FKs + indexes (projectId+category+entryDate); seed idempotent.
- FINANCE books an INVOICE AED 12,345.67 against category LABOUR_SUBCONTRACT linked to fixture LPO → 201 + audit (no credential/amount leakage concerns; amount present as expected); GET with `?category=LABOUR_SUBCONTRACT&from=&to=` returns it with running total.
- VIEWER read-only; PROCUREMENT POST → 403; malformed money/negative/kind → 422.
- DELETE (FINANCE+ADMIN... per convention ADMIN) removes with audit; totals revert.
- `GET /projects/:id/cost-entries.csv` streams all filters; row count matches JSON list.
- Spec-028's Labour overview "Actual" now equals Σ CostEntry for that category (single source of truth proven by test).

## Risks
Double-entry risk when users book both invoice AND payment for the same bill — mitigated by kind semantics documented in UI helper text and a future dedupe report (out of scope). Backfill of historical costs is manual.

## Rollback
Down-migration drops new columns/enum values; remove routes/tests; spec-028 pages keep functioning off the same table.
