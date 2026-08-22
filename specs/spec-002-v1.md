# spec-002-v1: Database schema foundation

**Status:** DRAFT
**Version:** 1
**Depends On:** spec-001
**Blocks:** spec-003, spec-004, spec-005, spec-006, spec-007, spec-008
**Task Reference:** —

## What
Implements the full Prisma schema per TDD §5 — User, Project, Supplier (with aliases/mergedIntoId), Lpo (revision self-relations: revisionOfId/revisionNo/supersededBy), BudgetLine, PaymentCertificate, VariationOrder, AuditLog, DataFlag — including enums, unique constraints `(projectId, refNo)` and `(projectId, pcNumber)`, Restrict deletes from Project to financial children, indexes for project+date queries. Adds the Prisma client singleton, `lib/money.ts` fils parse/format helpers, and the BigInt JSON serialization convention for API layers.

## Acceptance Criteria
- Given a clean database, when `npx prisma migrate dev`, the initial migration applies and `prisma migrate status` reports up-to-date.
- Given an existing Lpo `(projectId:1, refNo:"X")`, inserting another `(projectId:1, refNo:"X")` is rejected with a unique-constraint error.
- Given a Project with a dependent Lpo, when DELETE on the project, it is rejected (Restrict), not cascaded.
- Given stored `amountFils = 383250000n`, read-back equals exactly; `money.parse("3,832,500.00") === 383250000n`; `money.format(383250000n) === "AED 3,832,500.00"`.
- BigInt values never appear raw in JSON responses — serialization goes through the shared mapper, guarded by a lint/test check.
- No business rows are inserted by this spec's migration (schema only).

## Risks
Prisma self-relation naming on Lpo revisions is error-prone — resolved with explicit named relations. BigInt serialization is cross-cutting; enforcing it here so all later specs inherit the convention.

## Rollback
Drop the database and remove schema/migration files; no external state involved.
