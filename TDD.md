# TDD — ProCare Platform (Trends Electro-Mechanical Works LLC)

**Status:** ACCEPTED — human review passed 2026-08-23; changes from here pass Gate G2
**Version:** 0.1
**Date:** 2026-08-23
**Depends on:** [PRD.md](./PRD.md) v0.1
**ADRs:** [ADR-001](./decisions/ADR-001.md) (monolith Next.js), [ADR-002](./decisions/ADR-002.md) (money as integer fils), [ADR-003](./decisions/ADR-003.md) (JWT cookie sessions)

---

## 1. Design Principles

1. **Correct money first.** Every amount is exact; no floating point anywhere near AED values.
2. **Server is the only source of totals.** Clients never compute financial aggregates.
3. **Audit by default.** Financial entities are immutable-on-edit; corrections create successors.
4. **Boring, proven stack.** Optimized for a small team and long-term maintainability, not novelty.
5. **API-first.** The dashboard is one consumer of a versioned REST API; future importers/mobile reuse it.

## 2. Architecture

Single deployable full-stack app; modular internals so domain logic can be extracted later.

```
Browser (React dashboard)
   │  fetch (JSON)
   ▼
Next.js App Router server
   ├── /api/v1/**            REST endpoints (route handlers)
   ├── middleware.ts         session check + route protection
   └── src/server/
        ├── auth/            session verify, requireRole()
        ├── services/        domain logic (lpo.ts, pc.ts, analytics.ts …)
        ├── validation/      zod schemas shared with client forms
        └── db/              prisma client singleton
   ▼
PostgreSQL 16 (Prisma ORM)
```

## 3. Stack Decisions

| Concern | Choice | Alternatives rejected | Rationale |
|---|---|---|---|
| Framework | Next.js 15 (App Router, TS strict) | NestJS API + Vite SPA | Human-selected; one codebase/deploy for small team; API routes sufficient for REST v1 |
| DB | PostgreSQL 16 | SQLite, MySQL | ACID + numeric types + window functions for cumulative analytics; required in dev via Docker |
| ORM | Prisma | Drizzle, Kysely | Typed schema-first workflow, migrations tooling mature |
| Auth | Hand-rolled jose JWT sessions (httpOnly, SameSite=Lax), argon2id hashes (@node-rs/argon2) — per DCL-001/ADR-004 | Auth.js v5 (superseded: envelope/429/testability conflicts) | Stateless sessions fine at this scale; revocation handled by tokenVersion bump |
| Validation | Zod (shared client/server) | class-validator, yup | One schema drives API validation + form types |
| Charts | Recharts | Chart.js (used in current reports), ECharts | Native React composition; SSR-friendly |
| Tables | TanStack Table | plain HTML tables | Sorting/filtering/pagination needed for the LPO log |
| Client data | SWR | TanStack Query, raw useEffect | Small surface, revalidation fits dashboard freshness needs |
| Logging | pino (JSON, request IDs) | console, winston | Structured logs for ops from day one |
| Tests | Vitest (+ Supertest-style route tests) | Jest, Playwright (P2 for e2e smoke) | Fast TS-native unit/integration |

Money representation: **integer fils (`BigInt`)** — see ADR-002.

## 4. Repository Layout

```
/
├── instruction_v4.md  Memory.md  dev-changelog.md  spec-index.md  PRD.md  TDD.md
├── specs/  decisions/
├── docker-compose.yml          postgres:16 (+ pgadmin optional)
├── .env.example
├── prisma/schema.prisma  prisma/seed.ts  scripts/extract-seed.mjs
└── src/
    ├── app/(dashboard)/…      overview, budget, pcs, investment, vendors, flags
    ├── app/(auth)/login/
    ├── app/api/v1/…
    ├── components/  charts/  tables/
    └── server/{auth,services,validation,db}/  lib/{money,csv,refs}.ts
```

## 5. Data Model (Prisma, abridged)

