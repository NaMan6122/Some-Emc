# spec-008-v1: Job 1571 seed pipeline

**Status:** DRAFT
**Version:** 1
**Depends On:** spec-001, spec-002, spec-005, spec-006, spec-007
**Blocks:** NONE
**Task Reference:** —

## What
Migrates the delivered HTML reports into the database per PRD §10 and TDD §9: `scripts/extract-seed.mjs` regex-extracts the inline JS arrays (`items[]`, `trades`, monthly series) and PC table rows from the three report files in this repo → `prisma/seed-data/job1571.json`; `prisma/seed.ts` upserts idempotently: project shell (`1571`, contract CHEC-MIP1C-B2-2025-006, base value), suppliers with a normalization map for known misspellings (originals kept as aliases), all extracted LPO lines (`provenance=IMPORTED_REPORT`, `verification=PENDING`), the 14 payment certificates with per-row provenance mapping (SOURCE_DOCUMENT / OCR_ESTIMATE / CLIENT_SUMMARY / DERIVED per source-report notes), and pre-opened DataFlags for the known issues: S.No 83 "NEED TO CHECK" line, the 50%-only cross-job split, and the ~AED 248K footer-total discrepancy. Bootstrap admin creation stays in spec-003's script, not here.

## Acceptance Criteria
- Running the extractor produces `job1571.json` with ≥140 item entries and 14 PC rows; spot checks pass: top LPO amount parses to exactly 383250000 fils; PC13 net payable parses to exactly 164429700 fils.
- After seeding: project `1571` exists; Σ active latest-revision LPO `amountFils` equals the sum of the extracted dataset and displays as 12.98M ±0.01M when formatted; ≥110 distinct suppliers exist with at least one alias preserved (e.g. the "DEVELOPMWNT" spelling mapped to the normalized vendor).
- Known-issue DataFlags are OPEN with messages naming the three issues above.
- The VariationOrder table remains empty after seed — individual VO titles/values were never present in the sources (only an aggregate in PC13); a DataFlag records the backfill need. Fabricated VO rows should NOT be created.
- Re-running the extractor + seed changes nothing: identical row counts before/after second run (idempotent upserts by natural keys).

## Risks
Regex extraction is pinned to the exact HTML files currently in the repo; if reports are re-exported with different markup, extraction fails loudly rather than seeding partial data (fail-fast guard asserted in script).

## Rollback
Provided reset script deletes the seeded project subtree (cascading by design for seed scope only).
