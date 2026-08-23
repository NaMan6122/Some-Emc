"use client";

import { useCallback, useEffect, useState } from "react";
import useSWR from "swr";
import { PageHeader, EmptyState, ErrorBanner } from "@/components/ui/primitives";
import { useSession } from "@/hooks/use-app-data";

type BudgetLine = {
  id: string;
  projectId: number;
  trade: string;
  category: string;
  amountFils: string;
  sourceLabel: string;
  refDate: string | null;
  note: string | null;
};

type VarianceRow = {
  trade: string;
  budgetFils: string;
  committedFils: string;
  utilizationPct: number;
  status: "under" | "watch" | "over" | "no_budget" | "no_spend";
};

const TRADES = ["ELECTRICAL", "PLUMBING", "HVAC", "FIRE_FIGHTING", "GENERAL", "HSE", "OTHER"];
const CATEGORIES = ["MATERIALS", "LABOUR", "OTHER"];

function formatAED(fils: string): string {
  const n = BigInt(fils);
  const sign = n < 0n ? "-" : "";
  const abs = sign ? -n : n;
  return `${sign}AED ${(abs / 100n).toLocaleString("en-US")}.${(abs % 100n).toString().padStart(2, "0")}`;
}

const STATUS_STYLES: Record<VarianceRow["status"], { label: string; cls: string }> = {
  under: { label: "Under", cls: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" },
  watch: { label: "Watch", cls: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300" },
  over: { label: "Over", cls: "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300" },
  no_budget: { label: "No JCA line", cls: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300" },
  no_spend: { label: "No spend", cls: "bg-zinc-100 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-500" },
};

const EMPTY_FORM = { trade: "ELECTRICAL", category: "MATERIALS", amountFils: "", sourceLabel: "", refDate: "", note: "" };

export function BudgetClient({ projectId }: { projectId: string }) {
  const { session } = useSession();
  const role = session?.role ?? null;
  const canWrite = role === "ADMIN" || role === "COMMERCIAL";
  const canDelete = role === "ADMIN";

  const linesSwr = useSWR<{ items: BudgetLine[] }>(`/api/v1/projects/${projectId}/budget-lines`, (u: string) =>
    fetch(u).then((r) => (r.ok ? r.json() : null)),
  );
  const varianceSwr = useSWR<{ items: VarianceRow[] }>(`/api/v1/projects/${projectId}/variance`, (u: string) =>
    fetch(u).then((r) => (r.ok ? r.json() : null)),
  );

  const lines = linesSwr.data?.items ?? [];
  const variance = varianceSwr.data?.items ?? [];
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [projectLabel, setProjectLabel] = useState("");

  const refresh = useCallback(() => {
    void linesSwr.mutate();
    void varianceSwr.mutate();
  }, [linesSwr, varianceSwr]);

  useEffect(() => {
    // Project row lookup for the header context.
    fetch("/api/v1/projects")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { items?: { id: number; code: string; name: string }[] } | null) => {
        const p = d?.items?.find((x) => String(x.id) === projectId);
        if (p) setProjectLabel(`${p.code} — ${p.name}`);
      })
      .catch(() => {});
  }, [projectId]);

  function resetForm() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFieldErrors({});
    setMessage(null);
  }

  function startEdit(l: BudgetLine) {
    setEditingId(l.id);
    setForm({
      trade: l.trade,
      category: l.category,
      amountFils: (Number(l.amountFils) / 100).toFixed(2),
      sourceLabel: l.sourceLabel,
      refDate: l.refDate ? l.refDate.slice(0, 10) : "",
      note: l.note ?? "",
    });
    setFieldErrors({});
    setMessage(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setFieldErrors({});
    setMessage(null);
    const payload: Record<string, unknown> = {
      amountFils: form.amountFils,
      sourceLabel: form.sourceLabel,
      refDate: form.refDate || null,
      note: form.note || null,
    };
    if (!editingId) {
      payload.trade = form.trade;
      payload.category = form.category;
    }
    const res = await fetch(
      editingId ? `/api/v1/budget-lines/${editingId}` : `/api/v1/projects/${projectId}/budget-lines`,
      {
        method: editingId ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      },
    );
    if (res.ok) {
      resetForm();
      refresh();
      return;
    }
    const body = await res.json().catch(() => null);
    if (res.status === 422 && body?.error?.details) {
      const flat: Record<string, string[]> = {};
      for (const [k, v] of Object.entries(body.error.details as Record<string, string[]>)) {
        if (Array.isArray(v)) flat[k] = v;
      }
      setFieldErrors(flat);
    } else {
      setMessage(body?.error?.message ?? `Request failed (${res.status})`);
    }
  }

  async function remove(l: BudgetLine) {
    if (!window.confirm(`Delete ${l.trade}/${l.category} line (${formatAED(l.amountFils)})? This cannot be undone.`)) return;
    const res = await fetch(`/api/v1/budget-lines/${l.id}`, { method: "DELETE" });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setMessage(body?.error?.message ?? `Delete failed (${res.status})`);
      return;
    }
    refresh();
  }

  const inputCls =
    "w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600/30 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100";
  const labelCls = "mb-1 block text-xs font-medium uppercase tracking-wide text-zinc-500";

  return (
    <div className="flex flex-col gap-6">
      <PageHeader eyebrow="Administration · Projects · Budget" title="Budget vs committed" context={projectLabel || undefined} />

      <section className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="px-4 pt-4 text-base font-semibold text-zinc-900 dark:text-zinc-100">Variance by trade</h2>
        <p className="px-4 pb-3 text-xs text-zinc-500">
          Committed = latest non-cancelled LPOs. Bands: under &lt;90% · watch 90–100% · over &gt;100%.
        </p>
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-800/60">
            <tr>
              <th className="px-4 py-3">Trade</th>
              <th className="px-4 py-3 text-right">Budget</th>
              <th className="px-4 py-3 text-right">Committed</th>
              <th className="px-4 py-3 text-right">Utilization</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {variance.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-zinc-400">Loading…</td></tr>
            )}
            {variance.map((row) => {
              const s = STATUS_STYLES[row.status];
              return (
                <tr key={row.trade} className="border-t border-zinc-100 hover:bg-zinc-50 dark:border-zinc-800">
                  <td className="px-4 py-2.5 font-medium text-zinc-900 dark:text-zinc-100">{row.trade.replace(/_/g, " ")}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-zinc-900 dark:text-zinc-100">
                    {formatAED(row.budgetFils)}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-zinc-900 dark:text-zinc-100">
                    {formatAED(row.committedFils)}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-zinc-900 dark:text-zinc-100">
                    {row.status === "no_budget" || row.status === "no_spend" ? "—" : `${row.utilizationPct.toFixed(1)}%`}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${s.cls}`}>{s.label}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      {canWrite && (
        <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="mb-4 text-base font-semibold text-zinc-900 dark:text-zinc-100">
            {editingId ? "Edit budget line" : "New budget line"}
          </h2>
          <form onSubmit={submit} className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div>
              <label className={labelCls} htmlFor="b-trade">Trade</label>
              <select
                id="b-trade"
                className={inputCls}
                value={form.trade}
                disabled={!!editingId}
                onChange={(e) => setForm({ ...form, trade: e.target.value })}
              >
                {TRADES.map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls} htmlFor="b-cat">Category</label>
              <select
                id="b-cat"
                className={inputCls}
                value={form.category}
                disabled={!!editingId}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              >
                {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls} htmlFor="b-amount">Amount (AED)</label>
              <input
                id="b-amount"
                className={`${inputCls} tabular-nums`}
                placeholder="7000000.00"
                value={form.amountFils}
                onChange={(e) => setForm({ ...form, amountFils: e.target.value })}
              />
              {fieldErrors.amountFils?.[0] && <p className="mt-1 text-xs text-red-600">{fieldErrors.amountFils[0]}</p>}
            </div>
            <div>
              <label className={labelCls} htmlFor="b-source">Source</label>
              <input
                id="b-source"
                className={inputCls}
                placeholder="JCA Appendix I"
                value={form.sourceLabel}
                onChange={(e) => setForm({ ...form, sourceLabel: e.target.value })}
              />
              {fieldErrors.sourceLabel?.[0] && <p className="mt-1 text-xs text-red-600">{fieldErrors.sourceLabel[0]}</p>}
            </div>
            <div>
              <label className={labelCls} htmlFor="b-refdate">Reference date</label>
              <input
                id="b-refdate"
                type="date"
                className={inputCls}
                value={form.refDate}
                onChange={(e) => setForm({ ...form, refDate: e.target.value })}
              />
            </div>
            <div>
              <label className={labelCls} htmlFor="b-note">Note</label>
              <input
                id="b-note"
                className={inputCls}
                value={form.note}
                onChange={(e) => setForm({ ...form, note: e.target.value })}
              />
              {fieldErrors.note?.[0] && <p className="mt-1 text-xs text-red-600">{fieldErrors.note[0]}</p>}
            </div>

            {message && (
              <div className="md:col-span-3"><ErrorBanner message={message} /></div>
            )}

            <div className="flex items-center gap-3 md:col-span-3">
              <button
                type="submit"
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
              >
                {editingId ? "Save changes" : "Add line"}
              </button>
              {editingId && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200"
                >
                  Cancel
                </button>
              )}
            </div>
          </form>
        </section>
      )}

      <section className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        {(linesSwr.error || !linesSwr.data) && !linesSwr.isLoading ? (
          <div className="p-4"><ErrorBanner message="Could not load budget lines." /></div>
        ) : lines.length === 0 ? (
          <div className="p-4"><EmptyState title="No budget lines" body="Add the first line above to anchor variance." /></div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-800/60">
              <tr>
                <th className="px-4 py-3">Trade</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3">Source</th>
                <th className="px-4 py-3">Ref date</th>
                <th className="px-4 py-3">Note</th>
                {canWrite && <th className="px-4 py-3 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {lines.map((l) => (
                <tr key={l.id} className="border-t border-zinc-100 hover:bg-zinc-50 dark:border-zinc-800">
                  <td className="px-4 py-2.5 font-medium text-zinc-900 dark:text-zinc-100">{l.trade.replace(/_/g, " ")}</td>
                  <td className="px-4 py-2.5 text-zinc-700 dark:text-zinc-300">{l.category}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-zinc-900 dark:text-zinc-100">{formatAED(l.amountFils)}</td>
                  <td className="px-4 py-2.5 text-zinc-700 dark:text-zinc-300">{l.sourceLabel}</td>
                  <td className="px-4 py-2.5 text-zinc-500">{l.refDate ? l.refDate.slice(0, 10) : "—"}</td>
                  <td className="max-w-[16rem] truncate px-4 py-2.5 text-zinc-500">{l.note ?? "—"}</td>
                  {canWrite && (
                    <td className="px-4 py-2.5 text-right whitespace-nowrap">
                      <button onClick={() => startEdit(l)} className="text-indigo-600 hover:text-indigo-800">Edit</button>
                      {canDelete && (
                        <>
                          <span className="mx-2 text-zinc-300">·</span>
                          <button onClick={() => remove(l)} className="text-red-600 hover:text-red-800">Delete</button>
                        </>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
