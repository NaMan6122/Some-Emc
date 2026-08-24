# spec-020-v1: Supplier merge UI

**Status:** DRAFT
**Version:** 1
**Depends On:** spec-006, spec-009
**Blocks:** NONE
**Task Reference:** —

## What
PRD FR-3 P1 UI half: the merge API (spec-006) gets its admin screen at `/admin/suppliers`. Layout: searchable supplier table (name, aliases count, LPO count, merged-into indicator) + a "Suspected duplicates" panel fed by `GET /suppliers/duplicates/suggestions` (top-20, score shown). Selecting a suggestion pair pre-fills the merge form (source → target, either direction swappable); ADMIN-only submit calls `POST /suppliers/:id/merge {targetId}` with the existing 422 guards surfaced inline (SELF_MERGE / ALREADY_MERGED / TARGET_MERGED); success toast names the surviving master and re-validates both lists. Non-ADMIN roles see the data read-only with no action column. No new endpoints; no service changes.

## Acceptance Criteria
- Given ADMIN on /admin/suppliers, then table renders all suppliers with counts and the suggestions panel shows scored pairs including the seeded typo pair when present in the top-20.
- Given a suggestion pair merged from the UI, then source row shows mergedIntoId target after refresh, LPO counts move to the survivor, and one MERGE audit row exists (already guaranteed by spec-006 service).
- Given a merge attempt violating a guard, then the API's 422 code/message surfaces inline without clearing the form.
- Given VIEWER or PROCUREMENT on the screen, then no merge controls render; direct POST still 403s server-side.
- Screen reachable from the sidebar Administration group; unauthenticated → redirect to login.

## Risks
Suggestion list is capped top-20 — large vendor masters may hide real pairs below the cut (same documented limitation as spec-006/017; search remains the primary tool).

## Rollback
Remove the screen file(s) and nav entry; APIs untouched.
