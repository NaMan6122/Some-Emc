# Spec Index

| Spec | Title | Version | Status | Depends On | Task | Notes |
|---|---|---|---|---|---|---|
| spec-001 | Application scaffold & toolchain | v1 | ACTIVE | NONE | T-007 IN_PROGRESS | |
| spec-002 | Database schema foundation | v1 | IMPLEMENTED | spec-001 | T-008 DONE | Case-insensitive supplier uniqueness enforced at service layer (uppercase invariant), documented in schema |
| spec-003 | Authentication & RBAC | v2 | IMPLEMENTED | spec-001, spec-002 | T-009 DONE | v1 DEPRECATED by DCL-001; v2 + ADR-004 approved at G1 2026-08-23 |
| spec-004 | Audit trail service & API | v1 | IMPLEMENTED | spec-002, spec-003 | T-010 DONE | |
| spec-005 | Projects module | v1 | IMPLEMENTED | spec-003, spec-004 | T-011 DONE | |
| spec-006 | Suppliers vendor master | v1 | IMPLEMENTED | spec-003, spec-004 | T-012 DONE | |
| spec-007 | LPO register | v2 | IMPLEMENTED | spec-003, spec-004, spec-005, spec-006 | T-013 DONE | v2 ratified at G1 2026-08-23; UI re-scoped to M2 (DCL-002) |
| spec-008 | Job 1571 seed pipeline | v2 | IMPLEMENTED | spec-001, spec-002, spec-005, spec-006, spec-007 | T-014 DONE | v2 ratified at G1 2026-08-23; ≥85 vendors post-canonicalization (DCL-003) |
| spec-009 | App shell & navigation | v1 | IMPLEMENTED | spec-003 | T-016 DONE | Design tokens now live in globals.css |
| spec-010 | LPO log screen | v1 | IMPLEMENTED | spec-007, spec-009 | T-017 DONE | Ratified (DCL-002 deliverable) |
| spec-011 | Budgets module (JCA) | v1 | IMPLEMENTED | spec-004, spec-005 | T-018 DONE | Variance v1 counts all non-cancelled LPOs (SWPS exclusion deferred to spec-014, see Memory.md) |
| spec-012 | Payment certificates module | v2 | ACTIVE — v2 correction DRAFT pending G1 | spec-004, spec-005 | T-019 DONE | AC1 Σ-net figure corrected per DCL-004 (10,331,978.00 AED row-sum); rest identical to ratified v1 |
| spec-013 | Variation orders module | v1 | IMPLEMENTED | spec-004, spec-005, spec-007 | T-020 DONE | Exposure attribution project-level aggregate per Risks limitation; UNAPPROVED_VO_CLAIM flag wired |
| spec-014 | Analytics engine & endpoints | v2 | ACTIVE — v2 corrections DRAFT pending G1 | spec-007, spec-011, spec-012, spec-013 | T-021 DONE | Golden anchors reproduce at DB-exact precision; DCL-005a/b constants; SWPS exclusion lens in analytics/budget only |
| spec-015 | Dashboard screens (six tabs) | v1 | IMPLEMENTED | spec-009, spec-010, spec-014 | T-022 DONE | Recharts dashboards live; flags read-only feed (FR-9 triage M3) |

_M1 (spec-001..008): all IMPLEMENTED — milestone ratified at G5 2026-08-23. M2 batch (009–015) drafted, pending Gate G1._

_Promoted DRAFT → ACTIVE by human at Gate G1 on 2026-08-23 (all eight). design.md v0.1 ACCEPTED in the same checkpoint._
