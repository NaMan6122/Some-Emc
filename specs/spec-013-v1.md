# spec-013-v1: Variation orders module

**Status:** ACTIVE — ratified at G1 2026-08-23
**Version:** 1
**Depends On:** spec-004, spec-005, spec-007
**Blocks:** spec-014
**Task Reference:** —

## What
PRD FR-7: `GET|POST /api/v1/projects/:id/vos`, `PATCH /api/v1/vos/:id`. Fields per TDD §5 (voNumber unique per project, title, status DRAFT→SUBMITTED→APPROVED/REJECTED, submitted/approvedValueFils, approvedAt, approvalRef). Approval requires approvedValueFils + approvedAt. LPO↔VO linkage already enforced by spec-007 validation; this module adds the compliance service: Σ variation-linked amounts claimed via PCs (spec-012 variationClaimFils) where linked VO status ≠ APPROVED → exposed as unapprovedVoExposure KPI and an UNAPPROVED_VO_CLAIM flag when > 0. COMMERCIAL/ADMIN write; others read; mutations audited. Admin screen: VO list with status pills and claim-exposure banner.

## Acceptance Criteria
- COMMERCIAL raises VO #1 "Storm water reroute" SUBMITTED 500,000.00 → 201 + audit.
- APPROVE without value/date → 422; with both → status APPROVED, audit records approval ref.
- Backfill of Job 1571's 11 VOs is now POSSIBLE but NOT automatic: VO_BACKFILL flag resolves only when a human creates them (flag resolution endpoint wired to FR-9 in M3).
- Compliance service returns unapprovedVoExposure = Σ claims on non-APPROVED VOs (fixture: 0 after seeding since VOs empty; >0 once test fixture claims against SUBMITTED VO).
- VIEWER PATCH → 403.

## Risks
Claim attribution between PCs and specific VOs is aggregate in the legacy data (variationClaimFils per PC) — per-VO claim split arrives only if humans backfill linkage; documented limitation.

## Rollback
Remove routes/service/screen; VO rows persist.
