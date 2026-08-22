# spec-003-v2: Authentication & RBAC

**Status:** DRAFT — supersedes spec-003-v1 per DCL-001; awaiting Gate G1
**Version:** 2
**Depends On:** spec-001, spec-002
**Blocks:** spec-004, spec-005, spec-006, spec-007, spec-008
**Task Reference:** —

## What
Email/password authentication identical in behavior to v1, implemented on a hand-rolled session layer (`jose` HS256 JWT in an httpOnly, SameSite=Lax, Secure-in-prod cookie with 7-day sliding expiry) instead of Auth.js v5 — reason and evaluation recorded in DCL-001 / ADR-004. Includes: argon2id hashing via @node-rs/argon2; `tokenVersion` revocation checked on every request; middleware protecting `/` and `/api/v1/**` except auth endpoints (unauthenticated API → 401 envelope, unauthenticated page → redirect `/login`); server-side `requireRole()` enforcing the TDD §7 matrix; in-memory login rate limiting (5 failures per IP+email / 10 min → 429 + Retry-After); endpoints `POST /api/v1/auth/login`, `POST /api/v1/auth/logout`, `POST /api/v1/auth/password` (verify current, bump tokenVersion), `GET /api/v1/auth/me`; a minimal login page styled from design.md tokens; admin user script `npm run user:add -- <email> <name> <ROLE> [password]` (random password generated and printed once if omitted). All responses use the TDD §8 envelope.

## Acceptance Criteria
- Given a user created via `npm run user:add`, POST `/api/v1/auth/login` with valid credentials returns 200 `{user:{id,email,name,role}}` and sets an HttpOnly SameSite=Lax cookie; GET `/api/v1/auth/me` with the cookie returns `{id,email,name,role}`.
- Given wrong password, response is `401 {error:{code:"INVALID_CREDENTIALS",…}}`; after 5 failures for the same IP+email within 10 minutes, the next attempt returns `429` with a numeric `Retry-After` header; a successful login clears the counter.
- Given no session, GET `/api/v1/projects` returns `401 {error:{code:"UNAUTHENTICATED"}}`; visiting `/` in a browser redirects to `/login`.
- Given VIEWER session, any endpoint wrapped with `requireRole` that excludes VIEWER returns `403 {error:{code:"FORBIDDEN"}}` — verified by integration tests against the live `/auth/password` route for all six roles.
- Given a password change succeeds, `tokenVersion` increments and previously issued tokens are rejected on their next use (401 UNAUTHENTICATED).
- Passwords are stored as argon2id hashes; plaintext should NOT appear in DB, logs, or any response body.

## Risks
Hand-rolled crypto plumbing must be exactly right — mitigated by focused unit tests on sign/verify/expiry/revocation plus integration tests on every endpoint. In-memory rate limiter resets on process restart (acceptable v1; Redis deferred).

## Rollback
Remove auth module, middleware, and login page; users table remains harmlessly unused. Swapping in Auth.js later stays feasible (session shape is internal).
