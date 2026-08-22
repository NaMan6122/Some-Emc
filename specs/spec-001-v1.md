# spec-001-v1: Application scaffold & toolchain

**Status:** DRAFT
**Version:** 1
**Depends On:** NONE
**Blocks:** spec-002, spec-003
**Task Reference:** —

## What
Bootstraps the Next.js 15 (App Router, TypeScript strict) skeleton with Tailwind CSS v4 and shadcn/ui primitives installed (no screens yet), ESLint + Prettier, Vitest wired with a sample test, Docker Compose Postgres 16 dev service, `.env.example` (DATABASE_URL, AUTH_SECRET placeholders), Prisma wiring point, and a `/health` endpoint returning app + database status per TDD §12.

## Acceptance Criteria
- Given a fresh clone, when `docker compose up -d db && npm install && npm run dev`, the app serves on :3000.
- Given db up, GET `/health` returns 200 `{status:"ok",db:"ok"}`; given db down, returns 503 `{status:"degraded",db:"down"}`.
- Given the pristine tree, `npm run lint && npm run typecheck && npm test` all exit 0.
- Given an unknown `/api/v1/*` path, the response body matches the error envelope `{error:{code,message}}` (TDD §8).
- The tree should NOT contain domain models, auth logic, seed data, or dashboard screens — those belong to later specs.

## Risks
Tailwind v4 / Next.js 15 version drift during bootstrap — mitigated by pinning exact versions in package.json and committing the lockfile.

## Rollback
Delete the generated scaffold files; nothing persists outside the repo.
