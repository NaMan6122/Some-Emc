# spec-004-v1: Audit trail service & API

**Status:** DRAFT
**Version:** 1
**Depends On:** spec-002, spec-003
**Blocks:** spec-005, spec-006, spec-007
**Task Reference:** —

## What
Implements PRD FR-11: an audit service invoked inside the same Prisma transaction as every business mutation, recording actorId, entity, entityId, action, and before/after diffs (changed keys only); plus `GET /api/v1/audit` (ADMIN-only) with entity/entityId/date filters and cursor pagination. Immutability is enforced by design — no endpoint creates, updates, or deletes audit rows besides the internal service.

## Acceptance Criteria
- Given a supplier renamed via PATCH (spec-006), an AuditLog row exists with actor = caller and before/after containing only the changed key.
- Given a business mutation whose audit write fails, the entire transaction rolls back — business row unchanged and no orphan audit row.
- Given non-ADMIN session, GET `/api/v1/audit` returns 403; ADMIN receives filtered, paginated results.
- Attempting to mutate/delete audit entries through any crafted API call returns 404/405 — no such route exists.
- Diff serialization is deterministic (normalized JSON), verified by unit test.

## Risks
Diff noise from undefined-vs-missing keys — mitigated by one shared normalization utility used by service and tests alike.

## Rollback
Remove the table, service, and route in one change; callers stop writing audits in the same commit.
