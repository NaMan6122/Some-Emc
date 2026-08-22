# design.md — ProCare Platform UI Design Specification

**Status:** ACCEPTED — human sign-off 2026-08-23 (Gate G1 batch)
**Version:** 0.1
**Date:** 2026-08-23
**Depends on:** [PRD.md](./PRD.md) v0.1 (APPROVED), [TDD.md](./TDD.md) v0.1 (ACCEPTED)

> **Source-material rule (human directive, 2026-08-23):** the legacy HTML reports in this repository are business-requirements evidence only. This design is a **fresh, modern system**. No colors, markup, layout patterns, or visual language from those files carries over.

---

## 1. Design Principles

1. **Numbers first.** Financial data is the product. Chrome stays quiet; figures get tabular alignment, generous contrast, and room to breathe.
2. **Calm density.** Finance users want information-dense screens without visual noise: one accent color, hairline borders, no decorative gradients.
3. **Progressive disclosure.** Dashboards summarize; detail lives one click deeper in drawers/tables — never on the dashboard itself.
4. **Trust through transparency.** Provenance and verification states are always visible where money appears (badges), never hidden in tooltips alone.
5. **Fast to fake is worse than slow and true.** Optimistic UI only for non-financial fields; financial mutations show explicit pending state until server confirms.

## 2. Foundation Stack

| Concern | Choice |
|---|---|
| Styling | Tailwind CSS v4 with semantic tokens below (CSS variables) |
| Components | shadcn/ui (Radix primitives) — buttons, dialogs, dropdowns, forms |
| Tables | TanStack Table (headless) + shadcn table styling |
| Charts | Recharts, themed from tokens §4/§9 |
| Icons | lucide-react, 16px inline / 20px nav, stroke 1.5 |
| Fonts | Inter variable (UI) · JetBrains Mono or ui-monospace for refs/IDs |
| Forms | react-hook-form + zod resolvers (schemas shared with API) |

## 3. Layout & App Shell

```
┌──────────┬──────────────────────────────────────────────┐
│ Sidebar  │ Topbar: search ⌘K · period filter · flags ●3 │
│ 240px    ├──────────────────────────────────────────────┤
│ (64 rail)│  Page header: title + context + actions      │
│          │  Content column, max-w-[1440px], gutter 24   │
│ Project  │                                              │
│ switcher │                                              │
└──────────┴──────────────────────────────────────────────┘
```

- **Sidebar** (fixed): project switcher chip at top (`1571 · Mid Island Parkway 1C`); groups:
  - *Analytics:* Overview · Budget vs Actual · Payment Certificates · Investment · Vendors & LPO Log
  - *Governance:* Data Flags (badge = open count)
  - *Administration* (role-gated): Projects · Suppliers · Users · Audit Log
  - Collapses to icon rail < 1280px; off-canvas drawer < 768px.
- **Topbar** (sticky): global search opening command palette (P1), reporting-period selector scoped per page, flag-count indicator linking to queue, user menu (role shown).
- **Page pattern:** eyebrow label → H1 title → context line (project · period · provenance hint) → primary actions right-aligned → content grid.

## 4. Color Tokens

### Neutrals (zinc-based)

| Token | Light | Dark | Use |
|---|---|---|---|
| `bg` | `#FAFAFA` | `#09090B` | App background |
| `surface` | `#FFFFFF` | `#18181B` | Cards, tables, sheets |
| `surface-2` | `#F4F4F5` | `#27272A` | Table headers, hover fills |
| `border` | `#E4E4E7` | `#27272A` | Hairlines, dividers |
| `text-primary` | `#18181B` | `#FAFAFA` | Headings, key figures |
| `text-secondary` | `#52525B` | `#A1A1AA` | Body, labels |
| `text-muted` | `#A1A1AA` | `#71717A` | Captions, placeholders |

### Accent & semantic

| Token | Value | Use |
|---|---|---|
| `accent` | Indigo `#4F46E5` (dark `#818CF8`) | Primary actions, active nav, focus ring, links |
| `success` | Emerald `#05966F` | Under budget, VERIFIED, APPROVED, PAID |
| `warning` | Amber `#D97706` | ≥90% utilization, PENDING, near-limit alerts |
| `danger` | Red `#DC2626` | Over budget, FLAGGED, failed validation |
| `info` | Sky `#0284C7` | Neutral notices, DERIVED provenance |

### Categorical trade palette (data-only, never UI chrome)

| Trade | Hue |
|---|---|
| Electrical | Blue `#2563EB` |
| Plumbing | Teal `#0D9488` |
| HVAC | Violet `#7C3AED` |
| Fire Fighting | Rose `#E11D48` |
| General | Amber `#B45309` |
| HSE | Pink `#DB2777` |
| Other/Internal | Slate `#64748B` |

Charts may lighten/darken these ±10% for series separation; never reuse accent indigo for data.

## 5. Typography

| Style | Spec |
|---|---|
| Display (page title) | Inter 24px/32px semibold `-0.01em` |
| Section title | 16px/24px semibold |
| KPI value | 28px/34px semibold, `font-variant-numeric: tabular-nums` |
| Body | 14px/20px regular |
| Caption/label | 12px/16px medium, letter-spacing `.02em`, often uppercase for labels |
| Mono | Refs (`TEMW/REF/LPO//039`), IDs, file names — 13px |

Money formatting: `AED 3,832,500.00` via `Intl.NumberFormat('en-AE')`; negative values use minus sign + danger color in tables, parentheses in reports.

## 6. Space, Radius, Elevation