```prisma
enum Role { ADMIN MANAGEMENT PROCUREMENT COMMERCIAL FINANCE VIEWER }
enum Trade { ELECTRICAL PLUMBING HVAC FIRE_FIGHTING GENERAL HSE OTHER }
enum LpoStatus { DRAFT ISSUED CLOSED CANCELLED }
enum LpoKind { STANDARD VARIATION INTERNAL_TRANSFER }
enum Verification { PENDING VERIFIED FLAGGED }
enum PcStatus { DRAFT SUBMITTED CERTIFIED PAID }
enum Provenance { SOURCE_DOCUMENT OCR_ESTIMATE CLIENT_SUMMARY DERIVED IMPORTED_REPORT }
enum VoStatus { DRAFT SUBMITTED APPROVED REJECTED }

model User    { id Int @id @default(autoincrement()); email String @unique
                passwordHash String; name String; role Role; tokenVersion Int @default(0)
                createdAt DateTime @default(now()) }

model Project { id Int @id; code String @unique           // "1571"
                name String; mainContractor String
                contractValueFils BigInt                 // excl. VAT
                vatRate Decimal @default(0.05) @db.Decimal(5,4)
                status String @default("ACTIVE")
                lpos Lpo[]; pcs PaymentCertificate[]; budgets BudgetLine[]; vos VariationOrder[] }

model Supplier{ id Int @id; name String @unique          // normalized
                aliases Json @default("[]")             // raw import spellings
                mergedIntoId Int? ; lpos Lpo[] }

model Lpo     { id BigInt @id @default(autoincrement())
                projectId Int; refNo String              // unique per project
                seq Int                                  // per-project sequence
                revisionOfId BigInt?                     // self-relation chain root kept via revisions[]
                revisionNo Int @default(0); supersededBy BigInt?
                supplierId Int; trade Trade; description String
                issueDate DateTime; amountFils BigInt    // incl. VAT
                vatRate Decimal @db.Decimal(5,4); kind LpoKind @default(STANDARD)
                status LpoStatus @default(DRAFT)
                verification Verification @default(PENDING); provenance Provenance
                remark String?; voId BigInt?
                @@unique([projectId, refNo]); @@index([projectId, issueDate]) }

model BudgetLine { id BigInt @id; projectId Int; trade Trade
                   category String @default("MATERIALS"); amountFils BigInt
                   sourceLabel String; refDate DateTime?; note String? }

model PaymentCertificate { id BigInt @id; projectId Int; pcNumber Int
                   periodLabel String; periodStart DateTime?; periodEnd DateTime?
                   invoiceDate DateTime?
                   grossFils BigInt; retentionFils BigInt; netPayableFils BigInt
                   variationClaimFils BigInt @default(0); statedCumulativeFils BigInt?
                   status PcStatus @default(DRAFT); provenance Provenance; notes String?
                   @@unique([projectId, pcNumber]) }

model VariationOrder { id BigInt @id; projectId Int; voNumber Int; title String
                   status VoStatus @default(DRAFT)
                   submittedValueFils BigInt; approvedValueFils BigInt?
                   approvedAt DateTime?; approvalRef String? }

model AuditLog  { id BigInt @id; actorId Int; entity String; entityId String
                  action String; before Json?; after Json?; at DateTime @default(now())
                  @@index([entity, entityId]) }

model DataFlag  { id BigInt @id; entityType String; entityId String
                  ruleCode String; severity String; message String
                  status String @default("OPEN"); assigneeId Int?; resolutionNote String?
                  resolvedAt DateTime?; createdAt DateTime @default(now()) }
```

Pain-point mappings: `(projectId, refNo)` unique kills duplicate S.Nos; `revisionOfId/revisionNo/supersededBy` formalize `R1` suffixes; `Verification`+`DataFlag` replace "NEED TO CHECK"; `Supplier.aliases` absorbs misspellings; PC `provenance` records which figures were OCR-estimated; cross-project 50% split is P1 via an `LpoAllocation` table added then.

## 6. Money Handling (see ADR-002)

- All amounts stored as **BigInt fils**. Zod transforms accept decimal strings `"3832500.00"` → fils at the boundary; formatters emit `"AED 3,832,500.00"`.
- Aggregation in SQL (`SUM(bigint)` = exact). Chart layers convert to number only at render time.
- Percentages (utilization, recovery rate) computed as rational numbers then rounded once at display.

## 7. AuthN / AuthZ

- Login issues JWT (httpOnly, SameSite=Lax, Secure in prod, 7-day sliding rotation). Passwords: argon2id. Failed logins rate-limited in-memory per IP+email (Redis later if needed).
- `middleware.ts` guards `/` and `/api/v1/**` except `/auth/login`; `requireRole(...roles)` enforced inside every mutating handler — never UI-only.
- Role matrix (mutating rights):

| Endpoint group | ADMIN | MGMT | PROCURE | COMMERCIAL | FINANCE | VIEWER |
|---|---|---|---|---|---|---|
| Projects | RW | R | R | R | R | R |
| Suppliers | RW | R | RW | R | R | R |
| LPOs | RW | R | RW | R (link VO) | R | R |
| Budgets | RW | R | R | RW | R | R |
| PCs | RW | R | R | R | RW | R |
| VOs | RW | R | R | RW | R | R |
| Flags resolve | RW | R | RW (proc.) | RW (comm.) | RW (fin.) | R |
| Users / audit | RW | R | — | — | — | — |

## 8. API Design (v1)

Conventions: prefix `/api/v1`; error envelope `{ error: { code, message, details? } }`; zod-parsed bodies; cursor pagination on list endpoints (`limit`, `cursor`).

