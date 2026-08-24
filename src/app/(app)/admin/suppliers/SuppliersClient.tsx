"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import { EmptyState } from "@/components/ui/primitives";
import { useSession } from "@/hooks/use-app-data";

type Supplier = {
  id: number;
  name: string;
  aliases: string[];
  mergedIntoId: number | null;
  _count?: { lpos: number };
};

type Suggestion = {
  a: { id: number; name: string };
  b: { id: number; name: string };
  score: number;
};

const fetcher = (url: string) => fetch(url).then((r) => (r.ok ? r.json() : null));

// spec-020-v1: vendor master + duplicate-merge screen. Merge actions are
// ADMIN-only in the UI; the API enforces the same gate server-side.
export function SuppliersClient() {
  const { session } = useSession();
  const isAdmin = session?.role === "ADMIN";
  const [query, setQuery] = useState("");
  const [sourceId, setSourceId] = useState<number | "">("");
  const [targetId, setTargetId] = useState<number | "">("");
  const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const suppliersSwr = useSWR<{ items: Supplier[] }>("/api/v1/suppliers", fetcher);
  const suggestionsSwr = useSWR<{ items: Suggestion[] }>("/api/v1/suppliers/duplicates/suggestions", fetcher);

  const suppliers = useMemo(() => suppliersSwr.data?.items ?? [], [suppliersSwr.data]);
  const byId = useMemo(() => new Map(suppliers.map((s) => [s.id, s])), [suppliers]);
  const activeSuppliers = suppliers.filter((s) => s.mergedIntoId === null);
  const filtered = useMemo(() => {
    const q = query.trim().toUpperCase();
    return q ? suppliers.filter((s) => s.name.includes(q)) : suppliers;
  }, [suppliers, query]);
  const suggestions = suggestionsSwr.data?.items ?? [];

  async function submitMerge() {
    if (sourceId === "" || targetId === "" || sourceId === targetId) return;
    setBusy(true);
    setToast(null);
    try {
      const res = await fetch(`/api/v1/suppliers/${sourceId}/merge`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ targetId }),
      });
      if (res.ok) {
        const survivor = byId.get(targetId);
        setToast({ ok: true, text: `Merged into "${survivor?.name ?? targetId}" — LPO history re-pointed.` });
        setSourceId("");
        setTargetId("");
        await Promise.all([suppliersSwr.mutate(), suggestionsSwr.mutate()]);
      } else {
        const err = (await res.json().catch(() => null)) as { error?: { code?: string; message?: string } } | null;
        setToast({ ok: false, text: err?.error?.message ?? `Merge failed (${res.status})` });
      }
    } finally {
      setBusy(false);
    }
  }

  function prefill(aId: number, bId: number) {
    // Lower id survives by convention so the older master absorbs the newer.
    setSourceId(Math.max(aId, bId));
    setTargetId(Math.min(aId, bId));
    setToast(null);
  }

  const selectClass =
    "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100";

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Administration</p>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">Suppliers</h1>
        <p className="mt-0.5 text-sm text-zinc-500">
          Vendor master{isAdmin ? " — merge duplicates with full audit" : " (read-only)"}. Original spellings live on as aliases.
        </p>
      </div>

      {toast && (
        <div
          role="status"
          className={`flex items-center justify-between rounded-lg border px-4 py-2 text-sm ${
            toast.ok
              ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200"
              : "border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200"
          }`}
        >
          {toast.text}
          <button className="ml-3 text-zinc-400" onClick={() => setToast(null)}>✕</button>
        </div>
      )}

      {isAdmin && (
        <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            Suspected duplicates
            <span className="ml-2 text-xs font-normal text-zinc-500">advisory only — merging is explicit</span>
          </h2>
          {suggestions.length === 0 ? (
            <p className="mt-2 text-sm text-zinc-500">No scored pairs right now.</p>
          ) : (
            <ul className="mt-3 grid gap-2 md:grid-cols-2">
              {suggestions.map((s) => (
                <li
                  key={`${s.a.id}-${s.b.id}`}
                  className="flex items-center justify-between gap-3 rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800"
                >
                  <span className="min-w-0 flex-1 truncate text-zinc-700 dark:text-zinc-300" title={`${s.a.name} ↔ ${s.b.name}`}>
                    {s.a.name} <span className="text-zinc-400">↔</span> {s.b.name}
                    <span className="ml-2 font-mono text-xs text-indigo-600 dark:text-indigo-400">{s.score}</span>
                  </span>
                  <button
                    onClick={() => prefill(s.a.id, s.b.id)}
                    className="shrink-0 rounded-lg border border-indigo-300 px-2.5 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-50 dark:border-indigo-800 dark:text-indigo-300 dark:hover:bg-indigo-950"
                  >
                    Review
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {isAdmin && (
        <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Merge supplier</h2>
          <p className="mt-1 text-xs text-zinc-500">
            The source record keeps its identity as an alias on the survivor; all LPOs are re-pointed atomically.
          </p>
          <div className="mt-3 grid items-end gap-3 md:grid-cols-[1fr_auto_1fr_auto]">
            <label className="block text-sm text-zinc-700 dark:text-zinc-300">
              Source (absorbed)
              <select
                aria-label="Source supplier"
                value={sourceId}
                onChange={(e) => setSourceId(e.target.value === "" ? "" : Number(e.target.value))}
                className={`mt-1 ${selectClass}`}
              >
                <option value="">Select…</option>
                {activeSuppliers.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </label>
            <button
              onClick={() => {
                const s = sourceId;
                setSourceId(targetId);
                setTargetId(s);
              }}
              disabled={sourceId === "" && targetId === ""}
              title="Swap direction"
              className="mb-0.5 rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-600 hover:bg-zinc-100 disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              ⇄
            </button>
            <label className="block text-sm text-zinc-700 dark:text-zinc-300">
              Target (survivor)
              <select
                aria-label="Target supplier"
                value={targetId}
                onChange={(e) => setTargetId(e.target.value === "" ? "" : Number(e.target.value))}
                className={`mt-1 ${selectClass}`}
              >
                <option value="">Select…</option>
                {activeSuppliers.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </label>
            <button
              onClick={submitMerge}
              disabled={busy || sourceId === "" || targetId === "" || sourceId === targetId}
              className="mb-0.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
            >
              Merge
            </button>
          </div>
        </section>
      )}

      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search vendors…"
        aria-label="Search vendors"
        className="w-full max-w-sm rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
      />

      {!suppliersSwr.data ? (
        <div className="h-64 animate-pulse rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900" aria-busy="true" />
      ) : filtered.length === 0 ? (
        <EmptyState title="No matching suppliers" body="Try a different search." />
      ) : (
        <section className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-800/60">
              <tr>
                <th className="px-4 py-3">Supplier</th>
                <th className="px-4 py-3">Aliases</th>
                <th className="px-4 py-3 text-right">LPOs</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => {
                const mergedInto = s.mergedIntoId != null ? byId.get(s.mergedIntoId) : null;
                return (
                  <tr
                    key={s.id}
                    className={`border-t border-zinc-100 hover:bg-zinc-50 dark:border-zinc-800 ${mergedInto ? "opacity-60" : ""}`}
                  >
                    <td className="max-w-[28rem] truncate px-4 py-2.5 font-medium text-zinc-900 dark:text-zinc-100">{s.name}</td>
                    <td className="px-4 py-2.5 text-zinc-500">{s.aliases?.length ?? 0}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-zinc-700 dark:text-zinc-300">{s._count?.lpos ?? 0}</td>
                    <td className="px-4 py-2.5">
                      {mergedInto ? (
                        <span className="text-xs italic text-zinc-500">merged into {mergedInto.name}</span>
                      ) : (
                        <span className="inline-block rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                          active
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
