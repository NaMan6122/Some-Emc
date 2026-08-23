"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import { PageHeader, EmptyState, ErrorBanner } from "@/components/ui/primitives";
import { StatusPill, ProvenanceChip } from "@/components/ui/StatusPill";
import { useSession } from "@/hooks/use-app-data";

type Pc = {
  id: string;
  pcNumber: number;
  periodLabel: string;
  periodStart: string | null;
  periodEnd: string | null;
  invoiceDate: string | null;
  grossFils: string;
  retentionFils: string;
  netPayableFils: string;
  variationClaimFils: string;
  statedCumulativeFils: string | null;
  status: "DRAFT" | "SUBMITTED" | "CERTIFIED" | "PAID";
  provenance: string;
  notes: string | null;
};

const NEXT_STATUS: Record<Pc["status"], Pc["status"] | null> = {
  DRAFT: "SUBMITTED",
  SUBMITTED: "CERTIFIED",
  CERTIFIED: "PAID",
  PAID: null,
};

function formatAED(fils: string): string {
  const n = BigInt(fils);
  const sign = n < 0n ? "-" : "";
  const abs = sign ? -n : n;
  return `${sign}AED ${(abs / 100n).toLocaleString("en-US")}.${(abs % 100n).toString().padStart(2, "0")}`;
}

function dateOnly(iso: string | null): string {
  return iso ? iso.slice(0, 10) : "—";
}

const EMPTY_FORM = {
  pcNumber: "",
  periodLabel: "",
  invoiceDate: "",
  grossFils: "",
  retentionFils: "0.00",
  netPayableFils: "",
  variationClaimFils: "0.00",
  statedCumulativeFils: "",
  provenance: "SOURCE_DOCUMENT",
  notes: "",
};

