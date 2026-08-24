# spec-024-v1: User administration (admin batch closure)

**Status:** ACTIVE — promoted at G1 2026-08-24
**Version:** 1
**Depends On:** spec-003, spec-004, spec-016
**Blocks:** NONE
**Task Reference:** T-035

## What
Closes the last Administration-area gap: `/admin/users` stops being a placeholder and gets full lifecycle management, ADMIN-only per TDD §7 Users row. Migration adds `active Boolean @default(true)` to User — deactivation preserves audit attribution (`AuditLog.actorId` is a plain column; hard deletes would orphan history, so there is NO delete). API: `GET /api/v1/users` becomes role-aware (ADMIN receives `{id,name,email,role,active,createdAt}`; triage roles keep the spec-016 minimal `{id,name,role}` picker shape); `POST /api/v1/users` creates a user with role and returns a generated one-time password exactly once (never stored in clear, never audited); `PATCH /api/v1/users/:id` performs role change, activation toggle, or password reset — every path that changes credentials or rights bumps `tokenVersion` for instant session revocation. Guardrails server-enforced: cannot modify yourself via this endpoint (self-service stays on `/auth/password`); cannot deactivate or demote the last ACTIVE ADMIN (422 LAST_ADMIN); self-modification attempts → 422 CANNOT_MODIFY_SELF; duplicate email → 409 EMAIL_TAKEN. Login rejects inactive users with 403 USER_INACTIVE. UI replaces the placeholder: user table (name/email/role/status/created), create form with copy-once password reveal, inline role dropdown, deactivate/reactivate and reset-password actions with confirmation. No email infrastructure — one-time passwords surface in-app only (documented v1 limitation).

## Acceptance Criteria
- Given ADMIN creates `{email,name,role}`, then 201 with `oneTimePassword` present in the response body exactly once; stored hash only; audit row contains NO password material; repeat email → 409 EMAIL_TAKEN.
- Given ADMIN patches a user's role, then role persists, `tokenVersion` increments (prior session cookie rejected immediately), audit records before/after roles.
- Given ADMIN deactivates a user, then that user's live session dies on next request, login returns 403 USER_INACTIVE while inactive, and reactivation restores access; both directions audited.
- Given ADMIN attempts own deactivation/demotion, then 422 CANNOT_MODIFY_SELF; given the only active ADMIN is demoted/deactivated, then 422 LAST_ADMIN.
- Given PROCUREMENT/VIEWER calls POST/PATCH or requests the rich user list, then 403 / minimal picker shape respectively; unauthenticated → 401 envelope.
- Browser: create → copy-once reveal → login as the new user works; role dropdown, reset-password reveal, and deactivate flows all function; non-ADMIN never sees controls.

## Risks
One-time passwords displayed in-app assume a trusted admin channel (no email until OQ backlog allows) — flagged for revisit if user count grows. Role changes bump all sessions of the target user (acceptable at this scale).

## Rollback
Down-migration drops the `active` column; remove routes/UI deltas; auth core untouched otherwise.
