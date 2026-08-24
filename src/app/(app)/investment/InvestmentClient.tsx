"use client";

import { useMemo } from "react";
import { Area, Bar, BarChart, CartesianGrid, ComposedChart, ResponsiveContainer, XAxis, YAxis } from "recharts";
import { KpiCard } from "@/components/ui/primitives";
import { ChartFrame, ChartTooltip, CHART_COLORS } from "@/components/charts/themed";
import { useAnalytics, useProjectContext } from "@/hooks/use-app-data";

type Investment = {
  windowMonths: string[];
  investedTotalFils: string;
  recoveredTotalFils: string;
  outstandingFinalFils: string;
  recoveryRatePct: number;
  peakExposureMonth: string | null;
  peakExposureFils: string;
  carryInFils: string;
  monthly: { month: string; investedFils: string; recoveredFils: string; outstandingFils: string }[];
};

function aed(fils: string): string {
  const n = BigInt(fils);
  return `AED ${(n / 100n).toLocaleString("en-US")}.${(n % 100n).toString().padStart(2, "0")}`;
}

function shortAed(v: number): string {
  if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (Math.abs(v) >= 1_000) return `${Math.round(v / 1000)}K`;
  return v.toFixed(0);
}

function labelForMonth(m: string): string {
  const [y, mo] = m.split("-");
  const names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${names[Number(mo) - 1]} ${y.slice(2)}`;
}

export function InvestmentClient() {
  const { code, projects } = useProjectContext();
  const projectId = useMemo(() => projects.find((p) => p.code === code)?.id ?? null, [projects, code]);
  const { data, isLoading } = useAnalytics<Investment>("investment", projectId);

  if (isLoading || !data) {
    return (
      <div className="mx-auto max-w-[1200px]" aria-busy="true">
        <div className="mb-4 h-8 w-40 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
        <div className="grid grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900" />
          ))}
        </div>
      </div>
    );
  }

  const paired = data.monthly.map((m) => ({
    label: labelForMonth(m.month),
    invested: Number(m.investedFils) / 100,
    recovered: Number(m.recoveredFils) / 100,
  }));
  const gapCurve = (() => {
    let cumInv = Number(data.carryInFils) / 100;
    let cumRec = 0;
    return data.monthly.map((m) => {
      cumInv += Number(m.investedFils) / 100;
      cumRec += Number(m.recoveredFils) / 100;
      return { label: labelForMonth(m.month), outstanding: cumInv - cumRec };
    });
  })();

  return (
    <div className="mx-auto flex max-w-[1200px] flex-col gap-6 px-1 sm:px-0">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Analytics{code ? ` · ${code}` : ""}</p>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-3xl">Investment</h1>
        <p className="mt-0.5 text-sm text-zinc-500">
          Matched window {data.windowMonths[0]} → {data.windowMonths[1]}; pre-window commitments carried in ({aed(data.carryInFils)}).
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
        <KpiCard label="Recovery rate" value={`${data.recoveryRatePct.toFixed(1)}%`} sub="certified ÷ invested" />
        <KpiCard label="Outstanding" value={aed(data.outstandingFinalFils)} sub={`invested ${aed(data.investedTotalFils)}`} />
        <KpiCard
          label="Peak exposure"
          value={data.peakExposureMonth ? `${labelForMonth(data.peakExposureMonth)} · ${shortAed(Number(data.peakExposureFils) / 100)}` : "—"}
          sub="largest cumulative gap"
        />
      </div>

      <ChartFrame
        title="Invested vs recovered by month"
        unit="AED"
        ariaLabel={`Paired monthly bars. Invested total ${aed(data.investedTotalFils)}, recovered ${aed(data.recoveredTotalFils)}, recovery rate ${data.recoveryRatePct.toFixed(1)} percent.`}
      >
        <div className="w-full overflow-x-auto">
          <div className="min-w-[520px]">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={paired} margin={{ top: 4, right: 8, left: 48 }}>
                <CartesianGrid stroke="#e4e4e7" vertical={false} strokeOpacity={0.5} className="dark:opacity-20" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={10} interval={1} />
                <YAxis tickFormatter={shortAed} tickLine={false} axisLine={false} fontSize={10} width={52} />
                <Bar dataKey="invested" name="Invested (LPOs)" fill={CHART_COLORS.committed} radius={[3, 3, 0, 0]} barSize={12} isAnimationActive={false} />
                <Bar dataKey="recovered" name="Recovered (PCs)" fill={CHART_COLORS.certified} radius={[3, 3, 0, 0]} barSize={12} isAnimationActive={false} />
                <ChartTooltip moneyKeys={["invested", "recovered"]} cursor={{ fill: "rgba(0,0,0,0.03)" }} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </ChartFrame>

      <ChartFrame
        title="Cumulative outstanding gap"
        unit="AED"
        ariaLabel={`Cumulative investment minus cumulative certified. Ends at ${aed(data.outstandingFinalFils)}. Peak ${data.peakExposureMonth ? labelForMonth(data.peakExposureMonth) : "n/a"} at ${aed(data.peakExposureFils)}.`}
      >
        <div className="w-full overflow-x-auto">
          <div className="min-w-[520px]">
            <ResponsiveContainer width="100%" height={260}>
              <ComposedChart data={gapCurve} margin={{ top: 4, right: 8, left: 48 }}>
                <CartesianGrid stroke="#e4e4e7" vertical={false} strokeOpacity={0.5} className="dark:opacity-20" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={10} interval={1} />
                <YAxis tickFormatter={shortAed} tickLine={false} axisLine={false} fontSize={10} width={52} />
                <Area type="monotone" dataKey="outstanding" name="Outstanding" stroke={CHART_COLORS.outstanding} fill={CHART_COLORS.outstanding} fillOpacity={0.07} strokeWidth={2} isAnimationActive={false} />
                <ChartTooltip moneyKeys={["outstanding"]} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      </ChartFrame>
    </div>
  );
}
