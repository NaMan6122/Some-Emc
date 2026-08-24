# spec-023-v1: Print/PDF report parity (FR-10)

**Status:** ACTIVE — promoted at G1 2026-08-24
**Version:** 1
**Depends On:** spec-014, spec-015
**Blocks:** NONE
**Task Reference:** —

## What
PRD FR-10: print/PDF stylesheet reproducing the current static ProCare report structure. New route `/report?project=CODE` (server component calling analytics services directly — no client fetch round-trip): cover block (project name/code, contract ref+value, report generation timestamp), executive summary (headline KPIs), then sections mirroring the legacy reports in order — trade mix, budget vs actual variance table, payment certificates log, investment & recovery, vendors concentration, data-flags appendix. Figures come from the same services as the dashboards, so values are byte-identical by construction. A `@media print` layer hides app chrome (sidebar/topbar/filters/buttons), forces white background/black text, paginates tables with repeated headers, and a Print button calls `window.print()` — PDF via the browser's own print-to-PDF; NO server-side headless rendering (documented decision: zero new infra for a P1 deliverable). Monthly snapshot scheduling stays P2 per PRD.

## Acceptance Criteria
- Given seeded Job 1571, then /report?project=1571 renders cover + exec summary + six sections containing the golden figures (total committed AED 12,984,115.00 · certified AED 10,331,978.00 · recovery ≈81.8% display value · FIRE_FIGHTING coverage gap note).
- Given Playwright page.emulateMedia({media:"print"}), then sidebar/topbar/print-button are display:none and the content column fills the page width.
- Given a viewer role, then the page renders read-only identically; unauthenticated → login redirect.
- Section order matches: summary → trade mix → budget → certificates → investment → vendors → flags appendix.

## Risks
Browser-print PDF quality varies by engine — acceptable for v1 (evergreen targets only, PRD §11); server-side rendering to PDF would add Chromium infra explicitly rejected this milestone.

## Rollback
Remove the route + print CSS layer; dashboards untouched.
