# spec-005-v1: Projects module

**Status:** DRAFT
**Version:** 1
**Depends On:** spec-003, spec-004
**Blocks:** spec-007
**Task Reference:** —

## What
CRUD for projects per PRD FR-2: `GET|POST /api/v1/projects`, `GET|PATCH /api/v1/projects/:id` with fields code (unique, e.g. `1571`), name, mainContractor, contractValueFils (accepted as decimal string, stored as fils per ADR-002), vatRate (0–1 decimal), status (`ACTIVE | ON_HOLD | CLOSED`), start/end dates. Zod schemas shared between API and admin UI. Minimal admin screens (list + create/edit form) using design.md components. Role matrix: ADMIN RW; all others R. Every mutation writes an audit entry via spec-004.

## Acceptance Criteria
- Given ADMIN, POST valid project returns 201 and persists; duplicate `code` returns 409 envelope.
- Given FINANCE session, POST/PATCH on projects returns 403.
- Given PATCH changing `contractValueFils`, an audit entry records before≠after.
- Given `vatRate: 1.5`, negative contract value, or empty code, response is 422 with field-level details.
- Given DELETE on a project having dependent LPOs, response is 409 conflict (Restrict), never a silent cascade.

## Risks
NONE identified beyond validation completeness — covered by the criteria above.

## Rollback
Remove routes and admin UI in one commit; project rows persist harmlessly.
