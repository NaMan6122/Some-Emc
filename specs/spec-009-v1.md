# spec-009-v1: Application shell & navigation

**Status:** ACTIVE — ratified at G1 2026-08-23
**Version:** 1
**Depends On:** spec-003 (auth), design.md §3–§8
**Blocks:** spec-010, spec-015
**Task Reference:** —

## What
Implements design.md §3 app shell: fixed sidebar (240px, icon-rail <1280px, off-canvas <768px) with project switcher chip and grouped nav — Analytics (Overview, Budget vs Actual, Payment Certificates, Investment, Vendors & LPO Log), Governance (Data Flags with open-count badge), Administration (Projects, Suppliers, Users, Audit Log; role-gated); sticky topbar with global search placeholder (⌘K palette P1), reporting-period slot, flag indicator, user menu (name/role/logout); page pattern component (eyebrow → title → context → actions). Design tokens from design.md §4–§6 land here as Tailwind theme variables (zinc neutrals + indigo accent, light/dark via class strategy), plus shared primitives: StatusPill (all enums §7), KPI card skeleton, EmptyState, ErrorBanner, DataTable wrapper over TanStack Table, Drawer. SWR provider configured.

## Acceptance Criteria
- Given login as each role, the sidebar shows Administration group only for ADMIN; PROCUREMENT additionally sees no Budget edit entries (nav is role-aware).
- Project switcher lists seeded projects and persists selection in the URL (?project=1571 defaulting to first ACTIVE project).
- Every route renders the shell without layout shift >8px on 1024/1440 widths; <768px nav opens as drawer.
- StatusPill maps every enum value of Lpo/Pc/Vo/Verification/Provenance to the §7 treatments with visible text labels.
- Dark mode toggling flips tokens with AA contrast pairs intact (spot-checked via test ids).
- Unauthenticated deep-link redirects to /login preserving the target path post-login.

## Risks
Token drift between design.md and CSS variables — mitigated by defining tokens once in globals.css and referencing by name everywhere.

## Rollback
Shell is additive UI; removing it restores standalone pages.
