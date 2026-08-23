"use client";

import { Tooltip as RTooltip } from "recharts";
import type { ReactNode } from "react";

// spec-015 / design.md §9: dark tooltips with fils-exact values, horizontal-only
// grids, one accent color. Shared Recharts theming for all dashboard charts.

export const CHART_COLORS = {
  committed: "#4f46e5", // indigo-600 (accent)
  certified: "#059669", // emerald-600
  outstanding: "#dc2626", // red-600
  cumulative: "#a1a1aa", // zinc-400
  bar: "#6366f1",
} as const;

function aed(fils: number | bigint): string {
  const n = BigInt(Math.round(Number(fils)));
  const sign = n < 0n ? "-" : "";
  const abs = sign ? -n : n;
  return `${sign}AED ${(abs / 100n).toLocaleString("en-US")}.${(abs % 100n).toString().padStart(2, "0")}`;
}

type TooltipEntry = { name?: unknown; value?: unknown; dataKey?: unknown };

function TooltipContent({
  active,
  payload,
  label,
  moneyKeys,
}: {
  active?: boolean;
  payload?: readonly TooltipEntry[];
  label?: unknown;
  moneyKeys: string[];
}) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs shadow-xl">
      <p className="mb-1 font-medium text-zinc-200">{String(label ?? "")}</p>
      {payload.map((entry, i) => {
        const isMoney = entry.dataKey !== undefined && moneyKeys.includes(String(entry.dataKey));
        return (
          <p key={i} className="text-zinc-300 tabular-nums">
            {String(entry.name ?? "")}:{" "}
            <span className="font-semibold text-white">
              {isMoney ? aed(Number(entry.value)) : String(entry.value)}
            </span>
          </p>
        );
      })}
    </div>
  );
}

/** Recharts-compatible tooltip: dark surface, fils-exact values (design.md §9). */
export function ChartTooltip({
  moneyKeys,
  cursor,
}: {
  moneyKeys: string[];
  cursor?: { fill: string };
}) {
  return (
    <RTooltip
      cursor={cursor ?? { fill: "rgba(0,0,0,0.04)" }}
      isAnimationActive={false}
      content={(props) => <TooltipContent {...props} moneyKeys={moneyKeys} />}
    />
  );
}

export function ChartFrame({
  title,
  unit,
  ariaLabel,
  children,
}: {
  title: string;
  unit: string;
  ariaLabel: string;
  children: ReactNode;
}) {
  return (
    <figure
      aria-label={ariaLabel}
      className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
    >
      <figcaption className="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
        {title}
        <span className="ml-2 text-xs font-normal text-zinc-500">({unit})</span>
      </figcaption>
      {children}
    </figure>
  );
}
