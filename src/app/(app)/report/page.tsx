import { prisma } from "@/server/db";
import { overview, budgetAnalytics, cashflow, investment, vendors } from "@/server/services/analytics";
import { formatMoney } from "@/lib/money";
import { PrintButton } from "./PrintButton";

// spec-023-v1: print/PDF report parity. Server component — figures come from
// the same analytics services as the dashboards, so values are byte-identical
// by construction. PDF via the browser's own print dialog (PrintButton).
// AuthN is enforced by middleware (page redirect to /login), as for all
// (app) pages; no session lookup needed here.

export const dynamic = "force-dynamic";

function aed(fils: bigint | string): string {
  return formatMoney(typeof fils === "bigint" ? fils : BigInt(fils));
}

export default async function ReportPage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string }>;
}) {
  const { project: codeParam } = await searchParams;
  const projects = await prisma.project.findMany({ orderBy: { id: "asc" }, select: { id: true, code: true, name: true, mainContractor: true, contractValueFils: true, status: true } });
  const project = codeParam ? projects.find((p) => p.code === codeParam) ?? projects[0] : projects[0];
  if (!project) {
    return <main className="p-8 text-sm text-zinc-500">No projects exist yet.</main>;
  }

  const [ov, budget, cf, inv, vend, flags, pcs] = await Promise.all([
    overview(project.id),
    budgetAnalytics(project.id),
    cashflow(project.id),
    investment(project.id),
    vendors(project.id),
    prisma.dataFlag.findMany({ where: { status: "OPEN" }, orderBy: [{ severity: "asc" }, { createdAt: "desc" }] }),
    prisma.paymentCertificate.findMany({ where: { projectId: project.id }, orderBy: { pcNumber: "asc" } }),
  ]);

  const generatedAt = new Date();
  const th = "px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-zinc-600 border-b border-zinc-300";
  const td = "px-3 py-1.5 text-[12px] border-b border-zinc-200 tabular-nums";

  return (
    <main className="mx-auto max-w-[900px] px-6 py-10 text-zinc-900 print:max-w-none print:p-0">
      {/* Cover */}
      <section className="mb-10 border-b-2 border-zinc-900 pb-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-700">ProCare · Trends Electro-Mechanical Works LLC</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight">{project.name}</h1>
            <p className="mt-1 text-sm text-zinc-600">
              Job {project.code} · Main contractor {project.mainContractor} · Status {project.status}
            </p>
            <p className="mt-1 text-sm text-zinc-600">Base subcontract value (excl. VAT): {aed(project.contractValueFils)}</p>
          </div>
          <div className="text-right text-xs text-zinc-500 print:text-[10px]">
            <p>Generated</p>
            <p>{generatedAt.toISOString().slice(0, 10)} {generatedAt.toISOString().slice(11, 16)} UTC</p>
          </div>
        </div>
        <div className="mt-4 flex gap-3 print:hidden">
          <PrintButton />
          <a href="/overview" className="rounded-lg border border-zinc-300 px-4 py-2 text-xs font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800">
            Back to dashboard
          </a>
        </div>
      </section>

      {/* Executive summary */}
      <section className="mb-10">
        <h2 className="mb-3 border-b border-zinc-300 pb-1 text-lg font-bold uppercase tracking-wide">Executive Summary</h2>
        <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm sm:grid-cols-3">
          {[
            ["Total committed", aed(ov.totalLpoFils)],
            ["Active LPOs", String(ov.activeCount)],
            ["Suppliers used", String(ov.supplierCount)],
            ["Certified to date", aed(cf.retentionTotalFils === undefined ? 0n : pcs.reduce((s, p) => s + p.netPayableFils, 0n))],
            ["Recovery rate", `${inv.recoveryRatePct.toFixed(1)}%`],
            ["Outstanding investment", aed(inv.outstandingFinalFils)],
            ["Retention held", aed(cf.retentionHeldFils)],
            ["Unapproved VO exposure", aed(cf.variationClaims.unapprovedVoExposureFils)],
            ["Open data flags", String(flags.length)],
          ].map(([label, value]) => (
            <div key={label}>
              <p className="text-[11px] uppercase tracking-wide text-zinc-500">{label}</p>
              <p className="font-semibold tabular-nums">{value}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Trade mix + Budget variance */}
      <section className="mb-10 overflow-hidden">
        <h2 className="mb-3 border-b border-zinc-300 pb-1 text-lg font-bold uppercase tracking-wide">Budget vs Actual by Trade</h2>
        <div className="overflow-x-auto">
        <table className="w-full min-w-[520px]">
          <thead>
            <tr>
              <th className={th}>Trade</th>
              <th className={th}>JCA budget</th>
              <th className={th}>Committed</th>
              <th className={th}>Utilization</th>
              <th className={th}>Status</th>
            </tr>
          </thead>
          <tbody>
            {budget.items.map((r) => (
              <tr key={r.trade}>
                <td className={td}>{r.trade.replace(/_/g, " ")}</td>
                <td className={td}>{r.budgetFils === 0n ? "—" : aed(r.budgetFils)}</td>
                <td className={td}>{aed(r.committedFils)}</td>
                <td className={td}>{r.utilizationPct.toFixed(2)}%</td>
                <td className={td}>{r.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {budget.excludedFils > 0n && (
          <p className="mt-2 text-[11px] italic text-zinc-500">
            Note: out-of-scope packages totalling {aed(budget.excludedFils)} are excluded from the committed column above.
          </p>
        )}
        </div>
      </section>

      {/* Payment certificates log */}
      <section className="mb-10 overflow-hidden">
        <h2 className="mb-3 border-b border-zinc-300 pb-1 text-lg font-bold uppercase tracking-wide">Payment Certificates</h2>
        <div className="overflow-x-auto">
        <table className="w-full min-w-[520px]">
          <thead>
            <tr>
              <th className={th}>PC</th>
              <th className={th}>Period</th>
              <th className={th}>Gross</th>
              <th className={th}>Retention</th>
              <th className={th}>Net payable</th>
              <th className={th}>Status</th>
            </tr>
          </thead>
          <tbody>
            {pcs.map((p) => (
              <tr key={String(p.id)}>
                <td className={td}>{String(p.pcNumber).padStart(2, "0")}</td>
                <td className={td}>{p.periodLabel}</td>
                <td className={td}>{aed(p.grossFils)}</td>
                <td className={td}>{p.retentionFils === 0n ? "—" : aed(p.retentionFils)}</td>
                <td className={td}>{aed(p.netPayableFils)}</td>
                <td className={td}>{p.status}</td>
              </tr>
            ))}
            <tr>
              <td className={`${td} font-bold`} colSpan={4}>Σ net certified</td>
              <td className={`${td} font-bold`} colSpan={2}>{aed(pcs.reduce((s, p) => s + p.netPayableFils, 0n))}</td>
            </tr>
          </tbody>
        </table>
        </div>
      </section>

      {/* Investment & recovery */}
      <section className="mb-10 overflow-hidden">
        <h2 className="mb-3 border-b border-zinc-300 pb-1 text-lg font-bold uppercase tracking-wide">Investment &amp; Recovery</h2>
        <div className="overflow-x-auto">
        <table className="w-full min-w-[520px]">
          <thead>
            <tr>
              <th className={th}>Month</th>
              <th className={th}>Committed</th>
              <th className={th}>Certified</th>
              <th className={th}>Cumulative outstanding</th>
            </tr>
          </thead>
          <tbody>
            {cf.monthly.map((m) => (
              <tr key={m.month}>
                <td className={td}>{m.month}</td>
                <td className={td}>{aed(m.committedFils)}</td>
                <td className={td}>{m.certifiedFils === 0n ? "—" : aed(m.certifiedFils)}</td>
                <td className={td}>{aed(m.outstandingFils)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </section>

      {/* Vendors concentration */}
      <section className="mb-10 overflow-hidden">
        <h2 className="mb-3 border-b border-zinc-300 pb-1 text-lg font-bold uppercase tracking-wide">Vendor Concentration</h2>
        <div className="overflow-x-auto">
        <table className="w-full min-w-[520px]">
          <thead>
            <tr>
              <th className={th}>Supplier</th>
              <th className={th}>Committed</th>
              <th className={th}>Share</th>
              <th className={th}>LPOs</th>
            </tr>
          </thead>
          <tbody>
            {vend.curve.slice(0, 12).map((v) => (
              <tr key={v.rank}>
                <td className={`${td} max-w-[24rem] truncate`}>{v.supplierName}</td>
                <td className={td}>{aed(v.fils)}</td>
                <td className={td}>{v.sharePct?.toFixed(2) ?? "—"}%</td>
                <td className={td}>{v.count}</td>
              </tr>
            ))}
            <tr>
              <td className={`${td} font-bold`} colSpan={2}>Top-8 concentration</td>
              <td className={`${td} font-bold`} colSpan={2}>{vend.top8SharePct.toFixed(2)}%</td>
            </tr>
          </tbody>
        </table>
        </div>
      </section>

      {/* Flags appendix */}
      <section className="mb-10">
        <h2 className="mb-3 border-b border-zinc-300 pb-1 text-lg font-bold uppercase tracking-wide">Appendix — Open Data Flags</h2>
        {flags.length === 0 ? (
          <p className="text-sm text-zinc-500">No open flags.</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {flags.map((f) => (
              <li key={String(f.id)} className="text-[12px]">
                <span className={`mr-2 inline-block w-14 rounded px-1 py-0.5 text-center text-[10px] font-bold ${f.severity === "HIGH" ? "bg-red-100 text-red-800" : f.severity === "MEDIUM" ? "bg-amber-100 text-amber-800" : "bg-sky-100 text-sky-800"}`}>
                  {f.severity}
                </span>
                <span className="font-mono text-[11px]">{f.ruleCode}</span> — {f.message}
              </li>
            ))}
          </ul>
        )}
      </section>

      <footer className="border-t border-zinc-300 pt-3 text-[10px] text-zinc-500">
        Generated server-side from the ProCare system of record — all totals computed at request time and reproducible from stored data.
      </footer>
    </main>
  );
}
