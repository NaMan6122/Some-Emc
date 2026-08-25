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
| spec-012 | Payment certificates module | v2 | IMPLEMENTED | spec-004, spec-005 | T-019 DONE | AC1 Σ-net figure corrected per DCL-004 (10,331,978.00 AED row-sum); v2 ratified per standing instruction at M3 G1 entry 2026-08-24 |
| spec-013 | Variation orders module | v1 | IMPLEMENTED | spec-004, spec-005, spec-007 | T-020 DONE | Exposure attribution project-level aggregate per Risks limitation; UNAPPROVED_VO_CLAIM flag wired |
| spec-014 | Analytics engine & endpoints | v2 | IMPLEMENTED | spec-007, spec-011, spec-012, spec-013 | T-021 DONE | Golden anchors reproduce at DB-exact precision; v2 ratified per standing instruction at M3 G1 entry 2026-08-24 (DCL-005a/b/c) |
| spec-015 | Dashboard screens (six tabs) | v1 | IMPLEMENTED | spec-009, spec-010, spec-014 | T-022 DONE | Recharts dashboards live; flags read-only feed (FR-9 triage M3) |
| spec-016 | Flag triage workflow (FR-9 management) | v1 | IMPLEMENTED | spec-003, spec-004, spec-015 | T-024 DONE | Promoted at G1 2026-08-24; domain map Lpo/Supplier→PROC, BudgetLine/VO→COMM, PC→FIN, Project→all; queue UI live |
| spec-017 | Data-quality rules engine (project scan) | v1 | IMPLEMENTED | spec-006, spec-007, spec-011, spec-016 | T-025 DONE | Promoted at G1 2026-08-24; scan opens 4 NO_BUDGET_LINE + 14 DUPLICATE_SUPPLIER_SUSPECT on seeded data — all genuine |
| spec-018 | CSV exports (FR-10 P1 subset) | v1 | IMPLEMENTED | spec-007, spec-011, spec-012, spec-013, spec-004 | T-026 DONE | Promoted at G1 2026-08-24; seven exporters via shared src/lib/csv.ts; variance CSV documents v1 basis in changelog (meta column skipped) |
| spec-019 | Retention ledger & releases (OQ-7 / FR-6 P1) | v1 | IMPLEMENTED | spec-002, spec-004, spec-014, spec-015 | T-027 DONE | Promoted at G1 2026-08-24; OQ-7 closed same gate; cashflow anchors byte-identical with additive held/released fields |
| spec-020 | Supplier merge UI (FR-3 P1) | v1 | IMPLEMENTED | spec-006, spec-009 | T-029 DONE | Promoted at G1 2026-08-24; browser-verified incl. inline guard errors; additive _count on suppliers list documented |
| spec-021 | Bulk LPO CSV import (FR-4 P1) | v1 | IMPLEMENTED | spec-005, spec-007 | T-030 DONE | Promoted at G1 2026-08-24; dry-run + all-or-nothing commit; exposed latent ref-allocator bug → DCL-006 collision-aware allocation |
| spec-022 | Cross-project LPO allocations ("50% ONLY") | v1 | IMPLEMENTED | spec-002, spec-004, spec-005, spec-007, spec-014 | T-032 DONE | Promoted at G1 2026-08-24; Σ≤100 enforced; additive overview KPIs; drawer panel |
| spec-023 | Print/PDF report parity (FR-10) | v1 | IMPLEMENTED | spec-014, spec-015 | T-033 DONE | Promoted at G1 2026-08-24; /report server-rendered from analytics services; print CSS verified via emulation |
| spec-024 | User administration (admin batch closure) | v1 | IMPLEMENTED | spec-003, spec-004, spec-016 | T-035 DONE | Promoted at G1 2026-08-24; active-flag migration, guardrails, one-time passwords, full UI |
| spec-025 | Budget corrections, VAT-net KPI, utilised/balance boxes (Review A) | v1 | DRAFT | spec-002, spec-008, spec-011, spec-014 | — | Client-review batch; pending G1. Gen/HSE/Others figures awaited from client |
| spec-026 | Interactive drill-downs & downloads (Review B) | v1 | DRAFT | spec-014, spec-015, spec-018 | — | Client-review batch; pending G1. XLSX deferred → CSV+print PDF |
| spec-027 | Payment cycle analytics (Review C) | v1 | DRAFT | spec-002, spec-004, spec-012, spec-015 | — | Client-review batch; pending G1 |
| spec-028 | Cost overviews: Labour/Supervision/Admin/DLP (Review D) | v1 | DRAFT | spec-002, spec-004, spec-014 | — | Client-review batch; pending G1 |

_M1 (spec-001..008): all IMPLEMENTED — milestone ratified at G5 2026-08-23. M2 batch (009–015): all IMPLEMENTED. M3 batch (016–019): all IMPLEMENTED — ratified at G5 2026-08-24._

_M4 batch (spec-020..023) promoted ACTIVE at Gate G1 on 2026-08-24 ("Promote all 4") — implementation order 020→021→022→023._

_Promoted DRAFT → ACTIVE by human at Gate G1 on 2026-08-23 (all eight). design.md v0.1 ACCEPTED in the same checkpoint._
