# spec-019-v1: Retention ledger & release tracking (FR-6 / OQ-7)

**Status:** ACTIVE — promoted at G1 2026-08-24
**Version:** 1
**Depends On:** spec-002, spec-004, spec-014, spec-015
**Blocks:** NONE
**Task Reference:** —

## What
PRD FR-6 P1: "Retention ledger: cumulative held; release recording" (OQ-7 directed into M3). New migration adds `RetentionRelease { id BigInt @id, projectId Int, pcId BigInt?, amountFils BigInt (>0), releasedAt DateTime, reference String?, note String?, createdAt }` with optional PC linkage (releases may aggregate across certificates) and Restrict FK behavior consistent with the schema. Endpoints: `GET|POST /api/v1/projects/:id/retention-releases` (FINANCE+ADMIN write per TDD §7 PCs row; others read), DELETE admin-only audited; NO PATCH — financial records are immutable-on-edit, mistakes are deleted by ADMIN (audited) or offset by a new entry. Analytics: cashflow payload gains additive fields `releasedTotalFils` and `retentionHeldFils = Σ PC retentionFils − Σ releases` (honest math, may go negative on bad input rather than being floored) — every existing golden anchor including retentionTotalFils=48909700 stays byte-identical. PC dashboard tab retention card shows held vs released split.

## Acceptance Criteria
- Migration applies cleanly on the dev DB and `prisma migrate status` reports up to date; rerunning seed stays idempotent.
- Given FINANCE posts `{pcId, amountFils:"50,000.00", releasedAt}` against PC13, then 201 + audit row; GET lists it newest-first with fils-exact string.
- Given cashflow after that release, then `retentionTotalFils === "48909700"` unchanged, `releasedTotalFils === "5000000"`, `retentionHeldFils === "43909700"` (additive-fields-only contract verified against spec-014 anchors).
- Given COMMERCIAL POSTs a release, then 403 (finance domain per TDD §7); given non-admin DELETE, then 403.
- Given `amountFils ≤ 0` or malformed money string, then 422 VALIDATION_ERROR.

## Risks
Optional pcId permits over-release beyond any single certificate's retention — accepted for v1; aggregate held figure may go negative by design (visible error beats silent clamp). Schema change touches the shared migration line — rollback requires a down migration.

## Rollback
Create down-migration dropping RetentionRelease; remove routes/service/tests/dashboard card delta; analytics reverts by removing the two additive fields.
