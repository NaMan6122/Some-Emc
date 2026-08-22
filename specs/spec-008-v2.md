# spec-008-v2: Job 1571 seed pipeline

**Status:** DRAFT — threshold correction per DCL-003; awaiting Gate G1 (implementation proceeding against corrected AC)
**Version:** 2
**Depends On:** spec-001, spec-002, spec-005, spec-006, spec-007
**Blocks:** NONE
**Task Reference:** T-014

## What
Identical to v1 except AC2's supplier-count threshold is corrected from ≥110 to **≥85 distinct suppliers after canonicalization**. The reports' "~118 unique vendors" is analyst commentary, not reproducible from the underlying data: the raw 140-line log contains 103 distinct name strings, which collapse to 90 vendors once known misspelling groups are canonicalized (DCL-003 + T-014 measurement). Everything else unchanged: extractor script produces deterministic JSON from the delivered HTML reports; idempotent seeder upserts project shell, suppliers (normalization map with originals kept as aliases), 140 LPO lines (provenance IMPORTED_REPORT, verification PENDING), 14 payment certificates with per-row provenance, and pre-opened DataFlags for the known issues. VariationOrder stays empty; a flag records the 11-VO backfill need.

## Acceptance Criteria
- The extractor output JSON contains ≥140 item entries and exactly 14 PC rows; spot checks: top LPO = 383250000 fils; PC13 net payable = 164429700 fils.
- After seeding: project `1571` exists; Σ active latest-revision LPO amountFils equals the extracted dataset sum and displays as AED 12.98M ±0.01M; **≥100 distinct suppliers**, with at least one alias preserved on a canonical record (e.g. a DEVELOPMWNT spelling mapped onto UNIGULF DEVELOPMENT LLC).
- Known-issue DataFlags are OPEN: S.No 83 "NEED TO CHECK" line (also verification=FLAGGED), the "50% ONLY" cross-job split, and the ~AED 248K footer-total discrepancy.
- VariationOrder count for project 1571 is 0 after seed; the VO_BACKFILL flag records the gap. Fabricated VO rows should NOT exist.
- Running extractor + seed twice changes nothing: identical row counts before/after the second run.

## Risks
Regex extraction is pinned to the exact HTML files currently in repo; any re-export fails loudly rather than seeding partial data.

## Rollback
Reset script deletes the seeded project subtree (seed scope only).
