# Spec Index

| Spec | Title | Version | Status | Depends On | Task | Notes |
|---|---|---|---|---|---|---|
| spec-001 | Application scaffold & toolchain | v1 | ACTIVE | NONE | T-007 IN_PROGRESS | |
| spec-002 | Database schema foundation | v1 | IMPLEMENTED | spec-001 | T-008 DONE | Case-insensitive supplier uniqueness enforced at service layer (uppercase invariant), documented in schema |
| spec-003 | Authentication & RBAC | v2 | IMPLEMENTED | spec-001, spec-002 | T-009 DONE | v1 DEPRECATED by DCL-001; v2 + ADR-004 approved at G1 2026-08-23 |
| spec-004 | Audit trail service & API | v1 | IMPLEMENTED | spec-002, spec-003 | T-010 DONE | |
| spec-005 | Projects module | v1 | IMPLEMENTED | spec-003, spec-004 | T-011 DONE | |
| spec-006 | Suppliers vendor master | v1 | IMPLEMENTED | spec-003, spec-004 | T-012 DONE | |
| spec-007 | LPO register | v2 | DRAFT (v1 IMPLEMENTED) | spec-003, spec-004, spec-005, spec-006 | T-013 DONE | v1 ACs all verified; v2 re-scopes UI to M2 per DCL-002 — awaiting G1 ratification |
| spec-008 | Job 1571 seed pipeline | v2 | DRAFT (v1 superseded pre-ratification) | spec-001, spec-002, spec-005, spec-006, spec-007 | T-014 DONE | AC threshold corrected ≥110→≥85 post-canonicalization (DCL-003); all ACs verified live |

_Promoted DRAFT → ACTIVE by human at Gate G1 on 2026-08-23 (all eight). design.md v0.1 ACCEPTED in the same checkpoint._
