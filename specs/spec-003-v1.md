# spec-003-v1: Authentication & RBAC

**Status:** DRAFT
**Version:** 1
**Depends On:** spec-001, spec-002
**Blocks:** spec-004, spec-005, spec-006, spec-007, spec-008
**Task Reference:** —

## What
Email/password authentication per PRD FR-1 and TDD §7: Auth.js v5 credentials provider issuing JWT httpOnly SameSite=Lax cookies (7-day sliding rotation), argon2id hashing via @node-rs/argon2, `tokenVersion` revocation on password change, middleware protecting `/` and `/api/v1/**` except auth endpoints, a server-side `requireRole()` helper enforcing the role matrix, in-memory login rate limiting per IP+email, endpoints `POST /auth/login`, `POST /auth/logout`, `GET /auth/me`, a minimal login page styled from design.md tokens, and an admin user creation script (`npm run user:add -- email name ROLE`, OQ-8).

## Acceptance Criteria
- Given an ADMIN created via script, POST `/api/v1/auth/login` with valid credentials returns 200 and sets HttpOnly/SameSite=Lax cookie; subsequent GET `/api/v1/auth/me` returns `{id,email,name,role}`.
- Given wrong password, response is 401 with a generic message; 5 failures for the same IP+email within 10 minutes return 429 with Retry-After.
- Given no session, GET `/api/v1/projects` returns 401 envelope; visiting `/` in a browser redirects to `/login`.
- Given VIEWER session, any mutating API call returns 403 — matrix cases from TDD §7 covered by integration tests.
- Given a password change bumps `tokenVersion`, previously issued tokens are rejected on the next request.
- Passwords are stored as argon2id hashes; plaintext should NOT appear in DB, logs, or any response.

## Risks
@node-rs/argon2 needs prebuilt binaries on the deploy host — fallback documented to bcryptjs cost 12 if unavailable. In-memory rate limiter resets on process restart (acceptable v1; Redis deferred).

## Rollback
Remove auth module, middleware, and login page; users table remains harmlessly unused.