- Base grid 4px. Card padding 16–20px. Page gutter 24px. Vertical rhythm between cards 12–16px.
- Radius: cards/sheets 12px · controls/inputs 8px · pills/badges 999px.
- Elevation: flat cards with `border` by default; `shadow-sm` on hover-lift lists; `shadow-lg` reserved for overlays (dialogs, command palette, drawers).
- Focus: 2px `accent` ring, 2px offset — visible on every interactive element.

## 7. Status Language

Single source of status visuals — one `<StatusPill>` component maps every enum:

| Domain | States → treatment |
|---|---|
| LPO status | DRAFT gray outline · ISSUED blue tint · CLOSED emerald tint · CANCELLED gray strike-through text |
| Verification | VERIFIED emerald dot · PENDING amber dot · FLAGGED rose dot + count badge |
| PC status | DRAFT gray · SUBMITTED amber · CERTIFIED blue · PAID emerald |
| VO status | DRAFT gray · SUBMITTED amber · APPROVED emerald · REJECTED rose |
| Provenance | caption chip: SOURCE (neutral) · OCR EST (warning) · CLIENT SUMMARY (info) · DERIVED (info outline) · IMPORTED (neutral outline) |
| Budget health | Under (<90%) success · Watch (90–100%) warning · Over (>100%) danger — pill + delta amount |

Rules: dot/tint + text label always (never color-only); statuses are tints (`bg 10%` of hue + darker text), not saturated fills.

## 8. Component Inventory & Behavior

**KPI Card** — uppercase 11px label · big tabular figure · sub-line (context/delta). Optional sparkline slot. Whole card clickable → drill-down (P1).

**Stat Delta** — `▲/▼ +1.2M vs last month` using success/danger semantics relative to what "good" means per metric (recovery up = good; spend up ≠ automatically bad).

**Data Table** — sticky header, zebra-free rows with `surface-2` hover, row height 40px, first column frozen on horizontal scroll, right-aligned numerics with tabular-nums, sortable headers (aria-sort), cursor pagination footer ("Load more"), column visibility menu, CSV export button top-right.

**Filter Bar** — segmented trade chips (categorical palette dots), free-text search (debounced 300ms, searches supplier/material/ref), date-range picker, status multi-select, clear-all affordance; active filter count badge.

**Detail Drawer** — right sheet 480px for record inspection (LPO revision chain timeline, PC provenance history); primary actions inside drawer footer; Esc/backdrop closes with unsaved-changes guard.

**Forms** — inline validation on blur, submit-time server errors mapped field-wise; money inputs accept `1234.5` or `1,234.50`, show formatted preview; destructive actions require typed confirmation for financial records (type ref number).

**Flags Queue** — severity dot + rule code mono chip + entity link + age; resolve flow opens drawer with fix action contextual to entity; WONT_FIX demands reason text.

**Command Palette (⌘K, P1)** — jump-to-page, recent LPOs/PCs, quick actions by role.

**States** — skeletons mirror final layout (no spinners for >200ms waits); empty states: one sentence + single primary action ("Add your first LPO"); error banners inline with retry; toast bottom-right for background outcomes, never blocking financial confirmations (use dialog result instead).

## 9. Data Visualization Standards

| Question | Chart |
|---|---|
| Composition by trade | Horizontal bar (sorted desc, values labeled) — pie only as optional donut toggle |
| Trend over months | Line/area, month axis `MMM YY`, dashed cumulative overlay on secondary implicit scale |
| Investment vs recovery | Paired bars monthly + cumulative gap area beneath |
| Concentration | Pareto bar: supplier bars + cumulative % line |

Chart rules: gridlines horizontal-only `border` color at 50%; no vertical grids; tooltips dark surface, fils-exact values + human format; legends only when >1 series; every chart has accessible summary table toggle (P1) and title + unit in caption.

## 10. Accessibility

- WCAG 2.1 AA: all text pairs listed above meet contrast in both modes; verify data-palette pairs against white/black when used behind labels.
- Keyboard-complete: table rows focusable, `Enter` opens drawer, filters trap focus properly; visible focus everywhere.
- Screen reader: status pills announce state text; charts get `aria-label` summaries; async saves announced via `aria-live=polite`.
- RTL-ready: logical CSS properties only (`ps/pe`, `ms/me`); layout must survive `dir="rtl"` flip (OQ-2 pending, cheap insurance now).

## 11. Responsive Strategy

| Breakpoint | Layout |
|---|---|
| ≥1280 | Full sidebar, 4-col KPI rows, side-by-side chart panels |
| 1024–1279 | Icon-rail sidebar, 2×2 KPIs |
| 768–1023 | Off-canvas nav, stacked panels, tables scroll horizontally |
| <768 | Mobile usable read-first: dashboards render, editing deferred to desktop (toast hint) |

Tables on small screens: freeze key columns (ref, supplier, amount), hide secondary columns via priority classes rather than shrinking type.

## 12. Motion

Duration 150ms (micro) / 250ms (overlays), easing `ease-out`; drawer/dialog fade+scale 98→100%; skeleton shimmer subtle (opacity pulse); no parallax, no bounce. `prefers-reduced-motion` disables transforms.

## 13. Explicit Non-Goals / Anti-Patterns

- No replication of legacy HTML report styling, structure, or its Chart.js look.
- No decorative gradients, glassmorphism, oversized drop shadows, or emoji as UI icons.
- No client-computed financial aggregates (server values only — TDD principle 2).
- No hidden provenance: if a number is derived/estimated, the surface showing it says so.
- No custom widgets where Radix/shadcn exists (date pickers, selects, popovers).

---

**Review note:** frontend atomic specs (M1 shell/components, M2 dashboard pages) will reference this document section-by-section once it's accepted.
