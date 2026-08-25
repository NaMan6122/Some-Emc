# spec-028-v1: Cost overviews — Labour, Supervision, Admin, DLP (Review Batch D)

**Status:** DRAFT
**Version:** 1
**Depends On:** spec-002, spec-004, spec-014
**Blocks:** NONE
**Task Reference:** —

## What
Turns ProCare into the client's full cost-control suite with ONE reusable module covering four requested overviews: **Labour Management** (in-house manpower + subcontractors), **Supervision Cost** (Site & HO support + Staff Related Costs), **Admin Cost** (vehicle/store/porta-cabin/furniture/logistics/internet/CCTV/container/HSE/AC/fuel/transport/office/accommodation/bank charges/interest/finance cost/insurance…), **DLP Cost**. Migration adds enum `CostCategory { LABOUR_INHOUSE, LABOUR_SUBCONTRACT, SUPERVISION, ADMIN, DLP }` plus two project-scoped models: `CostLine { projectId, category, amountFils, sourceLabel }` (the JCA-side budget) and `CostEntry { projectId, category, entryDate, amountFils, description?, sourceLabel? }` (actuals booked monthly). New page `/costs?category=X` (sidebar group "Cost Control": Labour · Supervision · Admin · DLP) renders a shared component per category: KPI cards (Budget / Actual / Variance / Utilisation%) + JCA-vs-Actual grouped bars + **monthly actuals-booked series** (this also fulfils the client's "monthly expenses booked" graph) + entry table w/ add form. APIs: `GET|POST /projects/:id/cost-lines?category=`, `GET|POST /projects/:id/cost-entries?category=`, `DELETE /cost-lines/:id | /cost-entries/:id` — budget writes ADMIN+COMMERCIAL, entry writes ADMIN+FINANCE, reads any authenticated; all mutations audited; moneyString discipline throughout. This module is generic — future categories are one enum value away.

## Acceptance Criteria
- Migration applies; both tables project-scoped with Restrict FKs; seed idempotent.
- COMMERCIAL creates a Labour budget line AED 250,000 → 201 + audit; FINANCE books two entries (Jan 40k, Feb 65k) → overview shows Actual 105,000, Variance −145,000, Utilisation 42.0%, monthly bars for Jan/Feb only.
- Category isolation: entries under ADMIN never appear in Labour overview (query filtered by category).
- VIEWER read-only everywhere; PROCUREMENT blocked from cost-entry POST (403); malformed money/date → 422.
- DELETE removes line/entry with audit row; figures revert immediately.
- Sidebar group renders four links; each route deep-links via ?category= and 404s unknown categories.

## Risks
Category granularity inside ADMIN (vehicle vs insurance…) is free-text description v1 — if client later wants fixed sub-categories, that is one more enum/column. Monthly "expenses booked" currently means manually entered actuals; auto-feed from invoices is explicitly out of scope until an AP module exists.

## Rollback
Down-migration drops enum + two tables; remove page/routes/tests/sidebar group.
