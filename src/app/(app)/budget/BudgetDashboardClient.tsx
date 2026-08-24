"use client";

import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, XAxis, YAxis } from "recharts";
import { EmptyState, ErrorBanner } from "@/components/ui/primitives";
import { ChartFrame, ChartTooltip, CHART_COLORS } from "@/components/charts/themed";
import { useAnalytics, useProjectContext } from "@/hooks/use-app-data";

type BudgetRow = {
  trade: string;
  budgetFils: string;
  committedFils: string;
  utilizationPct: number;
  status: "under" | "watch" | "over" | "no_budget" | "no_spend";
};

const STATUS_PILL: Record<BudgetRow["status"], { label: string; cls: string }> = {
  under: { label: "Under", cls: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" },
  watch: { label: "Watch", cls: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300" },
  over: { label: "Over", cls: "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300" },
  no_budget: { label: "No JCA line", cls: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300" },
  no_spend: { label: "No spend", cls: "bg-zinc-100 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-500" },
};

function aed(fils: string): string {
  const n = BigInt(fils);
  return `AED ${(n / 100n).toLocaleString("en-US")}.${(n % 100n).toString().padStart(2, "0")}`;
}

export function BudgetDashboardClient() {
  const { code, projects } = useProjectContext();
  const projectId = useMemo(() => projects.find((p) => p.code === code)?.id ?? null, [projects, code]);
  const { data, isLoading, error } = useAnalytics<{ items: BudgetRow[]; excludedRefs: string[]; excludedFils: string }>("budget", projectId);

  if (error) return <ErrorBanner message="Could not load budget analytics." />;

  if (isLoading || !data) {
    return (
      <div className="mx-auto max-w-[1200px]" aria-busy="true">
        <div className="mb-4 h-8 w-56 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
        <div className="h-64 animate-pulse rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900" />
      </div>
    );
  }

  const gaps = data.items.filter((r) => r.status === "no_budget");
  const chartData = data.items
    .filter((r) => r.status !== "no_spend")
    .map((r) => ({
      trade: r.trade.replace(/_/g, " "),
      budget: Number(r.budgetFils) / 100,
      committed: Number(r.committedFils) / 100,
    }));

  return (
    <div className="mx-auto flex max-w-[1200px] flex-col gap-6 px-1 sm:px-0">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Analytics{code ? ` · ${code}` : ""}</p>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-3xl">Budget vs Actual</h1>
          {projectId && (
            <span className="flex flex-wrap gap-2">
              <a
                href={`/api/v1/projects/${projectId}/export/variance.csv`}
                className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                Variance CSV
              </a>
              <a
                href={`/api/v1/projects/${projectId}/export/budget-lines.csv`}
                className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                JCA lines CSV
              </a>
            </span>
          )}
        </div>
        <p className="mt-0.5 text-sm text-zinc-500">
          Committed vs JCA lines per trade. Storm-water package (AED {(Number(data.excludedFils) / 100).toLocaleString("en-US")}) sits outside the JCA and is excluded here.
        </p>
      </div>

      <ChartFrame
        title="Budget vs committed"
        unit="AED"
        ariaLabel={`Grouped bars of budget versus committed per trade. ${data.items.map((r) => `${r.trade}: budget ${aed(r.budgetFils)}, committed ${aed(r.committedFils)} (${r.utilizationPct.toFixed(1)}%)`).join("; ")}.`}
      >
        <div className="w-full overflow-x-auto">
          <div className="min-w-[480px]">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData} margin={{ top: 4, right: 8, left: 48 }}>
                <CartesianGrid stroke="#e4e4e7" vertical={false} strokeOpacity={0.5} className="dark:opacity-20" />
                <XAxis dataKey="trade" tickLine={false} axisLine={false} fontSize={10} />
                <YAxis tickLine={false} axisLine={false} fontSize={10} width={52}
                  tickFormatter={(v: number) => `${v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M` : v >= 1000 ? `${Math.round(v / 1000)}K` : v}`} />
                <Bar dataKey="budget" name="JCA budget" fill={CHART_COLORS.cumulative} radius={[3, 3, 0, 0]} barSize={18} isAnimationActive={false} />
                <Bar dataKey="committed" name="Committed" fill={CHART_COLORS.committed} radius={[3, 3, 0, 0]} barSize={18} isAnimationActive={false} />
                <ChartTooltip moneyKeys={["budget", "committed"]} cursor={{ fill: "rgba(0,0,0,0.03)" }} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </ChartFrame>

      {gaps.length > 0 && (
        <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300">
          <span className="font-semibold">Coverage gap:</span>{" "}
          {gaps.map((g) => `${g.trade.replace(/_/g, " ")} — ${aed(g.committedFils)} committed with no JCA line`).join(" · ")}
        </div>
      )}

      <section className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="overflow-x-auto">
        {data.items.length === 0 ? (
          <div className="p-4"><EmptyState title="No budget data" body="Add JCA lines under Administration → Projects → Budget." /></div>
        ) : (
          <table className="w-full min-w-[560px] text-sm">
            <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-800/60">
              <tr>
                <th className="px-4 py-3">Trade</th>
                <th className="px-4 py-3 text-right">Budget</th>
                <th className="px-4 py-3 text-right">Committed</th>
                <th className="px-4 py-3">Utilization</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((r) => (
                <tr key={r.trade} className="border-t border-zinc-100 hover:bg-zinc-50 dark:border-zinc-800">
                  <td className="px-4 py-2.5 font-medium text-zinc-900 dark:text-zinc-100">{r.trade.replace(/_/g, " ")}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-zinc-900 dark:text-zinc-100">{r.budgetFils === "0" ? "—" : aed(r.budgetFils)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-zinc-900 dark:text-zinc-100">{aed(r.committedFils)}</td>
                  <td className="w-48 px-4 py-2.5 tabular-nums">
                    {r.status === "no_budget" || r.status === "no_spend" ? (
                      <span className="text-zinc-400">—</span>
                    ) : (
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                          <div
                            className={`h-full rounded-full ${r.utilizationPct > 100 ? "bg-red-500" : r.utilizationPct >= 90 ? "bg-amber-500" : "bg-emerald-500"}`}
                            style={{ width: `${Math.min(r.utilizationPct, 130) / 1.3}%` }}
                          />
                        </div>
                        <span className="w-14 text-right text-xs font-medium">{r.utilizationPct.toFixed(1)}%</span>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_PILL[r.status].cls}`}>
                      {STATUS_PILL[r.status].label}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        </div>
      </section>
    </div>
  );
}
