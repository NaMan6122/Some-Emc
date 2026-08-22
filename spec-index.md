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
| spec-010 | LPO log screen | v1 | ACTIVE | spec-007, spec-009 | — | Ratified (DCL-002 deliverable) |
| spec-011 | Budgets module (JCA) | v1 | ACTIVE | spec-004, spec-005 | — | Ratified; queued |
| spec-012 | Payment certificates module | v1 | ACTIVE | spec-004, spec-005 | — | Ratified; queued |
| spec-013 | Variation orders module | v1 | ACTIVE | spec-004, spec-005, spec-007 | — | Ratified; queued |
| spec-014 | Analytics engine & endpoints | v1 | ACTIVE | spec-007, spec-011, spec-012, spec-013 | — | Golden anchors from Job 1571; queued |
| spec-015 | Dashboard screens (six tabs) | v1 | ACTIVE | spec-009, spec-010, spec-014 | — | Ratified; queued |

_M1 (spec-001..008): all IMPLEMENTED — milestone ratified at G5 2026-08-23. M2 batch (009–015) drafted, pending Gate G1._

_Promoted DRAFT → ACTIVE by human at Gate G1 on 2026-08-23 (all eight). design.md v0.1 ACCEPTED in the same checkpoint._
