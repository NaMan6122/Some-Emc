"use client";

import { useCallback, useEffect, useState } from "react";

type AuditRow = {
  id: string;
  at: string;
  actorId: number;
  entity: string;
  entityId: string;
  action: string;
  before: unknown;
  after: unknown;
};

const ENTITIES = ["", "Project", "Supplier", "Lpo", "BudgetLine", "PaymentCertificate", "VariationOrder", "RetentionRelease", "LpoAllocation", "DataFlag", "User", "CostLine", "CostEntry"];

function fmt(v: unknown): string {
  if (v == null) return "—";
  const s = typeof v === "string" ? v : JSON.stringify(v);
  return s.length > 60 ? s.slice(0, 60) + "…" : s;
}

export function AuditClient() {
  const [rows, setRows] = useState<AuditRow[] | null>(null);
  const [entity, setEntity] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(
    async (cursor?: string) => {
      setErr(null);
      const p = new URLSearchParams({ limit: "50" });
      if (entity) p.set("entity", entity);
      if (from) p.set("from", new Date(`${from}T00:00:00Z`).toISOString());
      if (to) p.set("to", new Date(`${to}T23:59:59Z`).toISOString());
      if (cursor) p.set("cursor", cursor);
      const res = await fetch(`/api/v1/audit?${p}`);
      if (!res.ok) {
        setErr(`Load failed (${res.status})`);
        return;
      }
      const b = await res.json();
      setRows((prev) => (cursor ? [...(prev ?? []), ...b.items] : b.items));
      setNextCursor(b.nextCursor);
    },
    [entity, from, to],
  );

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entity, from, to]);

  const sel =
    "rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900";
  const inputCls =
    "rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900";

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Administration</p>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">Audit Log</h1>
        <p className="mt-0.5 text-sm text-zinc-500">Immutable change history across every financial entity.</p>
      </div>

      <section className="flex flex-wrap items-center gap-2 rounded-xl border border-zinc-200 bg-white p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <select aria-label="Entity" value={entity} onChange={(e) => setEntity(e.target.value)} className={sel}>
          {ENTITIES.map((e) => (
            <option key={e || "all"} value={e}>{e || "All entities"}</option>
          ))}
        </select>
        <input type="date" aria-label="From" value={from} onChange={(e) => setFrom(e.target.value)} className={inputCls} />
        <input type="date" aria-label="To" value={to} onChange={(e) => setTo(e.target.value)} className={inputCls} />
        {(entity || from || to) && (
          <button
            onClick={() => {
              setEntity("");
              setFrom("");
              setTo("");
            }}
            className="text-xs text-indigo-600 hover:underline"
          >
            Clear
          </button>
        )}
      </section>

      {err && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {err}
        </div>
      )}

      {!rows ? (
        <div className="h-64 animate-pulse rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900" aria-busy="true" />
      ) : rows.length === 0 ? (
        <p className="py-8 text-center text-sm text-zinc-400">No audit entries match these filters.</p>
      ) : (
        <section className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-800/60">
                <tr>
                  <th className="px-4 py-3">When</th>
                  <th className="px-4 py-3">Actor</th>
                  <th className="px-4 py-3">Entity</th>
                  <th className="px-4 py-3">Action</th>
                  <th className="px-4 py-3">Before</th>
                  <th className="px-4 py-3">After</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t border-zinc-100 hover:bg-zinc-50 dark:border-zinc-800">
                    <td className="whitespace-nowrap px-4 py-2 tabular-nums text-xs text-zinc-600 dark:text-zinc-300">
                      {r.at.slice(0, 16).replace("T", " ")}
                    </td>
                    <td className="px-4 py-2 text-xs text-zinc-500">#{r.actorId}</td>
                    <td className="px-4 py-2 font-mono text-xs">{r.entity}</td>
                    <td className="px-4 py-2">
                      <span className="inline-block rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                        {r.action}
                      </span>
                    </td>
                    <td className="max-w-[14rem] truncate px-4 py-2 font-mono text-[11px] text-zinc-500">{fmt(r.before)}</td>
                    <td className="max-w-[14rem] truncate px-4 py-2 font-mono text-[11px] text-zinc-600 dark:text-zinc-300">{fmt(r.after)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-end gap-2 border-t border-zinc-100 px-3 py-2 text-xs dark:border-zinc-800">
            {nextCursor && (
              <button
                onClick={() => void load(nextCursor)}
                className="rounded-lg border border-zinc-200 px-3 py-1 font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
              >
                Load more
              </button>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
