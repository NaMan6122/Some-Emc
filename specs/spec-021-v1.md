# spec-021-v1: Bulk LPO CSV import

**Status:** DRAFT
**Version:** 1
**Depends On:** spec-005, spec-007
**Blocks:** NONE
**Task Reference:** —

## What
PRD FR-4 P1: `POST /api/v1/projects/:id/lpos/import?dry_run=true|false`, body `text/csv`. Fixed column set accepted in any order (header mapping by name): `supplierName, trade, description, issueDate, amountAED, vatRate?, kind?, remark?` — unknown headers → 422 listing them. Dry-run validates every row through the same zod schemas + supplier normalization + money parsing as manual entry and returns `{rowsTotal, valid, invalid, failures:[{row, field, message}], wouldCreate}` with ZERO writes. Commit mode (`dry_run=false`) re-validates inside one $transaction: ALL rows succeed or NOTHING is written (financial discipline over best-effort). Suppliers must already exist by normalized name (no auto-create — phantom vendors are what FR-9 fights); created LPOs get fresh seq/refNo via the existing allocator, provenance SOURCE_DOCUMENT, status ISSUED, each with its own CREATE audit row tagged `via=bulk-import`. Role gates mirror LPO write (ADMIN+PROCUREMENT). Hard cap 1000 rows/request.

## Acceptance Criteria
- Given a 3-row valid CSV with dry_run=true, then 200 `{valid:3, invalid:0}` and zero Lpo/audit rows created (verified by count delta).
- Given a mixed batch where row 2 has amountAED "abc" and row 3 references an unknown supplier, then dry-run reports exactly those failures with row numbers and field names.
- Given the same mixed batch with dry_run=false, then 422 IMPORT_REJECTED with the failure list and still zero writes (all-or-nothing).
- Given a fully valid commit, then rows exist with generated refs (next seq slots), ISSUED status, and one audit row each including actor + via tag.
- Given PROCUREMENT submits, then 201/200 semantics as above; COMMERCIAL → 403; malformed CSV bytes → 422 VALIDATION_ERROR.

## Risks
All-or-nothing means one bad row blocks 999 good ones — deliberate v1 trade-off; callers split files and re-run dry-run. Supplier-name matching depends on the uppercase invariant (spec-006).

## Rollback
Remove route/parser/tests; committed rows persist (they are ordinary LPOs).
