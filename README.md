# ProCare Platform — Trends Electro-Mechanical Works LLC

> **Procurement & contract analytics, from spreadsheet chaos to a single audited source of truth.**
> Live dashboards for LPOs, JCA budgets, payment certificates, variation orders, vendor analytics and data-quality governance — built for Job 1571 (Mid Island Parkway Phase 1C) and every project after it.

ProCare replaces the hand-maintained LPO log (140 active lines, ~118 suppliers), 14 payment certificates, and JCA Appendix I-III budgets that previously lived as static HTML reports with a validated, multi-project platform. Every total is computed server-side; every money move is audited.

**Reference engagement:** Mid Island Parkway Phase 1C, Job **1571** · Contract `CHEC-MIP1C-B2-2025-006` · Base value **AED 18,786,625 (excl. VAT)** · Seed anchors: AED 12,984,115 committed · AED 10,331,978 certified · 81.8% recovery.

---

## Table of contents

- [Landing](#landing)
- [Features](#features)
- [Tech stack](#tech-stack)
- [Architecture](#architecture)
- [Data model](#data-model)
- [Money handling](#money-handling)
- [Auth & RBAC](#auth--rbac)
- [API overview](#api-overview)
- [Project structure](#project-structure)
- [Getting started](#getting-started)
- [Deployment](#deployment)
- [Scripts](#scripts)
- [Testing](#testing)
- [Design system](#design-system)

---

## Landing

`/` is now a **public landing page** — the product front door — with a fullscreen GIF hero.

*   Drop your asset at `public/hero.gif` (recommended 1920×1080, <8 MB, muted loop). If missing, a gradient + grid fallback renders automatically — no code change needed.
*   Authenticated visitors see **Go to Dashboard →** (`/overview`); guests see **Sign in**.
*   Protected app routes (`/overview`, `/budget`, `/vendors`, …) still enforce auth via middleware and redirect to `/login?next=…`.
*   Fully responsive and print-clean (report page ships its own `@media print` layer).

To replace the background without touching code: overwrite `public/hero.gif`. The overlay gradient (`from-white/70 to-white/90` + dark variant) keeps headline contrast on any footage.

---

## Features

| Area | What it does | Key guarantees |
|---|---|---|
| **Landing** | Public marketing hero, feature grid, live KPI preview, CTA | Static, fast, swappable GIF |
| **LPO Register** | Create/revise LPOs, revision chains (`R1` suffix formalized), verification (`PENDING/VERIFIED/FLAGGED`), VO linkage, allocations, bulk CSV import | Ref uniqueness per project, financial edits create successors, `CANCELLED` excluded from totals |
| **JCA Budgets** | Trade/category lines, variance `committed ÷ budget` with `under/watch/over/no_budget` bands, coverage-gap callout | Thresholds configurable; storm-water package excluded from committed lens where noted |
| **Payment Certificates** | Sequential PC number, `net = gross − retention` enforced, gapless advisory, cumulative cross-check, retention ledger | Provenance chips (`SOURCE/OCR/CLIENT/DERIVED`), `PAID` only from `CERTIFIED` |
| **Variation Orders** | `DRAFT→SUBMITTED→APPROVED/REJECTED`, approval requires value+date, compliance KPI (unapproved exposure) | Terminal states, audit captures `approvalRef` |
| **Analytics — Overview** | Total, active count, suppliers, median/largest, flagged, trade breakdown, monthly series | Matched-window semantics (carry-in base), DB-exact goldens |
| **Analytics — Budget** | Grouped bars, gap banner, utilisation pills per trade | SWPS TEMW/REF/LPO//039 excluded on committed side only |
| **Analytics — Cashflow** | Monthly + cumulative certified, retention totals, variation-claim exposure | Window `2025-04…2026-05`, cumulative = row-sum |
| **Analytics — Investment** | Invested vs recovered, outstanding gap, recovery `81.75%`, peak Dec 25 | Period-label bucketing, not invoice date |
| **Analytics — Vendors** | Top-8 share `79.33%`, repeat suppliers 26, long-tail 64, Pareto bars | Canonicalized to 90 masters from 103 raw strings |
| **Data Flags** | Rule-based queue: duplicate refs, no-budget trades, PC gaps, unapproved claims, unverified imports, fuzzy suppliers | Assign / Resolve / Wont-fix, severity, audit, triage by domain role |
| **Retention Ledger** | Per-project releases against PCs, optional `pcId`, additive `held = Σheld − Σreleased` KPI | No clamp — over-release shows negative (honest) |
| **CSV Exports** | Every filtered list: LPOs, PCs, VOs, budgets, variance, flags, suppliers, audit | `text/csv;charset=utf-8`, `formatMoney` cells |
| **Cross-project Allocations** | `LpoAllocation` pct 1..100 per LPO, `Σ≤100`, deduct via allocated KPIs | `ADMIN+COMMERCIAL` write, audited |
| **Supplier Merge** |_vendor master_ with case-insensitive dedup, STOP-token + Levenshtein suggestions, merge re-points LPOs | `mergedIntoId`, aliases preserved |
| **Users (Admin)** | Create (one-time password), role change, deactivate/reactivate, reset password; self/last-admin guards, instant revocation | No hard deletes |
| **Printable Report** | `/report?project=1571` — cover, exec summary, 6 sections, flags appendix; `@media print` strips chrome | Server-rendered from analytics services — parity by construction |

---

## Tech stack

| Concern | Choice | Notes |
|---|---|---|
| Framework | Next.js 15 App Router, TS strict | Single deployable, API routes for REST v1 |
| DB | PostgreSQL 16 (Neon managed in prod) | Numeric types, window functions, advisory locks |
| ORM | Prisma 6 | Typed schema, `migrate deploy` in prod |
| Auth | `jose` HS256 JWT in `httpOnly/SameSite=Lax/Secure` cookie + `argon2id` (`@node-rs/argon2`) | `tokenVersion` revocation, in-memory rate limiter |
| Validation | Zod — shared client/server | `moneyString` transform at boundary |
| Charts | Recharts 3 | Horizontal-only gridlines, dark tooltips, `aria-label` summaries |
| Tables | TanStack Table 8 | Sticky header, frozen ref column, tabular numerals |
| Client data | SWR | Project-context + analytics hooks |
| Tests | Vitest | 29 files / 155 tests, `fileParallelism:false` for shared DB |
| Styling | Tailwind v4 `@theme` + CSS-variable tokens (zinc/indigo, class dark) | Pino JSON logging to stdout |

**Money:** every amount stored as `BigInt` fils. Parsers emit AED strings `AED 1,583,925.00` with `tabular-nums`.

---

## Architecture

```
Browser (React + Recharts + TanStack)
   │  JSON / CSV
   ▼
Next.js App Router
   ├── middleware.ts          session gate, public-path allowlist
   ├── /api/v1/**             route handlers → services → Prisma
   └── src/server/{auth,services,validation,db}/
   ▼
PostgreSQL 16 (Prisma)
```

Single deployable. Domain logic lives in `src/server/services/*` so it can be extracted later. No client ever computes a total.

---

## Data model (Prisma, abridged)

```prisma
model Project { id Int @id; code String @unique; contractValueFils BigInt; pcs Lpo[]; … }
model Supplier { id Int @id; name String @unique; aliases Json; mergedIntoId Int?; lpos Lpo[] }
model Lpo { id BigInt @id; projectId Int; refNo String; seq Int; revisionOfId BigInt?; supersededById BigInt? @unique;
            supplierId Int; trade Trade; amountFils BigInt; status LpoStatus; verification Verification; … }
model BudgetLine { id BigInt @id; projectId Int; trade Trade; category String; amountFils BigInt; sourceLabel String }
model PaymentCertificate { id BigInt @id; projectId Int; pcNumber Int; grossFils BigInt; retentionFils BigInt; netPayableFils BigInt; … }
model VariationOrder { id BigInt @id; projectId Int; voNumber Int; status VoStatus; submittedValueFils BigInt; … }
model RetentionRelease { id BigInt @id; projectId Int; pcId BigInt?; amountFils BigInt; releasedAt DateTime }
model LpoAllocation { id BigInt @id; lpoId BigInt; targetProjectId Int; pct Int; @@unique([lpoId,targetProjectId]) }
model DataFlag { id BigInt @id; entityType String; entityId String; ruleCode String; severity String; status String }
model User { id Int @id; email String @unique; role Role; active Boolean; tokenVersion Int }
model AuditLog { id BigInt @id; actorId Int; entity String; entityId String; action String; before Json?; after Json? }
```

See `prisma/schema.prisma` for indexes, uniques (`projectId+refNo`, `projectId+seq`, `projectId+pcNumber`, …) and `Restrict` deletes on financial relations.

---

## Money handling

`src/lib/money.ts` — `parseMoney("1,234.50") → 123450n`, `formatMoney(123450n) → "AED 1,234.50"`. Server aggregates via `SUM(bigint)` (exact); charts convert to `number` only at render time; percentages round once at display.

---

## Auth & RBAC

JWT (`jose`) 7-day sliding cookie. `argon2id` hashes. Login rate-limited per `IP+email`.

| Endpoint group | ADMIN | MANAGEMENT | PROCUREMENT | COMMERCIAL | FINANCE | VIEWER |
|---|---|---|---|---|---|---|
| Projects | RW | R | R | R | R | R |
| Suppliers | RW | R | RW | R | R | R |
| LPOs (+ import) | RW | R | RW | R(VO link) | R | R |
| Budgets | RW | R | R | RW | R | R |
| PCs + retention | RW | R | R | R | RW | R |
| VOs + allocations | RW | R | R | RW | R | R |
| Flags triage | RW | R | RW(proc.) | RW(comm.) | RW(fin.) | R |
| Users / audit / audit.csv | RW | R | — | — | — | — |

Flags triage is **domain-scoped**: `Lpo/Supplier→PROCUREMENT`, `BudgetLine/VariationOrder→COMMERCIAL`, `PaymentCertificate→FINANCE`, `Project→any of the three`; `ADMIN` bypasses. Middleware is edge-safe; `requireRole()` enforces server-side on every mutating handler.

---

## API overview

Prefix `/api/v1` · envelope `{ error:{code,message,details?} }` · zod bodies · cursor pagination on lists.

```
POST   /auth/login | /auth/logout        GET /auth/me
GET|POST /projects                        GET|PATCH /projects/:id
GET|POST /suppliers                       POST /suppliers/:id/merge
GET      /suppliers/duplicates/suggestions
POST   /projects/:id/lpos                 GET /projects/:id/lpos  ·  PATCH /lpos/:id
POST   /projects/:id/lpos/import?dry_run= GET /projects/:id/lpos/export  (CSV)
GET|POST /projects/:id/budget-lines       GET /projects/:id/variance
GET|POST /projects/:id/pcs                GET|POST /projects/:id/vos
GET|POST /projects/:id/retention-releases DELETE /retention-releases/:id
GET|POST /lpos/:id/allocation             DELETE /allocations/:id
GET    /projects/:id/analytics/{overview,budget,cashflow,investment,vendors}
GET    /flags  ·  PATCH /flags/:id        POST /projects/:id/flags/scan
GET    /users  ·  POST /users  ·  PATCH /users/:id
GET    /audit  ·  GET /audit.csv  ·  GET /projects/:id/export/{pcs,vos,budget-lines,variance,flags}.csv
GET    /health
```

---

## Project structure

```
/
├── DEPLOY.md  PRD.md  TDD.md  design.md  spec-index.md  Memory.md  dev-changelog.md
├── decisions/  specs/  memory-archive/  scripts/  prisma/
└── src/
    ├── app/
    │   ├── page.tsx              ← landing (public, GIF hero)
    │   ├── login/                ← LoginForm + /login page
    │   ├── (app)/                ← authenticated shell: overview/budget/pcs/investment/vendors/flags/admin/report
    │   └── api/v1/**             ← REST handlers
    ├── components/  charts/  tables/  hooks/
    ├── server/{auth,services,validation,db}/
    └── lib/{api-envelope,money,bigint-json,csv,http-error}.ts
```

---

## Getting started

**Prereqs:** Node ≥20.9, Docker (for local Postgres).

```bash
# 1. Env — copy and fill
cp .env.example .env   # local docker URL + generate AUTH_SECRET (openssl rand -hex 32)

# 2. Install + DB
npm ci                 # postinstall runs prisma generate
docker compose up -d db
npx prisma migrate deploy

# 3. Seed Job 1571 (idempotent) + bootstrap an admin
npm run seed:job1571
npm run user:add -- admin@trends.local "Admin" ADMIN   # prints password once

# 4. Run
npm run dev            # http://localhost:3000  (landing at /, dashboard at /overview)
```

`.env.production` holds the Neon pooled URL for prod work (`set -a && source .env.production && npx prisma migrate deploy` etc.). `.env` is local docker; keep them split — `neon env pull` overwrites `.env`.

Useful one-offs: `npm run typecheck` · `npm run lint` · `npm test` · `npm run build` (passes env-less).

**Seed pipeline internals:** `scripts/extract-seed.mjs` parses the three delivered HTML reports into `prisma/seed-data/job1571.json` (fail-fast on missing structures); `prisma/seed.mjs` upserts idempotently with canonicalization aliases.

---

## Deployment

See **`DEPLOY.md`** for the full runbook (container + bare-node paths, triage table for the `503 SERVER_CONFIG / DB_UNAVAILABLE` envelopes, and Neon notes). Short version:

```bash
docker build -t procare .      # multi-stage, NO secrets needed at build time
docker run -p 3000:3000 -e DATABASE_URL="…neon…?sslmode=require" -e AUTH_SECRET="$(openssl rand -hex 32)" procare
docker exec <ctr> npx prisma migrate deploy
```

`GET /api/health` must return `{"status":"ok","db":"ok"}`. Production split: `.env` = local Docker, `.env.production` = Neon pooled URL; Vercel function region should be `sin1` (Singapore) colocated with Neon's `ap-southeast-1` to avoid cross-region latency, otherwise pages feel slow.

---

## Scripts

| Script | Purpose |
|---|---|
| `dev` | Next dev (hot reload) |
| `build` / `start` | Production build + serve |
| `typecheck` / `lint` / `test` | `tsc --noEmit` / eslint / vitest |
| `user:add` | `node scripts/user-add.mjs <email> <name> <ROLE> [password]` |
| `extract:job1571` / `seed:job1571` | Regenerate + apply Job 1571 seed |
| `db:migrate` | `prisma migrate deploy` (prod) |

---

## Testing

Vitest, headless route tests against a disposable Postgres — fileParallelism off so suites share the dev DB safely. Re-introduced `file.svg` etc. are static assets only.

```bash
npm test
```

Each spec's acceptance criteria map 1:1 to test assertions; analytics fixtures assert the Job 1571 goldens to the fils (e.g. `retentionTotalFils = 48909700`). Playwright is used for dashboard browser smoke (zero console errors).

---

## Design system

Tokens live in `src/app/globals.css` (`zinc`/`indigo`, class dark) and `design.md §3–§13`. Shared primitives: `StatusPill`, `ProvenanceChip`, `TradeDot`, `KpiCard`, `ChartFrame`, `EmptyState`. Tables: TanStack v8, sticky header, frozen ref column, tabular numerals. Charts: Recharts, horizontal-only gridlines, dark tooltips, `aria-label` figure summaries.

---

*Stack decision confirmed by human: Next.js + PostgreSQL. Arabic localization deferred. OQ backlog tracked in `Memory.md`.*