Core resources:

```
POST   /api/v1/auth/login | logout        GET /api/v1/auth/me
GET|POST /api/v1/projects                 GET|PATCH /api/v1/projects/:id
GET|POST /api/v1/suppliers               POST /api/v1/suppliers/:id/merge
POST   /api/v1/projects/:id/lpos         GET /api/v1/projects/:id/lpos?trade=&status=&q=&cursor=
PATCH  /api/v1/lpos/:id                  POST /api/v1/lpos/:id/revisions   ← correction path
POST   /api/v1/projects/:id/budget-lines
POST   /api/v1/projects/:id/pcs          PATCH /api/v1/pcs/:id/status
POST   /api/v1/projects/:id/vos          PATCH /api/v1/vos/:id
GET    /api/v1/projects/:id/analytics/{overview,budget,cashflow,investment,vendors}
GET    /api/v1/flags?status=OPEN         PATCH /api/v1/flags/:id
GET    /api/v1/audit?entity=Lpo&entityId=…
GET    /api/v1/projects/:id/export/lpos.csv
```

Analytics endpoints return exactly the KPI structures of PRD §8, computed in services via SQL aggregates (window functions for cumulative series). No client-side aggregation.

## 9. Seed & Import Pipeline

`scripts/extract-seed.mjs` regex-extracts the inline JS arrays (`items[]`, `trades`, `months/monthVals`, `topSuppliers`, PC table rows) from the three delivered HTML files → `prisma/seed-data/job1571.json`. `prisma/seed.ts` upserts idempotently: project 1571, suppliers (with normalization map for known typos, originals kept in `aliases`), 140 LPOs (provenance=IMPORTED_REPORT, verification=PENDING except report-verified ones), 14 PCs, 3 JCA budget lines, VO summary row(s), and pre-opened DataFlags for the known issues. Bootstrap ADMIN created from env vars at first seed (OQ-8).

## 10. Config & Environments

`.env.example`: `DATABASE_URL`, `AUTH_SECRET`, `BOOTSTRAP_ADMIN_EMAIL`, `BOOTSTRAP_ADMIN_PASSWORD` (never committed with real values — §15.13 of instruction_v4.md). Dev DB via `docker-compose up -d db`. No SQLite fallback: schema relies on Postgres types.

## 11. Testing Strategy

- **Unit:** money transforms, ref generation, variance/recovery formulas (Vitest).
- **Integration:** API route tests against a disposable Postgres (testcontainers or compose test DB): auth gates per role, LPO revision chain integrity, PC arithmetic + gap detection, analytics fixtures reproducing Job 1571 headline numbers (12.98M / 10.33M / 2.31M / 81.8%) as regression anchors.
- **E2E (P2):** Playwright login → dashboard smoke.

## 12. Deployment & Ops

Dev: Docker Compose (Postgres only; `npm run dev`). Prod target (pending OQ-3): single Node container + managed/containerized Postgres behind reverse proxy TLS; `prisma migrate deploy` on release; `/health` endpoint pings DB; daily `pg_dump` + restore drill documented. Logs: pino JSON to stdout.

## 13. Security Checklist

argon2id hashes · httpOnly/SameSite cookies · CSRF posture via SameSite + origin check on mutations · zod on every input · RBAC server-side · parameterized queries via Prisma · no secrets in repo · dependency audit in CI · login rate limiting · audit log immutable.

## 14. Milestones

| Milestone | Scope (PRD refs) | Exit criteria |
|---|---|---|
| M1 Foundation | FR-1, FR-2, FR-3, FR-4, FR-11 | Login+RBAC live; project 1571 seeded; LPO CRUD + revisions; audit entries written |
| M2 Money | FR-5, FR-6, FR-7, FR-8 | Budgets, PCs, VOs; all six dashboard tabs reproduce report figures within tolerance |
| M3 Governance | FR-9, flag rules, CSV export | Flag queue operational with seeded Job 1571 flags |
| M4 Reporting+ | FR-10, allocations, merges, bulk CSV import | Print/PDF report parity with current static deliverables |

Each milestone decomposes into atomic specs under `specs/` after PRD/TDD sign-off.

## 15. Risks

| Risk | Mitigation |
|---|---|
| Imported legacy data quality (OCR estimates, unverified lines) | provenance + verification states; seeded flags make debt visible day one |
| Supplier dedup errors during normalization | aliases preserve originals; merge tool is P1 with audit trail |
| Scope creep toward ERP | PRD §4 non-goals; deviations require DCL entry |
| Analytics mismatch vs historical reports | integration tests anchor on report figures as golden values |

## 16. Open Dependencies

OQ-1 (currency) blocks finalizing ADR-002 scope. OQ-3 (hosting) shapes §12 but not design. Others tracked in `Memory.md`.
