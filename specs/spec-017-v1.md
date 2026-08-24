# spec-017-v1: Data-quality rules engine (project scan)

**Status:** ACTIVE — promoted at G1 2026-08-24
**Version:** 1
**Depends On:** spec-006, spec-007, spec-011, spec-016
**Blocks:** NONE
**Task Reference:** —

## What
Closes FR-9's two remaining rule gaps with an idempotent project scan: `POST /api/v1/projects/:id/flags/scan`. Rule 1 — NO_BUDGET_LINE (HIGH): any Trade with committed spend (Σ active, non-cancelled, latest-revision LPO amountFils > 0) but zero BudgetLine rows of that trade opens one Project-entity flag naming the trade and its committed total. Rule 2 — DUPLICATE_SUPPLIER_SUSPECT (LOW): pairs among the project's LPO-referenced, non-merged suppliers scoring ≥0.6 under the existing spec-006 heuristic (duplicates.ts) open one Supplier-entity flag per pair. Reconciliation mirrors pcs.ts resolveStale: re-running never duplicates a live flag (matched on entityType+ruleCode+entityId+status=OPEN) and auto-resolves stale ones with note "Auto-resolved by scan" when the underlying condition clears. Scan is triggerable by ADMIN/PROCUREMENT/COMMERCIAL/FINANCE; MANAGEMENT/VIEWER 403. Returns `{checkedRules, opened, resolved}`. Seed script does NOT auto-run scans — day-one state remains the four curated seed flags; systematic flags appear on first scan.

## Acceptance Criteria
- Given seeded Job 1571, when an authorized scan runs, then exactly one NO_BUDGET_LINE flag opens naming FIRE_FIGHTING with AED 1,583,925.00 committed (ELECTRICAL/HVAC/PLUMBING hold JCA lines and raise none).
- Given the scan runs twice with no data change, then the second run opens 0 and resolves 0 (idempotent).
- Given FIRE_FIGHTING gains a budget line after a prior scan, then the next scan flips that flag to RESOLVED with the auto-note.
- Given two typo-variant fixture suppliers each holding ≥1 LPO on the scanned project, then one DUPLICATE_SUPPLIER_SUSPECT flag opens for the pair; after one side merges into the other, the next scan auto-resolves it.
- Given VIEWER POSTs the scan, then 403; unauthenticated → 401 envelope.

## Risks
Heuristic duplicates are advisory-only false-positive-prone — pressure valve is WONT_FIX from spec-016, so noise cannot block operations. Scan cost is O(suppliers²) per project (~90²) — negligible at current scale.

## Rollback
Remove route/service/tests; opened DataFlag rows persist harmlessly and can be bulk-closed by hand.
