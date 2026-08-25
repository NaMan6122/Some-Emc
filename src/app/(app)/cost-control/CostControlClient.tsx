"use client";

import { useMemo } from "react";
import { KpiCard, ErrorBanner } from "@/components/ui/primitives";
import { useAnalytics, useProjectContext } from "@/hooks/use-app-data";

// spec-030-v1: Cost Control tab — budget → committed → actual → forecast →
// margin waterfall. Read-only derived analytics; no data entry here.

type Costs = {
  contractValueFils: string;
  originalBudgetFils: string;
  committedFils: string;
  actualCostFils: string;
  openCommitmentsFils: string;
  costToCompleteFils: string;
  forecastFinalFils: string;
  profitFils: bigint | string;
  marginPct: number | null;
  actualsByCategory: { category: string; fils: string }[];
};

function aed(fils: string): string {
  const n = BigInt(fils);
  const neg = n < 0n;
  const abs = neg ? -n : n;
  return `${neg ? "-" : ""}AED ${(abs / 100n).toLocaleString("en-US")}.${(abs % 100n).toString().padStart(2, "0")}`;
}

export function CostControlClient() {
  const { code, projects } = useProjectContext();
  const projectId = useMemo(() => projects.find((p) => p.code === code)?.id ?? null, [projects, code]);
  const { data, isLoading, error } = useAnalytics<Costs>("costs", projectId);

  if (error) return <ErrorBanner message="Could not load cost analytics." />;

  if (isLoading || !data) {
    return (
      <div className="mx-auto max-w-[1200px]" aria-busy="true">
        <div className="mb-4 h-8 w-48 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900" />
          ))}
        </div>
      </div>
    );
  }

  const marginNeg = data.marginPct != null && data.marginPct < 0;
  const profitStr = String(data.profitFils);
  const profitNeg = profitStr.startsWith("-");
  const profitAbs = aed(profitNeg ? profitStr.slice(1) : profitStr);

  return (
    <div className="mx-auto flex max-w-[1200px] flex-col gap-6 px-1 sm:px-0">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Cost Control{code ? ` · ${code}` : ""}</p>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-3xl">Project Cost &amp; Forecast</h1>
        <p className="mt-0.5 text-sm text-zinc-500">
          Derived analytics — definitions pinned in spec-030. Forecast = actuals + open commitments + estimated remainder.
        </p>
      </div>

      {/* Waterfall */}
      <section className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <table className="w-full min-w-[520px] text-sm">
          <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-800/60">
            <tr>
              <th className="px-4 py-3">Stage</th>
              <th className="px-4 py-3 text-right">Amount</th>
              <th className="px-4 py-3">Meaning</th>
            </tr>
          </thead>
          <tbody>
            {[
              ["Contract value", aed(data.contractValueFils), "base subcontract (excl. VAT)", false],
              ["Original budget", aed(data.originalBudgetFils), "JCA + cost-control lines", false],
              ["Committed", aed(data.committedFils), "active LPOs", false],
              ["Actual cost", aed(data.actualCostFils), "invoices + payments booked", false],
              ["Open commitments", aed(data.openCommitmentsFils), "committed not yet invoiced", false],
              ["Cost to complete", aed(data.costToCompleteFils), "estimated remainder", false],
              ["Forecast final", aed(data.forecastFinalFils), "actual + remaining", true],
              ["Profit vs contract", `${profitNeg ? "-" : ""}${profitAbs}`, marginNeg ? "projected loss" : "projected profit", true],
            ].map(([label, value, meaning, strong]) => (
              <tr key={String(label)} className={`border-t border-zinc-100 dark:border-zinc-800 ${strong ? "bg-zinc-50 font-semibold dark:bg-zinc-800/60" : ""}`}>
                <td className={`px-4 py-2.5 ${strong ? "text-zinc-900 dark:text-zinc-100" : "text-zinc-700 dark:text-zinc-300"}`}>{label}</td>
              <td className={`px-4 py-2.5 text-right tabular-nums ${strong ? "text-zinc-900 dark:text-zinc-100" : "text-zinc-700 dark:text-zinc-300"}`}>{value}</td>
              <td className="px-4 py-2.5 text-xs text-zinc-500">{meaning}</td>
            </tr>
          ))}
          <tr className="border-t border-zinc-100 dark:border-zinc-800">
            <td className={`px-4 py-2.5 ${marginNeg ? "text-red-600 dark:text-red-400" : "text-emerald-700 dark:text-emerald-400"} font-semibold`} colSpan={3}>
              {marginNeg ? "⚠ Forecast exceeds contract value — projected loss" : "Projected profit margin on forecast final cost"}
            </td>
          </tr>
          </tbody>
        </table>
      </section>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <KpiCard
          label="Profit margin"
          value={data.marginPct != null ? `${data.marginPct.toFixed(2)}%` : "—"}
          sub={marginNeg ? "forecast exceeds contract value" : "on forecast final cost"}
        />
        <KpiCard label="Cost to complete" value={aed(data.costToCompleteFils)} sub="budget not yet committed or spent" />
      </div>

      {/* Actuals by category */}
      <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Actual costs by category</h2>
        {(data.actualsByCategory.length ?? 0) === 0 ? (
          <p className="mt-2 text-sm text-zinc-500">No costs booked yet — entries appear as finance books them.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {data.actualsByCategory.map(({ category, fils }) => (
              <li key={category} className="flex items-center justify-between rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800">
                <span className="font-medium">{category.replace(/_/g, " ")}</span>
                <span className="tabular-nums">{aed(fils)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
