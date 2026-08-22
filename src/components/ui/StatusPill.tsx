"use client";

import type { Trade } from "@prisma/client";

// spec-009-v1: StatusPill + categorical trade dot per design.md §7.

type Variant = "gray" | "blue" | "amber" | "emerald" | "rose" | "info" | "muted";

const TINT: Record<Variant, string> = {
  gray: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
  blue: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  amber: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  emerald: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  rose: "bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300",
  info: "bg-sky-50 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
  muted: "bg-zinc-50 text-zinc-400 dark:bg-zinc-900 dark:text-zinc-500",
};

const DOT: Record<Variant, string> = {
  gray: "bg-zinc-400",
  blue: "bg-blue-500",
  amber: "bg-amber-500",
  emerald: "bg-emerald-500",
  rose: "bg-rose-500",
  info: "bg-sky-500",
  muted: "bg-zinc-300",
};

const LPO_STATUS: Record<string, { label: string; variant: Variant }> = {
  DRAFT: { label: "Draft", variant: "gray" },
  ISSUED: { label: "Issued", variant: "blue" },
  CLOSED: { label: "Closed", variant: "emerald" },
  CANCELLED: { label: "Cancelled", variant: "muted" },
};
const PC_STATUS: Record<string, { label: string; variant: Variant }> = {
  DRAFT: { label: "Draft", variant: "gray" },
  SUBMITTED: { label: "Submitted", variant: "amber" },
  CERTIFIED: { label: "Certified", variant: "blue" },
  PAID: { label: "Paid", variant: "emerald" },
};
const VO_STATUS: Record<string, { label: string; variant: Variant }> = {
  DRAFT: { label: "Draft", variant: "gray" },
  SUBMITTED: { label: "Submitted", variant: "amber" },
  APPROVED: { label: "Approved", variant: "emerald" },
  REJECTED: { label: "Rejected", variant: "rose" },
};
const VERIFICATION: Record<string, { label: string; variant: Variant }> = {
  VERIFIED: { label: "Verified", variant: "emerald" },
  PENDING: { label: "Pending", variant: "amber" },
  FLAGGED: { label: "Flagged", variant: "rose" },
};

export function statusVariant(domain: "lpo" | "pc" | "vo" | "verification", value: string): { label: string; variant: Variant } {
  const table =
    domain === "lpo" ? LPO_STATUS : domain === "pc" ? PC_STATUS : domain === "vo" ? VO_STATUS : VERIFICATION;
  return table[value] ?? { label: value, variant: "gray" };
}

export function StatusPill({
  domain,
  value,
}: {
  domain: "lpo" | "pc" | "vo" | "verification";
  value: string;
}) {
  const { label, variant } = statusVariant(domain, value);
  const cancelledStrike = domain === "lpo" && value === "CANCELLED";
  return (
    <span
      data-testid={`pill-${domain}-${value}`}
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${TINT[variant]} ${
        cancelledStrike ? "line-through decoration-zinc-400" : ""
      }`}
    >
      <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${DOT[variant]}`} />
      {label}
    </span>
  );
}

export function ProvenanceChip({ value }: { value: string }) {
  const labels: Record<string, { label: string; cls: string }> = {
    SOURCE_DOCUMENT: { label: "SOURCE", cls: "border-zinc-200 text-zinc-600 dark:border-zinc-700 dark:text-zinc-300" },
    OCR_ESTIMATE: { label: "OCR EST", cls: "border-amber-200 text-amber-700 dark:border-amber-800 dark:text-amber-300" },
    CLIENT_SUMMARY: { label: "CLIENT SUMMARY", cls: "border-sky-200 text-sky-700 dark:border-sky-800 dark:text-sky-300" },
    DERIVED: { label: "DERIVED", cls: "border-sky-200 text-sky-700 dark:border-sky-800 dark:text-sky-300" },
    IMPORTED_REPORT: { label: "IMPORTED", cls: "border-zinc-200 text-zinc-500 dark:border-zinc-700 dark:text-zinc-400" },
  };
  const v = labels[value] ?? { label: value, cls: "border-zinc-200 text-zinc-500" };
  return (
    <span className={`inline-block rounded border px-1.5 py-px text-[10px] font-medium tracking-wide ${v.cls}`}>
      {v.label}
    </span>
  );
}

export const TRADE_DOT_COLOR: Record<Trade, string> = {
  ELECTRICAL: "#2563EB",
  PLUMBING: "#0D9488",
  HVAC: "#7C3AED",
  FIRE_FIGHTING: "#E11D48",
  GENERAL: "#B45309",
  HSE: "#DB2777",
  OTHER: "#64748B",
};

export function TradeDot({ trade }: { trade: Trade }) {
  return (
    <span
      aria-label={trade}
      className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
      style={{ backgroundColor: TRADE_DOT_COLOR[trade] }}
    />
  );
}
