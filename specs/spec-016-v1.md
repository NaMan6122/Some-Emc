# spec-016-v1: Flag triage workflow (FR-9 management)

**Status:** ACTIVE — promoted at G1 2026-08-24
**Version:** 1
**Depends On:** spec-003, spec-004, spec-015
**Blocks:** spec-017
**Task Reference:** T-024

## What
PRD FR-9 management half: `PATCH /api/v1/flags/:id` turns the read-only queue (spec-015 tab 6) into a working triage workflow. Actions on an OPEN flag: assign (`assigneeId`), resolve (`status=RESOLVED`, `resolutionNote` required), wont-fix (`status=WONT_FIX`, `resolutionNote` required). Transitions are forward-only (OPEN→RESOLVED|WONT_FIX terminal); resolution writes an audit row (entity `DataFlag`) via the shared audit service. Role gates implement TDD §7's "Flags resolve" row literally — ADMIN resolves anything; domain-scoped resolution otherwise: `Lpo|Supplier` → PROCUREMENT, `BudgetLine|VariationOrder` → COMMERCIAL, `PaymentCertificate` → FINANCE; project-level flags (`Project` entity) resolvable by any of those three. MANAGEMENT/VIEWER read-only. Supporting additions: `GET /api/v1/users` returning `{id,name,role}` only (for the assignee picker; full user administration stays out of scope), `GET /api/v1/flags?assigneeId=` filter, and severity/ruleCode filters on the existing list endpoint. Queue UI upgraded in place on `/flags`: assignee select, resolve / wont-fix actions with note prompt, "assigned to me" toggle; read-only roles see no action controls.

## Acceptance Criteria
- Given ADMIN, when PATCH `/flags/:id` `{assigneeId}` on an OPEN flag, then 200, assignee persisted, and one audit row (entity DataFlag, actor ADMIN) exists.
- Given FINANCE, when resolving an OPEN PaymentCertificate-domain flag `{status:"RESOLVED", resolutionNote:"corrected PC03 retention"}`, then status RESOLVED with resolvedAt set, note stored, audit entry written.
- Given COMMERCIAL resolving a BudgetLine-domain OPEN flag, then 200; given the same role resolving a PaymentCertificate-domain flag, then 403 FLAG_DOMAIN_FORBIDDEN (server-enforced, not UI-only).
- Given a WONT_FIX attempt without `resolutionNote`, then 422 VALIDATION_ERROR; given any PATCH targeting an already RESOLVED/WONT_FIX flag, then 422 INVALID_TRANSITION.
- Given VIEWER, when PATCH `/flags/:id`, then 403; unauthenticated GET/PATCH → 401 envelope.
- Given seeded Job 1571, when GET `/flags?status=OPEN&ruleCode=SOURCE_NEEDS_CHECK`, then exactly the seeded SOURCE_NEEDS_CHECK row; `assigneeId=<id>` returns only that user's flags.
- Queue screen: triage-capable roles can assign and resolve from the table (note required surfaced client-side too); MANAGEMENT/VIEWER see no controls; severity counts visible above the table.

## Risks
Domain map is an interpretation of TDD §7's "(proc.)/(comm.)/(fin.)" annotations — wrong mapping would misroute permissions; mitigated by ADMIN bypass and single-map constant in service. No un-resolve path means a mistaken RESOLVED needs a new flag or DBA fix.

## Rollback
Remove PATCH route/users route/service changes; revert FlagsClient to read-only feed; DataFlag rows persist harmlessly.
