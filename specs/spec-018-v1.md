# spec-018-v1: CSV exports everywhere a filter exists (FR-10 P1 subset)

**Status:** ACTIVE — promoted at G1 2026-08-24
**Version:** 1
**Depends On:** spec-007, spec-011, spec-012, spec-013, spec-004
**Blocks:** NONE
**Task Reference:** —

## What
PRD FR-10 P1 minus print/PDF (which TDD §14 keeps in M4): extend the existing LPO export pattern (`/lpos/export` — csvEscape, `formatMoney` AED strings, ISO dates, `text/csv; charset=utf-8`, `content-disposition` attachment naming) to every entity that has a filtered JSON list. New endpoints: `GET /api/v1/projects/:id/export/{pcs,vos,budget-lines,variance,flags}.csv`, `GET /api/v1/suppliers/export.csv?q=`, and `GET /api/v1/audit.csv?entity=&entityId=&from=&to=`. Each honors exactly the same query filters and role gates as its JSON counterpart: pcs/vos/budget-lines/variance mirror their project read gates (any authenticated project reader), flags mirrors the list endpoint's auth, suppliers honors `?q=` like the list route, audit.csv is ADMIN-only. Money columns emit fils-exact AED formatted strings; variance rows reuse the v1 variance service semantics (SWPS exclusion remains an analytics-lens-only concern per spec-014). Bounded pagination sweep like the LPO exporter (≤100 pages).

## Acceptance Criteria
- Given authenticated GET `/projects/220/export/pcs.csv`, then 14 data rows + header including pcNumber, periodLabel, status, grossAED/retentionAED/netPayableAED/variationClaimAED as fils-exact AED strings, provenance; PC03 retention shows 0.00 (its source value was "n/a").
- Given GET `/projects/220/export/variance.csv`, then one row per trade whose figures byte-match GET `/variance` JSON for the same project (ELECTRICAL utilizationPct 85.03 etc., v1 semantics).
- Given GET `/suppliers/export.csv?q=SILVER`, then only matching suppliers, columns incl. name, aliases JSON, lpoCount, mergedIntoId.
- Given VIEWER GET `/audit.csv`, then 403; given ADMIN GET `/audit.csv?entity=Lpo`, then rows matching that filter only.
- Given unauthenticated calls on any new export endpoint, then 401 envelope; given malformed query params, then 422 VALIDATION_ERROR consistent with the JSON routes.

## Risks
Variance CSV freezing v1 semantics may confuse users comparing against the excl-SWPS budget dashboard lens — column header will carry `committedBasis=v1_all_active` provenance note in a leading comment-free meta column if cheap, else documented here only.

## Rollback
Remove the export route files/tests; JSON endpoints unaffected.
