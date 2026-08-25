"use client";

import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";
import { EmptyState, ErrorBanner, KpiCard } from "@/components/ui/primitives";
import { ChartFrame, ChartTooltip, CHART_COLORS } from "@/components/charts/themed";
import { DrillDownDrawer } from "@/components/charts/DrillDownDrawer";
import { useAnalytics, useProjectContext } from "@/hooks/use-app-data";

type Overview = {
  totalLpoFils: string;
  totalLpoExVatFils?: string;
  jcaBudgetFils?: string;
  activeCount: number;
  supplierCount: number;
  avgLpoFils: string;
  medianLpoFils: string;
  largestLpoFils: string;
  flaggedCount: number;
  tradeBreakdown: { trade: string; fils: string; count: number; pct: number }[];
  monthlySeries: { month: string; committedFils: string }[];
};

export function aed(fils: string): string {
  const n = BigInt(fils);
  return `AED ${(n / 100n).toLocaleString("en-US")}.${(n % 100n).toString().padStart(2, "0")}`;
}

function shortAed(fils: string): string {
  const v = Number(BigInt(fils)) / 100;
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
  return v.toFixed(0);
}

function labelForMonth(m: string): string {
  const [y, mo] = m.split("-");
  const names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${names[Number(mo) - 1]} ${y.slice(2)}`;
}

const DONUT_COLORS = ["#4f46e5", "#0891b2", "#059669", "#d97706", "#dc2626", "#7c3aed", "#a1a1aa"];

export function OverviewClient() {
  const { code, projects } = useProjectContext();
  const projectId = useMemo(() => projects.find((p) => p.code === code)?.id ?? null, [projects, code]);
  const { data, isLoading, error } = useAnalytics<Overview>("overview", projectId);
  const [donut, setDonut] = useState(false);
  const [drill, setDrill] = useState<{ title: string; endpoint: string; csvUrl?: string } | null>(null);

  function openTrade(trade: string) {
    if (!projectId) return;
    setDrill({
      title: `Trade — ${trade.replace(/_/g, " ")}`,
      endpoint: `/api/v1/projects/${projectId}/lpos?trade=${trade}&limit=200`,
      csvUrl: `/api/v1/projects/${projectId}/lpos/export?trade=${trade}`,
    });
  }
  function openMonth(month: string) {
    if (!projectId) return;
    const start = `${month}-01`;
    const [y, m] = month.split("-").map(Number);
    const end = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
    setDrill({
      title: `LPOs issued — ${month}`,
      endpoint: `/api/v1/projects/${projectId}/lpos?from=${start}T00:00:00Z&to=${end}T23:59:59Z&limit=200`,
      csvUrl: `/api/v1/projects/${projectId}/lpos/export?from=${start}T00:00:00Z&to=${end}T23:59:59Z`,
    });
  }

  if (error) return <ErrorBanner message="Could not load analytics." />;

  if (isLoading || !data) {
    return (
      <div className="mx-auto max-w-[1200px]" aria-busy="true">
        <div className="mb-4 h-8 w-40 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900" />
          ))}
        </div>
        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="h-72 animate-pulse rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900" />
          <div className="h-72 animate-pulse rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900" />
        </div>
      </div>
    );
  }

  const tradeData = [...data.tradeBreakdown].sort((a, b) => (BigInt(b.fils) > BigInt(a.fils) ? 1 : -1));
  const peak = data.monthlySeries.reduce((a, b) => (BigInt(b.committedFils) > BigInt(a.committedFils) ? b : a), data.monthlySeries[0]);
  const monthly = data.monthlySeries.map((m) => ({ ...m, label: labelForMonth(m.month), committed: Number(m.committedFils) / 100 }));

  return (
    <div className="mx-auto flex max-w-[1200px] flex-col gap-6 px-1 sm:px-0">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">ProCare{code ? ` · ${code}` : ""}</p>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-3xl">Overview</h1>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3 xl:grid-cols-6">
        <KpiCard label="Total LPO value" value={aed(data.totalLpoFils)} sub="active incl. VAT" />
        <KpiCard
          label="Total excl. VAT"
          value={data.totalLpoExVatFils ? aed(data.totalLpoExVatFils) : "—"}
          sub="Σ amount ÷ (1 + line VAT)"
        />
        <KpiCard label="Active LPOs" value={String(data.activeCount)} sub={`${data.supplierCount} suppliers used`} />
        <KpiCard label="Avg LPO" value={aed(data.avgLpoFils)} />
        <KpiCard label="Median LPO" value={aed(data.medianLpoFils)} />
        <KpiCard label="Largest LPO" value={aed(data.largestLpoFils)} />
      </div>

      {/* spec-025-v1: utilised / balance boxes */}
      {data.jcaBudgetFils && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <KpiCard
            label="Actual LPOs utilized"
            value={aed(data.totalLpoFils)}
            sub={`of JCA budget ${aed(data.jcaBudgetFils)}`}
          />
          {(() => {
            const balance = BigInt(data.jcaBudgetFils!) - BigInt(data.totalLpoFils);
            const over = balance < 0n;
            return (
              <KpiCard
                label={over ? "JCA overrun" : "Balance vs JCA"}
                value={aed((over ? -balance : balance).toString())}
                sub={over ? "committed exceeds JCA budget" : "JCA budget remaining"}
              />
            );
          })()}
        </div>
      )}

      {/* spec-025-v1: flagged-LPO explainer strip (client asked "What are Flagged LPOs?") */}
      {data.flaggedCount > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300">
          <span title="LPOs whose source documents have not been verified yet — seeded from the legacy report's NEED-TO-CHECK entries and any line you mark FLAGGED. They still count toward totals; verification confirms them against paperwork.">
            ⚠ {data.flaggedCount} LPO{data.flaggedCount === 1 ? "" : "s"} pending source verification.
          </span>
          <a href="/flags" className="text-xs font-semibold underline">Review in Data Flags →</a>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ChartFrame
          title="Spend by trade"
          unit="AED, active LPOs"
          ariaLabel={`Spend by trade. ${tradeData.map((t) => `${t.trade.replace(/_/g, " ")} ${shortAed(t.fils)} (${t.pct.toFixed(1)}%)`).join(", ")}.`}
        >
          <div className="mb-2 text-right">
            <button
              type="button"
              onClick={() => setDonut(!donut)}
              className="rounded-md border border-zinc-300 px-2 py-0.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300"
            >
              {donut ? "Show bars" : "Show donut"}
            </button>
          </div>
          <div role="img" aria-label={donut ? `Trade mix donut: ${tradeData.map((t) => `${t.trade} ${t.pct.toFixed(1)}%`).join(", ")}.` : "Trade spend bar chart. Click a bar for its LPOs."} className="w-full min-w-0">
            {donut ? (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart
                  onClick={(e) => {
                    const t = (e as { name?: string })?.name;
                    if (t) openTrade(t);
                  }}
                >
                  <Pie data={tradeData} dataKey="fils" nameKey="trade" innerRadius={55} outerRadius={100} paddingAngle={1} isAnimationActive={false} className="cursor-pointer">
                    {tradeData.map((t, i) => (
                      <Cell key={t.trade} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />
                    ))}
                  </Pie>
                  <ChartTooltip moneyKeys={["fils"]} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="w-full overflow-x-auto">
                <div className="min-w-[320px]">
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart
                      data={tradeData}
                      layout="vertical"
                      margin={{ left: 8, right: 48 }}
                      onClick={(e) => {
                        const t = (e as { activeLabel?: string })?.activeLabel;
                        if (t) openTrade(t.toUpperCase().replace(/ /g, "_"));
                      }}
                    >
                      <XAxis type="number" hide domain={[0, "dataMax"]} />
                      <YAxis type="category" dataKey="trade" width={90} tickLine={false} axisLine={false} fontSize={11} tickFormatter={(v: string) => v.replace(/_/g, " ")} className="cursor-pointer" />
                      <Bar dataKey="fils" name="Spend" fill={CHART_COLORS.bar} radius={[0, 4, 4, 0]} barSize={14} isAnimationActive={false} className="cursor-pointer"
                        label={{ position: "right", formatter: (v: unknown) => shortAed(String(v)), fontSize: 10, fill: "#71717a" }} />
                      <ChartTooltip moneyKeys={["fils"]} cursor={{ fill: "rgba(0,0,0,0.03)" }} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>
        </ChartFrame>

        <ChartFrame
          title="Monthly commitments"
          unit="AED by LPO issue date"
          ariaLabel={`Monthly commitments ${monthly[0]?.label ?? ""} to ${monthly.at(-1)?.label ?? ""}. Peak month ${peak ? labelForMonth(peak.month) : "n/a"} at ${shortAed(peak?.committedFils ?? "0")}.`}
        >
          <div className="w-full overflow-x-auto">
            <div className="min-w-[420px]">
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart
                  data={monthly}
                  margin={{ top: 4, right: 8, bottom: 0, left: 44 }}
                  onClick={(e) => {
                    const label = (e as { activeLabel?: string })?.activeLabel;
                    const hit = monthly.find((m) => m.label === label);
                    if (hit) openMonth(hit.month);
                  }}
                >
                  <CartesianGrid stroke="#e4e4e7" vertical={false} strokeOpacity={0.5} className="dark:opacity-20" />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={10} interval={1} />
                  <YAxis tickFormatter={(v: number) => shortAed(String(Math.round(v * 100)))} tickLine={false} axisLine={false} fontSize={10} width={52} />
                  <Area type="monotone" dataKey="committed" name="Committed" stroke={CHART_COLORS.committed} fill={CHART_COLORS.committed} fillOpacity={0.08} strokeWidth={2} isAnimationActive={false} />
                  <ChartTooltip moneyKeys={["committed"]} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </ChartFrame>
      </div>

      {drill && (
        <DrillDownDrawer<{ id: string; refNo: string; supplier: { name: string }; amountFils: string; status: string }>
          title={drill.title}
          endpoint={drill.endpoint}
          csvUrl={drill.csvUrl}
          sumKey="amountFils"
          columns={[
            { key: "refNo", label: "Ref" },
            { key: "supplier", label: "Supplier", render: (r) => r.supplier?.name ?? "—" },
            { key: "amountFils", label: "Amount", right: true, render: (r) => aed(r.amountFils) },
            { key: "status", label: "Status" },
          ]}
          onClose={() => setDrill(null)}
        />
      )}

      {data.flaggedCount === data.activeCount && data.activeCount > 0 && (
        <EmptyState
          title="Housekeeping: verification backlog"
          body="Every seeded LPO is imported from the legacy report and still awaits source verification — see the Data Flags tab."
        />
      )}
    </div>
  );
}
