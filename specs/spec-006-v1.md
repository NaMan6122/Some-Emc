# spec-006-v1: Suppliers vendor master

**Status:** DRAFT
**Version:** 1
**Depends On:** spec-003, spec-004
**Blocks:** spec-007, spec-008
**Task Reference:** —

## What
Vendor master per PRD FR-3: `GET|POST /api/v1/suppliers`, `GET|PATCH /api/v1/suppliers/:id` with normalized unique name (case-insensitive) and `aliases` JSON preserving raw import spellings; `POST /api/v1/suppliers/:id/merge {targetId}` (ADMIN) re-points LPO references, records the loser's name as an alias on the target, sets `mergedIntoId`, and writes audit. A similarity-suggestion query (normalized-token comparison) returns suspected duplicates as advisory data — flag automation itself arrives in M3. Roles: ADMIN RW; PROCUREMENT RW; others R.

## Acceptance Criteria
- Given an existing supplier "Unigulf Development LLC", POST "UNIGULF DEVELOPMENT LLC" (case-insensitive match) returns 409 with the existing record id.
- Given supplier A with LPO rows (test fixtures), merge A→B: those rows reference B, A has `mergedIntoId=B` and B's aliases include A's name; one audit entry records the merge.
- Given merge into a target that is itself merged (`mergedIntoId` set), response is 422.
- Given PROCUREMENT session, create/update succeeds; given FINANCE session, mutations return 403.
- Suggestion endpoint returns candidate duplicate pairs for known typo variants in fixtures.

## Risks
Over-aggressive normalization could suggest merging genuinely distinct vendors — suggestions remain advisory only until human action.

## Rollback
A documented unmerge script reverses pointer and alias for a single merge pair.
