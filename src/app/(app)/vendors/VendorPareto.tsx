"use client";

import { useMemo } from "react";
import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, XAxis, YAxis } from "recharts";
import { ChartFrame, ChartTooltip, CHART_COLORS } from "@/components/charts/themed";
import { useAnalytics, useProjectContext, useSession } from "@/hooks/use-app-data";
import { LpoLogClient } from "@/app/(app)/vendors/LpoLogClient";

type Vendors = {
  totalFils: string;
  supplierCount: number;
  top8SharePct: number;
  repeatSuppliers: number;
  longTailSuppliers: number;
  curve: { rank: number; supplierName: string; fils: string; count: number; sharePct: number; cumSharePct: number }[];
};

export function VendorParetoClient() {
  const { code, projects } = useProjectContext();
  const projectId = useMemo(() => projects.find((p) => p.code === code)?.id ?? null, [projects, code]);
  const { data, isLoading } = useAnalytics<Vendors>("vendors", projectId);

  if (isLoading || !data) {
    return <div className="h-80 animate-pulse rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900" aria-busy="true" />;
  }

  const top10 = data.curve.slice(0, 10).map((c) => ({
    name: c.supplierName.replace(/^M\/S /, "").slice(0, 18),
    spend: Number(c.fils) / 100,
    cumSharePct: c.cumSharePct,
  }));

  return (
    <ChartFrame
      title={`Top suppliers — Pareto (top 8 = ${data.top8SharePct.toFixed(1)}% of spend)`}
      unit="AED bars + cumulative % line"
      ariaLabel={`Supplier concentration Pareto. Top supplier ${data.curve[0]?.supplierName} at ${data.curve[0]?.sharePct.toFixed(1)} percent. Top 8 hold ${data.top8SharePct.toFixed(1)} percent. ${data.supplierCount} suppliers, ${data.repeatSuppliers} with repeat orders.`}
    >
      <ResponsiveContainer width="100%" height={320}>
        <ComposedChart data={top10} margin={{ top: 4, right: 8, left: 48 }}>
          <CartesianGrid stroke="#e4e4e7" vertical={false} strokeOpacity={0.5} className="dark:opacity-20" />
          <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={9} interval={0} angle={-28} textAnchor="end" height={58} />
          <YAxis yAxisId="aed" tickFormatter={(v: number) => `${v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M` : `${Math.round(v / 1000)}K`}`} tickLine={false} axisLine={false} fontSize={10} width={52} />
          <YAxis yAxisId="pct" orientation="right" domain={[0, 100]} tickFormatter={(v: number) => `${Math.round(v)}%`} tickLine={false} axisLine={false} fontSize={10} width={40} />
          <Bar yAxisId="aed" dataKey="spend" name="Spend" fill={CHART_COLORS.committed} radius={[3, 3, 0, 0]} barSize={20} isAnimationActive={false} />
          <Line yAxisId="pct" type="monotone" dataKey="cumSharePct" name="Cumulative %" stroke={CHART_COLORS.outstanding} strokeWidth={2} dot={{ r: 3 }} isAnimationActive={false} />
          <ChartTooltip moneyKeys={["spend"]} />
        </ComposedChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}

// spec-015 tab 5: vendors Pareto above the existing spec-010 LPO log screen.
export function VendorsTab() {
  const { session } = useSession();
  void session;
  return (
    <div className="flex flex-col gap-6">
      <VendorParetoClient />
      <LpoLogClient />
    </div>
  );
}
