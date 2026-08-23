"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import { PageHeader, EmptyState, ErrorBanner, KpiCard } from "@/components/ui/primitives";
import { StatusPill } from "@/components/ui/StatusPill";
import { useSession } from "@/hooks/use-app-data";

type Vo = {
  id: string;
  voNumber: number;
  title: string;
  status: "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED";
  submittedValueFils: string;
  approvedValueFils: string | null;
  approvedAt: string | null;
  approvalRef: string | null;
  _count: { lpos: number };
};

type Compliance = {
  unapprovedVoExposure: string;
  totalClaims: string;
  voCounts: Record<string, number>;
  openVos: number;
};

function formatAED(fils: string): string {
  const n = BigInt(fils);
  const sign = n < 0n ? "-" : "";
  const abs = sign ? -n : n;
  return `${sign}AED ${(abs / 100n).toLocaleString("en-US")}.${(abs % 100n).toString().padStart(2, "0")}`;
}

const EMPTY_FORM = {
  voNumber: "",
  title: "",
  submittedValueFils: "",
  status: "DRAFT",
  approvedValueFils: "",
  approvedAt: "",
  approvalRef: "",
};

export function VosClient({ projectId }: { projectId: string }) {
  const { session } = useSession();
  const role = session?.role ?? null;
  const canWrite = role === "ADMIN" || role === "COMMERCIAL";

  const vosSwr = useSWR<{ items: Vo[] }>(`/api/v1/projects/${projectId}/vos`, (u: string) =>
    fetch(u).then((r) => (r.ok ? r.json() : null)),
  );
  const complianceSwr = useSWR<Compliance>(`/api/v1/projects/${projectId}/vos/compliance`, (u: string) =>
    fetch(u).then((r) => (r.ok ? r.json() : null)),
  );
  const vos = vosSwr.data?.items ?? [];
  const compliance = complianceSwr.data;

  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingStatus, setEditingStatus] = useState<string>("DRAFT");
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
    setEditingStatus("DRAFT");
    setForm(EMPTY_FORM);
    setFieldErrors({});
    setMessage(null);
  }

  function startEdit(v: Vo) {
    setEditingId(v.id);
    setEditingStatus(v.status);
    setForm({
      voNumber: String(v.voNumber),
      title: v.title,
      submittedValueFils: (Number(v.submittedValueFils) / 100).toFixed(2),
      status: v.status,
      approvedValueFils: v.approvedValueFils ? (Number(v.approvedValueFils) / 100).toFixed(2) : "",
      approvedAt: v.approvedAt ? v.approvedAt.slice(0, 10) : "",
      approvalRef: v.approvalRef ?? "",
    });
    setFieldErrors({});
    setMessage(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setFieldErrors({});
    setMessage(null);
    let res: Response;
    if (editingId) {
      const payload: Record<string, unknown> = {
        title: form.title,
        submittedValueFils: form.submittedValueFils,
      };
      if (form.status !== editingStatus) payload.status = form.status;
      if (form.status === "APPROVED") {
        payload.approvedValueFils = form.approvedValueFils;
        payload.approvedAt = form.approvedAt ? new Date(form.approvedAt + "T12:00:00Z").toISOString() : null;
        payload.approvalRef = form.approvalRef || null;
      }
      res = await fetch(`/api/v1/vos/${editingId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
    } else {
      res = await fetch(`/api/v1/projects/${projectId}/vos`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          voNumber: form.voNumber,
          title: form.title,
          submittedValueFils: form.submittedValueFils,
          status: form.status,
        }),
      });
    }
    if (res.ok) {
      resetForm();
      void vosSwr.mutate();
      void complianceSwr.mutate();
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

  async function reject(v: Vo) {
    if (!window.confirm(`Reject VO${v.voNumber} "${v.title}"? This is terminal.`)) return;
    const res = await fetch(`/api/v1/vos/${v.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: "REJECTED" }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setMessage(body?.error?.message ?? `Transition failed (${res.status})`);
      return;
    }
    void vosSwr.mutate();
    void complianceSwr.mutate();
  }

  const inputCls =
    "w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600/30 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100";
  const labelCls = "mb-1 block text-xs font-medium uppercase tracking-wide text-zinc-500";

  const exposure = compliance ? BigInt(compliance.unapprovedVoExposure) : null;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader eyebrow="Administration · Projects · Variation orders" title="VO register" context={projectLabel || undefined} />

      {exposure !== null && exposure > 0n && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          <span className="font-semibold">Unapproved VO exposure: {formatAED(exposure.toString())}</span> — variation work
          claimed on certificates while {compliance?.openVos} VO(s) remain unapproved. Approval or rejection clears the exposure.
        </div>
      )}

      {compliance && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <KpiCard label="Claimed variations" value={formatAED(compliance.totalClaims)} sub="Σ PC variationClaimFils" />
          <KpiCard
            label="Open VOs"
            value={String(compliance.openVos)}
            sub={`of ${Object.values(compliance.voCounts).reduce((s, n) => s + n, 0)} total`}
          />
          <KpiCard
            label="Unapproved exposure"
            value={formatAED(compliance.unapprovedVoExposure)}
            sub={exposure === 0n ? "fully covered" : "aggregate attribution (legacy data)"}
          />
        </div>
      )}

      {message && <ErrorBanner message={message} />}

      {canWrite && (
        <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="mb-4 text-base font-semibold text-zinc-900 dark:text-zinc-100">
            {editingId ? `Edit VO #${form.voNumber}` : "Raise variation order"}
          </h2>
          <form onSubmit={submit} className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <div>
              <label className={labelCls} htmlFor="vo-num">VO number</label>
              <input
                id="vo-num"
                type="number"
                min="1"
                className={`${inputCls} tabular-nums`}
                value={form.voNumber}
                disabled={!!editingId}
                onChange={(e) => setForm({ ...form, voNumber: e.target.value })}
              />
              {fieldErrors.voNumber?.[0] && <p className="mt-1 text-xs text-red-600">{fieldErrors.voNumber[0]}</p>}
            </div>
            <div className="md:col-span-2">
              <label className={labelCls} htmlFor="vo-title">Title</label>
              <input id="vo-title" className={inputCls} placeholder="Storm water reroute"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })} />
              {fieldErrors.title?.[0] && <p className="mt-1 text-xs text-red-600">{fieldErrors.title[0]}</p>}
            </div>
            {!editingId && (
              <div>
                <label className={labelCls} htmlFor="vo-status">Status at creation</label>
                <select id="vo-status" className={inputCls} value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}>
                  <option>DRAFT</option>
                  <option>SUBMITTED</option>
                </select>
              </div>
            )}
            {editingId && (editingStatus === "DRAFT" || editingStatus === "SUBMITTED") && (
              <>
                <div>
                  <label className={labelCls} htmlFor="vo-next">Move to</label>
                  <select id="vo-next" className={inputCls} value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value })}>
                    <option value={editingStatus}>{editingStatus} (no change)</option>
                    {editingStatus === "DRAFT" && <option>SUBMITTED</option>}
                    <option>APPROVED</option>
                    <option>REJECTED</option>
                  </select>
                </div>
                {form.status === "APPROVED" && (
                  <>
                    <div>
                      <label className={labelCls} htmlFor="vo-appval">Approved value (AED)</label>
                      <input id="vo-appval" className={`${inputCls} tabular-nums`}
                        value={form.approvedValueFils}
                        onChange={(e) => setForm({ ...form, approvedValueFils: e.target.value })} />
                      {fieldErrors.approvedValueFils?.[0] && (
                        <p className="mt-1 text-xs text-red-600">{fieldErrors.approvedValueFils[0]}</p>
                      )}
                    </div>
                    <div>
                      <label className={labelCls} htmlFor="vo-appat">Approved on</label>
                      <input id="vo-appat" type="date" className={inputCls} value={form.approvedAt}
                        onChange={(e) => setForm({ ...form, approvedAt: e.target.value })} />
                      {fieldErrors.approvedAt?.[0] && <p className="mt-1 text-xs text-red-600">{fieldErrors.approvedAt[0]}</p>}
                    </div>
                    <div className="md:col-span-2">
                      <label className={labelCls} htmlFor="vo-ref">Approval reference</label>
                      <input id="vo-ref" className={inputCls} placeholder="JCA-VO-901-R1"
                        value={form.approvalRef}
                        onChange={(e) => setForm({ ...form, approvalRef: e.target.value })} />
                    </div>
                  </>
                )}
              </>
            )}
            <div>
              <label className={labelCls} htmlFor="vo-val">Submitted value (AED)</label>
              <input id="vo-val" className={`${inputCls} tabular-nums`} placeholder="500000.00"
                value={form.submittedValueFils}
                onChange={(e) => setForm({ ...form, submittedValueFils: e.target.value })} />
              {fieldErrors.submittedValueFils?.[0] && (
                <p className="mt-1 text-xs text-red-600">{fieldErrors.submittedValueFils[0]}</p>
              )}
            </div>

            <div className="flex items-center gap-3 md:col-span-4">
              <button
                type="submit"
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
              >
                {editingId ? "Save changes" : "Add VO"}
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
          <p className="mt-3 text-xs text-zinc-500">
            Approvals are made from the table: approving requires an approved value and date; the approval reference is recorded in the audit log.
          </p>
        </section>
      )}

      <section className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        {!vosSwr.data ? (
          <div className="p-4"><EmptyState title="Loading…" body="Fetching variation orders." /></div>
        ) : vos.length === 0 ? (
          <div className="p-4">
            <EmptyState
              title="No variation orders recorded"
              body="PC13 references 11 submitted VOs absent from the legacy data — see the VO_BACKFILL flag."
            />
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-800/60">
              <tr>
                <th className="px-4 py-3">VO</th>
                <th className="px-4 py-3">Title</th>
                <th className="px-4 py-3 text-right">Submitted</th>
                <th className="px-4 py-3 text-right">Approved</th>
                <th className="px-4 py-3">Approved at</th>
                <th className="px-4 py-3">Ref</th>
                <th className="px-4 py-3 text-right">LPOs</th>
                <th className="px-4 py-3">Status</th>
                {canWrite && <th className="px-4 py-3 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {vos.map((v) => (
                <tr key={v.id} className="border-t border-zinc-100 hover:bg-zinc-50 dark:border-zinc-800">
                  <td className="px-4 py-2.5 font-medium tabular-nums text-zinc-900 dark:text-zinc-100">{v.voNumber}</td>
                  <td className="px-4 py-2.5 text-zinc-700 dark:text-zinc-300">{v.title}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-zinc-900 dark:text-zinc-100">{formatAED(v.submittedValueFils)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-zinc-700 dark:text-zinc-300">
                    {v.approvedValueFils ? formatAED(v.approvedValueFils) : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-zinc-500">{v.approvedAt ? v.approvedAt.slice(0, 10) : "—"}</td>
                  <td className="px-4 py-2.5 text-zinc-500">{v.approvalRef ?? "—"}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-zinc-700 dark:text-zinc-300">{v._count.lpos}</td>
                  <td className="px-4 py-2.5"><StatusPill domain="vo" value={v.status} /></td>
                  {canWrite && (
                    <td className="whitespace-nowrap px-4 py-2.5 text-right">
                      {(v.status === "DRAFT" || v.status === "SUBMITTED") && (
                        <>
                          <button onClick={() => startEdit(v)} className="text-emerald-700 hover:text-emerald-900">Approve…</button>
                          <span className="mx-2 text-zinc-300">·</span>
                          <button onClick={() => reject(v)} className="text-red-600 hover:text-red-800">Reject</button>
                          <span className="mx-2 text-zinc-300">·</span>
                        </>
                      )}
                      <button onClick={() => startEdit(v)} className="text-indigo-600 hover:text-indigo-800">Edit</button>
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