export function PcsClient({ projectId }: { projectId: string }) {
  const { session } = useSession();
  const role = session?.role ?? null;
  const canWrite = role === "ADMIN" || role === "FINANCE";

  const pcsSwr = useSWR<{ items: Pc[] }>(`/api/v1/projects/${projectId}/pcs`, (u: string) =>
    fetch(u).then((r) => (r.ok ? r.json() : null)),
  );
  const pcs = pcsSwr.data?.items ?? [];

  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [projectLabel, setProjectLabel] = useState("");

  useEffect(() => {
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

  function startEdit(p: Pc) {
    setEditingId(p.id);
    setForm({
      pcNumber: String(p.pcNumber),
      periodLabel: p.periodLabel,
      invoiceDate: p.invoiceDate ? p.invoiceDate.slice(0, 10) : "",
      grossFils: (Number(p.grossFils) / 100).toFixed(2),
      retentionFils: (Number(p.retentionFils) / 100).toFixed(2),
      netPayableFils: (Number(p.netPayableFils) / 100).toFixed(2),
      variationClaimFils: (Number(p.variationClaimFils) / 100).toFixed(2),
      statedCumulativeFils: p.statedCumulativeFils ? (Number(p.statedCumulativeFils) / 100).toFixed(2) : "",
      provenance: p.provenance,
      notes: p.notes ?? "",
    });
    setFieldErrors({});
    setMessage(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setFieldErrors({});
    setMessage(null);
    const payload: Record<string, unknown> = {
      periodLabel: form.periodLabel,
      invoiceDate: form.invoiceDate || null,
      grossFils: form.grossFils,
      retentionFils: form.retentionFils || "0.00",
      netPayableFils: form.netPayableFils,
      variationClaimFils: form.variationClaimFils || "0.00",
      statedCumulativeFils: form.statedCumulativeFils || null,
      provenance: form.provenance,
      notes: form.notes || null,
    };
    if (!editingId) payload.pcNumber = form.pcNumber;

    const res = await fetch(editingId ? `/api/v1/pcs/${editingId}` : `/api/v1/projects/${projectId}/pcs`, {
      method: editingId ? "PATCH" : "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      resetForm();
      void pcsSwr.mutate();
      return;
    }
    const body = await res.json().catch(() => null);
    if (res.status === 422 && body?.error?.details && typeof body.error.details === "object") {
      const flat: Record<string, string[]> = {};
      for (const [k, v] of Object.entries(body.error.details as Record<string, string[]>)) {
        if (Array.isArray(v)) flat[k] = v;
      }
      setFieldErrors(flat);
    }
    setMessage(body?.error?.message ?? `Request failed (${res.status})`);
  }

  async function advance(p: Pc) {
    const next = NEXT_STATUS[p.status];
    if (!next || !window.confirm(`Move PC${p.pcNumber} to ${next}?`)) return;
    const res = await fetch(`/api/v1/pcs/${p.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setMessage(body?.error?.message ?? `Transition failed (${res.status})`);
      return;
    }
    void pcsSwr.mutate();
  }

  async function remove(p: Pc) {
    if (!window.confirm(`Delete PC${p.pcNumber} (${formatAED(p.netPayableFils)})? This cannot be undone.`)) return;
    const res = await fetch(`/api/v1/pcs/${p.id}`, { method: "DELETE" });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setMessage(body?.error?.message ?? `Delete failed (${res.status})`);
      return;
    }
    void pcsSwr.mutate();
  }

  const inputCls =
    "w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600/30 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100";
  const labelCls = "mb-1 block text-xs font-medium uppercase tracking-wide text-zinc-500";

  return (
    <div className="flex flex-col gap-6">
      <PageHeader eyebrow="Administration · Projects · Payment certificates" title="PC log" context={projectLabel || undefined} />

      {message && <ErrorBanner message={message} />}

      {canWrite && (
        <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="mb-4 text-base font-semibold text-zinc-900 dark:text-zinc-100">
            {editingId ? `Edit PC #${form.pcNumber}` : "New payment certificate"}
          </h2>
          <form onSubmit={submit} className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <div>
              <label className={labelCls} htmlFor="pc-num">PC number</label>
              <input
                id="pc-num"
                type="number"
                min="1"
                className={`${inputCls} tabular-nums`}
                value={form.pcNumber}
                disabled={!!editingId}
                onChange={(e) => setForm({ ...form, pcNumber: e.target.value })}
              />
              {fieldErrors.pcNumber?.[0] && <p className="mt-1 text-xs text-red-600">{fieldErrors.pcNumber[0]}</p>}
            </div>
            <div>
              <label className={labelCls} htmlFor="pc-period">Period label</label>
              <input id="pc-period" className={inputCls} placeholder="Jun 2025"
                value={form.periodLabel}
                onChange={(e) => setForm({ ...form, periodLabel: e.target.value })} />
              {fieldErrors.periodLabel?.[0] && <p className="mt-1 text-xs text-red-600">{fieldErrors.periodLabel[0]}</p>}
            </div>
            <div>
              <label className={labelCls} htmlFor="pc-inv">Invoice date</label>
              <input id="pc-inv" type="date" className={inputCls} value={form.invoiceDate}
                onChange={(e) => setForm({ ...form, invoiceDate: e.target.value })} />
            </div>
            <div>
              <label className={labelCls} htmlFor="pc-prov">Provenance</label>
              <select id="pc-prov" className={inputCls} value={form.provenance}
                onChange={(e) => setForm({ ...form, provenance: e.target.value })}>
                <option value="SOURCE_DOCUMENT">SOURCE_DOCUMENT</option>
                <option value="OCR_ESTIMATE">OCR_ESTIMATE</option>
                <option value="CLIENT_SUMMARY">CLIENT_SUMMARY</option>
                <option value="DERIVED">DERIVED</option>
                <option value="IMPORTED_REPORT">IMPORTED_REPORT</option>
              </select>
            </div>
            <div>
              <label className={labelCls} htmlFor="pc-gross">Gross (AED)</label>
              <input id="pc-gross" className={`${inputCls} tabular-nums`} placeholder="1210258.00"
                value={form.grossFils}
                onChange={(e) => setForm({ ...form, grossFils: e.target.value })} />
              {fieldErrors.grossFils?.[0] && <p className="mt-1 text-xs text-red-600">{fieldErrors.grossFils[0]}</p>}
            </div>
            <div>
              <label className={labelCls} htmlFor="pc-ret">Retention (AED)</label>
              <input id="pc-ret" className={`${inputCls} tabular-nums`}
                value={form.retentionFils}
                onChange={(e) => setForm({ ...form, retentionFils: e.target.value })} />
              {fieldErrors.retentionFils?.[0] && <p className="mt-1 text-xs text-red-600">{fieldErrors.retentionFils[0]}</p>}
            </div>
            <div>
              <label className={labelCls} htmlFor="pc-net">Net payable (AED)</label>
              <input id="pc-net" className={`${inputCls} tabular-nums`}
                value={form.netPayableFils}
                onChange={(e) => setForm({ ...form, netPayableFils: e.target.value })} />
              {fieldErrors.netPayableFils?.[0] && <p className="mt-1 text-xs text-red-600">{fieldErrors.netPayableFils[0]}</p>}
            </div>
            <div>
              <label className={labelCls} htmlFor="pc-var">Variation claim (AED)</label>
              <input id="pc-var" className={`${inputCls} tabular-nums`}
                value={form.variationClaimFils}
                onChange={(e) => setForm({ ...form, variationClaimFils: e.target.value })} />
            </div>
            <div>
              <label className={labelCls} htmlFor="pc-cum">Stated cumulative (AED, optional)</label>
              <input id="pc-cum" className={`${inputCls} tabular-nums`}
                value={form.statedCumulativeFils}
                onChange={(e) => setForm({ ...form, statedCumulativeFils: e.target.value })} />
            </div>
            <div className="md:col-span-2">
              <label className={labelCls} htmlFor="pc-notes">Notes</label>
              <input id="pc-notes" className={inputCls} value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>

            <div className="flex items-center gap-3 md:col-span-4">
              <button
                type="submit"
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
              >
                {editingId ? "Save changes" : "Add certificate"}
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
        {!pcsSwr.data ? (
          <div className="p-4"><EmptyState title="Loading…" body="Fetching payment certificates." /></div>
        ) : pcs.length === 0 ? (
          <div className="p-4"><EmptyState title="No payment certificates" body="Add the first certificate above." /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-800/60">
                <tr>
                  <th className="px-4 py-3">PC</th>
                  <th className="px-4 py-3">Period</th>
                  <th className="px-4 py-3">Invoice</th>
                  <th className="px-4 py-3 text-right">Gross</th>
                  <th className="px-4 py-3 text-right">Retention</th>
                  <th className="px-4 py-3 text-right">Net payable</th>
                  <th className="px-4 py-3 text-right">Var claim</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Provenance</th>
                  {canWrite && <th className="px-4 py-3 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {pcs.map((p) => (
                  <tr key={p.id} className="border-t border-zinc-100 hover:bg-zinc-50 dark:border-zinc-800">
                    <td className="px-4 py-2.5 font-medium tabular-nums text-zinc-900 dark:text-zinc-100">{p.pcNumber}</td>
                    <td className="px-4 py-2.5 text-zinc-700 dark:text-zinc-300">{p.periodLabel}</td>
                    <td className="px-4 py-2.5 text-zinc-500">{dateOnly(p.invoiceDate)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-zinc-900 dark:text-zinc-100">{formatAED(p.grossFils)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-zinc-700 dark:text-zinc-300">{formatAED(p.retentionFils)}</td>
                    <td className="px-4 py-2.5 text-right font-medium tabular-nums text-zinc-900 dark:text-zinc-100">{formatAED(p.netPayableFils)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-zinc-500">
                      {p.variationClaimFils === "0" ? "—" : formatAED(p.variationClaimFils)}
                    </td>
                    <td className="px-4 py-2.5"><StatusPill domain="pc" value={p.status} /></td>
                    <td className="px-4 py-2.5"><ProvenanceChip value={p.provenance} /></td>
                    {canWrite && (
                      <td className="whitespace-nowrap px-4 py-2.5 text-right">
                        {NEXT_STATUS[p.status] && (
                          <>
                            <button onClick={() => advance(p)} className="text-emerald-700 hover:text-emerald-900">
                              → {NEXT_STATUS[p.status]}
                            </button>
                            <span className="mx-2 text-zinc-300">·</span>
                          </>
                        )}
                        <button onClick={() => startEdit(p)} className="text-indigo-600 hover:text-indigo-800">Edit</button>
                        <span className="mx-2 text-zinc-300">·</span>
                        <button onClick={() => remove(p)} className="text-red-600 hover:text-red-800">Delete</button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t border-zinc-200 bg-zinc-50 text-right dark:border-zinc-800 dark:bg-zinc-800/40">
                <tr>
                  <td colSpan={7} className="px-4 py-2.5 text-xs uppercase tracking-wide text-zinc-500">
                    Σ net payable ({pcs.length} certificates)
                  </td>
                  <td colSpan={canWrite ? 3 : 2} className="px-4 py-2.5 font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
                    {formatAED(pcs.reduce((s, p) => s + BigInt(p.netPayableFils), 0n).toString())}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
