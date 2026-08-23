"use client";

import { useMemo } from "react";
import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, XAxis, YAxis } from "recharts";
import useSWR from "swr";
import { KpiCard } from "@/components/ui/primitives";
import { ChartFrame, ChartTooltip, CHART_COLORS } from "@/components/charts/themed";
import { ProvenanceChip, StatusPill } from "@/components/ui/StatusPill";
import { useAnalytics, useProjectContext } from "@/hooks/use-app-data";

type Cashflow = {
  windowMonths: string[];
  monthly: {
    month: string;
    committedFils: string;
    certifiedFils: string;
    cumulativeCommittedFils: string;
    cumulativeCertifiedFils: string;
    outstandingFils: string;
  }[];
  carryInFils: string;
  retentionTotalFils: string;
  variationClaims: { claimedFils: string; unapprovedVoExposureFils: string };
};

type PcRow = {
  id: string;
  pcNumber: number;
  periodLabel: string;
  grossFils: string;
  retentionFils: string;
  netPayableFils: string;
  status: string;
  provenance: string;
};

function aed(fils: string): string {
  const n = BigInt(fils);
  return `AED ${(n / 100n).toLocaleString("en-US")}.${(n % 100n).toString().padStart(2, "0")}`;
}

function shortAed(fils: number): string {
  if (fils >= 1_000_000) return `${(fils / 1_000_000).toFixed(1)}M`;
  if (fils >= 1_000) return `${Math.round(fils / 1000)}K`;
  return fils.toFixed(0);
}

function labelForMonth(m: string): string {
  const [y, mo] = m.split("-");
  const names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${names[Number(mo) - 1]} ${y.slice(2)}`;
}

export function PcDashboardClient() {
  const { code, projects } = useProjectContext();
  const projectId = useMemo(() => projects.find((p) => p.code === code)?.id ?? null, [projects, code]);
  const { data, isLoading } = useAnalytics<Cashflow>("cashflow", projectId);
  const pcsSwr = useSWR<{ items: PcRow[] }>(projectId ? `/api/v1/projects/${projectId}/pcs` : null, (u: string) =>
    fetch(u).then((r) => (r.ok ? r.json() : null)),
  );
  const pcs = (pcsSwr.data?.items ?? []).slice().sort((a, b) => a.pcNumber - b.pcNumber);

  if (isLoading || !data) {
    return (
      <div className="mx-auto max-w-[1200px]" aria-busy="true">
        <div className="mb-4 h-8 w-64 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
        <div className="h-72 animate-pulse rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900" />
      </div>
    );
  }

  const chartData = data.monthly.map((m) => ({
    label: labelForMonth(m.month),
    committed: Number(m.committedFils) / 100,
    certified: Number(m.certifiedFils) / 100,
    cumCommitted: Number(m.cumulativeCommittedFils) / 100,
    cumCertified: Number(m.cumulativeCertifiedFils) / 100,
  }));

  return (
    <div className="mx-auto flex max-w-[1200px] flex-col gap-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Analytics{code ? ` · ${code}` : ""}</p>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">Payment Certificates</h1>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard label="Retention held" value={aed(data.retentionTotalFils)} sub="not yet released" />
        <KpiCard label="Variation claims" value={aed(data.variationClaims.claimedFils)} sub="Σ PC variation claims" />
        <KpiCard
          label="Unapproved VO exposure"
          value={aed(data.variationClaims.unapprovedVoExposureFils)}
          sub={data.variationClaims.unapprovedVoExposureFils === "0" ? "fully covered" : "claims on open VOs"}
        />
        <KpiCard
          label="Certified to date"
          value={aed(data.monthly.at(-1)?.cumulativeCertifiedFils ?? "0")}
          sub={`window ${data.windowMonths[0]} → ${data.windowMonths[1]}`}
        />
      </div>

      <ChartFrame
        title="Certified vs procurement commitments"
        unit="AED per month; dashed lines cumulative"
        ariaLabel={`Monthly bars of committed versus certified amounts with dashed cumulative overlays. Certified to date ${aed(data.monthly.at(-1)?.cumulativeCertifiedFils ?? "0")}.`}
      >
        <ResponsiveContainer width="100%" height={320}>
          <ComposedChart data={chartData} margin={{ top: 4, right: 8, left: 48 }}>
            <CartesianGrid stroke="#e4e4e7" vertical={false} strokeOpacity={0.5} className="dark:opacity-20" />
            <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={10} />
            <YAxis tickFormatter={shortAed} tickLine={false} axisLine={false} fontSize={10} width={52} />
            <Bar dataKey="committed" name="LPOs committed" fill={CHART_COLORS.committed} radius={[3, 3, 0, 0]} barSize={12} opacity={0.35} isAnimationActive={false} />
            <Bar dataKey="certified" name="PC net certified" fill={CHART_COLORS.certified} radius={[3, 3, 0, 0]} barSize={12} isAnimationActive={false} />
            <Line type="monotone" dataKey="cumCommitted" name="Cumulative committed" stroke={CHART_COLORS.committed} strokeWidth={2} strokeDasharray="5 4" dot={false} isAnimationActive={false} />
            <Line type="monotone" dataKey="cumCertified" name="Cumulative certified" stroke={CHART_COLORS.certified} strokeWidth={2} strokeDasharray="5 4" dot={false} isAnimationActive={false} />
            <ChartTooltip moneyKeys={["committed", "certified", "cumCommitted", "cumCertified"]} cursor={{ fill: "rgba(0,0,0,0.03)" }} />
          </ComposedChart>
        </ResponsiveContainer>
      </ChartFrame>

      <section className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-800/60">
            <tr>
              <th className="px-4 py-3">PC</th>
              <th className="px-4 py-3">Period</th>
              <th className="px-4 py-3 text-right">Gross</th>
              <th className="px-4 py-3 text-right">Retention</th>
              <th className="px-4 py-3 text-right">Net payable</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Source</th>
            </tr>
          </thead>
          <tbody>
            {pcs.map((p) => (
              <tr key={p.id} className="border-t border-zinc-100 hover:bg-zinc-50 dark:border-zinc-800">
                <td className="px-4 py-2.5 font-medium tabular-nums text-zinc-900 dark:text-zinc-100">{p.pcNumber}</td>
                <td className="px-4 py-2.5 text-zinc-700 dark:text-zinc-300">{p.periodLabel}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-zinc-900 dark:text-zinc-100">{aed(p.grossFils)}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-zinc-700 dark:text-zinc-300">{p.retentionFils === "0" ? "—" : aed(p.retentionFils)}</td>
                <td className="px-4 py-2.5 text-right font-medium tabular-nums text-zinc-900 dark:text-zinc-100">{aed(p.netPayableFils)}</td>
                <td className="px-4 py-2.5"><StatusPill domain="pc" value={p.status} /></td>
                <td className="px-4 py-2.5"><ProvenanceChip value={p.provenance} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
