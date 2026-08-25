# spec-027-v1: Payment cycle analytics (Review Batch C)

**Status:** DRAFT
**Version:** 1
**Depends On:** spec-002, spec-004, spec-012, spec-015
**Blocks:** NONE
**Task Reference:** —

## What
Adds the payment-cycle measurement the client asked for. Migration extends PaymentCertificate with three nullable dates: `applicationDate` (submission), `dueDate` (payment due), `paymentReceivedDate` (money received). Admin PC form gains the three date inputs; CSV import/export include them. Cashflow analytics gains an additive `paymentCycle` object: `avgApplicationToCertifiedDays`, `avgDueToReceivedDays`, `avgDelayDays` (received − due, positive = late; averaged over PCs having both dates), and `receivedByMonth: [{month, amountFils, pctOfCertified}]` (% of cumulative certified received in that calendar month of paymentReceivedDate). PC dashboard replaces nothing existing but ADDS two bar charts — "Submission → Certificate (days)" and "Due → Received (days)" per PC — plus KPI "Average payment delay (days)" and a "Received through <month> · X%" line. Per client, the Overview tab's "Monthly commitments" area chart is REMOVED (its data remains available on the PC tab); the removed slot is left empty pending Batch D's expenses graph. All day-counts are null-safe (PCs without the dates are excluded from that metric only).

## Acceptance Criteria
- Migration applies; seed rerun idempotent; existing PC rows keep null dates without breaking any current test or golden anchor.
- PATCH /pcs/:id accepts the three date fields (ISO date, nullish); admin UI saves and displays them.
- With fixture PCs carrying application→certified gaps of 10/20/30 days, `avgApplicationToCertifiedDays === 20`; equivalent assertion for due→received delay (one negative value included to prove signed averaging).
- `receivedByMonth` sums only PCs with paymentReceivedDate, month-keyed by that date, pct relative to Σ certified net in window; KPI card renders "Average payment delay" with N-day figure.
- Overview no longer renders the Monthly-commitments ChartFrame; PC dashboard renders the two new charts + delay KPI; VIEWER sees all read-only.
- Non-admin roles cannot mutate PCs (existing FINANCE+ADMIN gate unchanged); malformed dates → 422.

## Risks
Legacy PCs lack these dates — metrics appear only as data is entered (documented; client enters going forward). Signed averages can look odd until ≥3 samples; tooltips show sample count.

## Rollback
Down-migration drops three columns; remove charts/KPI/service block; import/export mapping reverts.
