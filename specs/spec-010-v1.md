# spec-010-v1: LPO log screen

**Status:** ACTIVE — ratified at G1 2026-08-23
**Version:** 1
**Depends On:** spec-007, spec-009
**Blocks:** NONE
**Task Reference:** —

## What
The LPO register UI per design.md §8, mounted in the shell under Vendors & LPO Log: TanStack table (frozen first columns, right-aligned tabular numerals, row height 40px, sticky header), filter bar (trade chips with categorical dots, debounced free-text search across supplier/material/ref, status & verification multi-selects, date range, clear-all), cursor-paginated rows with "Load more", totals footer (activeCount + activeSumFils formatted AED), CSV export button hitting the export endpoint with current filters. Row click opens the right detail drawer (480px): full record + revision-chain timeline (each revision's refNo R-suffix, amount delta, superseded links). PROCUREMENT sees create form (drawer) and allowed actions; COMMERCIAL sees only VO-link editing on VARIATION lines; other roles read-only. Server 403s surface as disabled controls + toast.

## Acceptance Criteria
- Given seeded project 1571, the table renders 140 latest-revision rows paginated by 50, totals footer shows "140 · AED 12,984,115.00".
- Typing "musandam" filters to that vendor's rows within 300ms debounce; clearing restores.
- Trade chip ELECTRICAL reduces rows to ELECTRICAL trade only; combined with q it narrows further; CSV download contains exactly those rows.
- As PROCUREMENT, changing amount on an ISSUED row creates revision 061R1-style successor; drawer timeline shows both revisions linked.
- As COMMERCIAL, non-voId controls are disabled with tooltip "COMMERCIAL may edit the VO link only"; VIEWER sees no action buttons at all.
- FLAGGED verification rows render rose-dot pill and open the flag note in the drawer.

## Risks
Table performance with wide filters — mitigated by cursor pagination and frozen-column virtualization if needed (P1).

## Rollback
Remove the screen; API remains unaffected.
