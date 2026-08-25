# spec-026-v1: Interactive drill-downs & downloads (Review Batch B)

**Status:** ACTIVE — promoted at G1 2026-08-25
**Version:** 1
**Depends On:** spec-014, spec-015, spec-018
**Blocks:** NONE
**Task Reference:** —

## What
Makes Overview/Procurement charts clickable (client: "when we click each box/item/graph it should open the relevant trade data in a pop-up, downloadable in PDF and Excel"). Pattern: Recharts `onClick` opens a right Drawer scoped to the clicked datum, reusing existing list APIs — no new endpoints. Drawers: (a) trade bar/donut segment → active LPOs of that trade (table: ref, supplier, amount, status; footer totals); (b) monthly-commitments area point → LPOs issued that month; (c) PC chart month → PCs of that periodLabel; (d) vendor Pareto bar → that supplier's LPOs; (e) KPI card click-through where a natural list exists (Flagged → /flags). Every drill-down drawer footer carries two actions: **Excel (CSV)** hitting the matching existing export endpoint with equivalent filters, and **PDF** triggering `window.print()` of a print-scoped drawer section (existing @media print layer). v1 ships CSV-as-Excel + browser-print PDF; native .xlsx generation is explicitly deferred (documented limitation — avoids a new server-side Office dependency).

## Acceptance Criteria
- Clicking any trade bar (or donut slice) opens a drawer titled with the trade, listing exactly the active LPOs counted for that bar (count matches analytics breakdown count), with working CSV download whose row count equals the drawer count.
- Clicking a month point on Monthly commitments opens LPOs with issueDate in that month; clicking a PC-chart month opens that period's certificates; clicking a vendor Pareto bar opens that supplier's LPOs.
- PDF action prints ONLY the drawer content (rest hidden by existing print CSS scope); CSV downloads carry the standard money formatting.
- Keyboard: drawers are Esc-closable (existing Drawer primitive); chart elements remain accessible via aria-label summaries.
- No new API routes; all drawers consume existing endpoints with query filters.

## Risks
Recharts click targets are per-element — donut slices need paddingAngle-aware hit areas (tested manually). Print scoping inside a Drawer overlay requires a body-class toggle during print; verify both light/dark modes.

## Rollback
Remove onClick handlers + drill-down components; endpoints untouched.
