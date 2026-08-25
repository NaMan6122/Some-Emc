# spec-025-v1: Budget corrections, VAT-net KPI, utilised/balance boxes (Review Batch A)

**Status:** DRAFT
**Version:** 1
**Depends On:** spec-002, spec-008, spec-011, spec-014
**Blocks:** NONE
**Task Reference:** —

## What
Implements the client review's factual corrections. (1) JCA additions per client: BudgetLine `FIRE_FIGHTING` **AED 1,440,000.00** (Fire Fighting/Fire Alarm/Emergency Lighting/LHD, sourceLabel "JCA Appendix – Fire Fighting & FLS") and `OTHER` **AED 3,600,000.00** ("JCA Appendix – Storm Water Pumping Station"); General/HSE/Others figures are AWAITED from client — deliberately NOT created, their NO_BUDGET_LINE flags stay open until then (documented). (2) The SWPS exclusion lens (`EXCLUDED_REFS`) is REMOVED from budget analytics — client confirms SWPS sits inside JCA utilisation. This invalidates spec-014's excl-SWPS golden anchors → DCL-007 files the anchor recomputation and spec-014 tests are updated to inclusive-lens values read from the live dataset. (3) Overview gains KPI **Total LPO value excl. VAT** (`Σ(amountFils ÷ (1+vatRate))`, BigInt-rounded) plus an info tooltip on "Pending verification" explaining flagged semantics and linking to /flags. (4) Three new Overview boxes per client: **Actual LPOs Utilized** (= committed total, current definition), **Balance vs JCA** (= Σ budget lines − committed, floored at 0 displayed, negative shown in red as overrun), and **Procurement Schedule** box linking to a new schedule table on the Vendors tab driven by two new nullable Lpo columns `indentDate`, `deliveryDate` (editable via PATCH, shown in drawer, included in CSV import/export). ASSUMPTION recorded: "utilized" = committed-to-date; refine when client confirms delivery-based semantics.

## Acceptance Criteria
- Migration adds Lpo.indentDate/deliveryDate; seed idempotent; migrate status clean.
- BudgetLines FF=144000000 (FIRE_FIGHTING) and SWPS=360000000 (OTHER) exist post-seed with stated sourceLabels; rerun adds nothing.
- GET /variance: FIRE_FIGHTING shows budget 1,440,000.00 and status per utilisation (committed 1,583,925 → over ~110%); SWPS committed appears inside OTHER; NO_BUDGET_LINE flags remain only for GENERAL/HSE/OTHER-sub-trades lacking figures.
- Overview JSON gains `totalLpoExVatFils` (>0, ≤ totalLpoFils) and UI shows the new three boxes + flagged tooltip linking to /flags.
- PATCH /lpos/:id accepts indentDate/deliveryDate (ISO date, nullish); both appear in lpos export CSV headers and bulk-import mapping (optional columns).
- Integration suite updated: excl-SWPS assertions replaced by inclusive-lens values asserted against live dataset (documented in DCL-007).

## Risks
Golden-anchor churn across spec-014 tests (mitigated: DCL-007 + recompute-from-dataset assertions). SWPS budget placed under OTHER is an assumption until client confirms its trade split. Gen/HSE/Others figures outstanding — flags intentionally stay visible.

## Rollback
Down-migration drops the two date columns; delete added BudgetLine rows by sourceLabel; restore exclusion lens + prior test anchors via git revert of the touched files.
