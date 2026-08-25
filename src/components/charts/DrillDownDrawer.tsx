"use client";

import { useEffect, useState } from "react";
import { Drawer } from "@/components/ui/Drawer";
import { formatMoney } from "@/lib/money";

// spec-026-v1: chart drill-down drawer. Fetches an existing list endpoint,
// renders the underlying records for a clicked datum, and offers CSV (Excel)
// plus print-PDF actions. No new API routes — consumes what exists.

export type DrillColumn<T> = {
  key: keyof T & string;
  label: string;
  render?: (row: T) => React.ReactNode;
  right?: boolean;
};

export function DrillDownDrawer<T extends { id?: unknown }>({
  title,
  endpoint,
  columns,
  csvUrl,
  sumKey,
  onClose,
}: {
  title: string;
  endpoint: string;
  columns: DrillColumn<T>[];
  csvUrl?: string;
  sumKey?: keyof T & string;
  onClose: () => void;
}) {
  const [rows, setRows] = useState<T[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    document.body.classList.add("drill-open");
    fetch(endpoint)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((b) => setRows((b.items ?? b) as T[]))
      .catch(() => setErr("Could not load records."));
    return () => document.body.classList.remove("drill-open");
  }, [endpoint]);

  const total =
    rows && sumKey
      ? rows.reduce((s, r) => {
          const v = r[sumKey];
          return typeof v === "string" ? s + BigInt(v) : s;
        }, 0n)
      : null;

  return (
    <Drawer title={title} onClose={onClose}>
      {err && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{err}</p>}
      {!rows && !err && <p className="text-sm text-zinc-400">Loading…</p>}
      {rows && (
        <>
          <div data-drill-content>
            <table className="w-full text-xs">
              <thead className="text-left uppercase tracking-wide text-zinc-500">
                <tr>
                  {columns.map((c) => (
                    <th key={c.key} className={`px-2 py-1.5 ${c.right ? "text-right" : ""}`}>{c.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className="border-t border-zinc-100 dark:border-zinc-800">
                    {columns.map((c) => (
                      <td key={c.key} className={`px-2 py-1.5 ${c.right ? "text-right tabular-nums" : ""}`}>
                        {c.render ? c.render(r) : String(r[c.key] ?? "—")}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length === 0 && <p className="py-4 text-center text-xs text-zinc-400">No records.</p>}
          </div>
          <div className="sticky bottom-0 mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-zinc-100 bg-white pt-3 dark:border-zinc-800 dark:bg-zinc-900">
            <span className="text-xs text-zinc-500">
              {rows.length} record{rows.length === 1 ? "" : "s"}
              {total !== null && (
                <span className="ml-2 font-semibold tabular-nums">{formatMoney(total)}</span>
              )}
            </span>
            <span className="flex gap-2 print:hidden">
              {csvUrl && (
                <a
                  href={csvUrl}
                  className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
                >
                  Excel (CSV)
                </a>
              )}
              <button
                onClick={() => window.print()}
                className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500"
              >
                PDF (print)
              </button>
            </span>
          </div>
        </>
      )}
    </Drawer>
  );
}
