"use client";

import { useCallback, useEffect, useState } from "react";

type Project = {
  id: number;
  code: string;
  name: string;
  mainContractor: string;
  contractValueFils: string; // jsonSafe: BigInt → decimal string
  vatRate: string; // Prisma Decimal → string
  status: "ACTIVE" | "ON_HOLD" | "CLOSED";
};

type FieldErrors = Record<string, { _errors?: string[] }>;

const EMPTY_FORM = {
  code: "",
  name: "",
  mainContractor: "",
  contractValueFils: "",
  vatRate: "0.05",
  status: "ACTIVE",
};

function formatAED(fils: string): string {
  const n = BigInt(fils);
  const whole = n / 100n;
  const frac = (n % 100n).toString().padStart(2, "0");
  return `AED ${whole.toLocaleString("en-US")}.${frac}`;
}

export function ProjectsClient() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/v1/projects");
    if (res.ok) setProjects((await res.json()).items);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function startEdit(p: Project) {
    setEditingId(p.id);
    setForm({
      code: p.code,
      name: p.name,
      mainContractor: p.mainContractor,
      contractValueFils: (Number(p.contractValueFils) / 100).toFixed(2),
      vatRate: p.vatRate,
      status: p.status,
    });
    setFieldErrors({});
    setMessage(null);
  }

  function resetForm() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFieldErrors({});
    setMessage(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setFieldErrors({});
    setMessage(null);
    const payload = {
      code: form.code,
      name: form.name,
      mainContractor: form.mainContractor,
      contractValueFils: form.contractValueFils,
      vatRate: Number(form.vatRate),
      status: form.status,
    };
    const res = await fetch(editingId ? `/api/v1/projects/${editingId}` : "/api/v1/projects", {
      method: editingId ? "PATCH" : "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.ok || res.status === 201) {
      resetForm();
      await load();
      return;
    }
    const body = await res.json().catch(() => null);
    if (res.status === 422 && body?.error?.details) setFieldErrors(body.error.details as FieldErrors);
    else setMessage(body?.error?.message ?? `Request failed (${res.status})`);
  }

  async function remove(p: Project) {
    if (!window.confirm(`Delete project ${p.code}? This cannot be undone.`)) return;
    const res = await fetch(`/api/v1/projects/${p.id}`, { method: "DELETE" });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setMessage(body?.error?.message ?? `Delete failed (${res.status})`);
      return;
    }
    await load();
  }

  const inputCls =
    "w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600/30";
  const labelCls = "mb-1 block text-xs font-medium uppercase tracking-wide text-zinc-500";

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-base font-semibold text-zinc-900">
          {editingId ? `Edit project #${editingId}` : "New project"}
        </h2>
        <form onSubmit={submit} className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div>
            <label className={labelCls} htmlFor="p-code">Code</label>
            <input id="p-code" className={inputCls} value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })} />
            {fieldErrors.code?._errors?.[0] && <p className="mt-1 text-xs text-red-600">{fieldErrors.code._errors[0]}</p>}
          </div>
          <div>
            <label className={labelCls} htmlFor="p-name">Name</label>
            <input id="p-name" className={inputCls} value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })} />
            {fieldErrors.name?._errors?.[0] && <p className="mt-1 text-xs text-red-600">{fieldErrors.name._errors[0]}</p>}
          </div>
          <div>
            <label className={labelCls} htmlFor="p-contractor">Main contractor</label>
            <input id="p-contractor" className={inputCls} value={form.mainContractor}
              onChange={(e) => setForm({ ...form, mainContractor: e.target.value })} />
            {fieldErrors.mainContractor?._errors?.[0] &&
              <p className="mt-1 text-xs text-red-600">{fieldErrors.mainContractor._errors[0]}</p>}
          </div>
          <div>
            <label className={labelCls} htmlFor="p-value">Contract value (AED)</label>
            <input id="p-value" className={`${inputCls} tabular-nums`} placeholder="18786625.00"
              value={form.contractValueFils}
              onChange={(e) => setForm({ ...form, contractValueFils: e.target.value })} />
            {fieldErrors.contractValueFils?._errors?.[0] &&
              <p className="mt-1 text-xs text-red-600">{fieldErrors.contractValueFils._errors[0]}</p>}
          </div>
          <div>
            <label className={labelCls} htmlFor="p-vat">VAT rate (0–1)</label>
            <input id="p-vat" type="number" step="0.0001" min="0" max="1" className={`${inputCls} tabular-nums`}
              value={form.vatRate} onChange={(e) => setForm({ ...form, vatRate: e.target.value })} />
            {fieldErrors.vatRate?._errors?.[0] && <p className="mt-1 text-xs text-red-600">{fieldErrors.vatRate._errors[0]}</p>}
          </div>
          <div>
            <label className={labelCls} htmlFor="p-status">Status</label>
            <select id="p-status" className={inputCls} value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value as Project["status"] })}>
              <option>ACTIVE</option>
              <option>ON_HOLD</option>
              <option>CLOSED</option>
            </select>
          </div>

          {message && (
            <p role="alert" className="md:col-span-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {message}
            </p>
          )}

          <div className="flex items-center gap-3 md:col-span-3">
            <button type="submit"
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600">
              {editingId ? "Save changes" : "Create project"}
            </button>
            {editingId && (
              <button type="button" onClick={resetForm} className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50">
                Cancel
              </button>
            )}
          </div>
        </form>
      </section>

      <section className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="px-4 py-3">Code</th>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Main contractor</th>
              <th className="px-4 py-3 text-right">Contract value</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-zinc-400">Loading…</td></tr>
            )}
            {!loading && projects.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-zinc-400">No projects yet — create the first one above.</td></tr>
            )}
            {projects.map((p) => (
              <tr key={p.id} className="border-t border-zinc-100 hover:bg-zinc-50">
                <td className="px-4 py-3 font-medium text-zinc-900">{p.code}</td>
                <td className="px-4 py-3 text-zinc-700">{p.name}</td>
                <td className="px-4 py-3 text-zinc-700">{p.mainContractor}</td>
                <td className="px-4 py-3 text-right tabular-nums text-zinc-900">{formatAED(p.contractValueFils)}</td>
                <td className="px-4 py-3">
                  <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                    p.status === "ACTIVE" ? "bg-emerald-50 text-emerald-700"
                    : p.status === "ON_HOLD" ? "bg-amber-50 text-amber-700"
                    : "bg-zinc-100 text-zinc-500"}`}>
                    {p.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-right whitespace-nowrap">
                  <a href={`/admin/projects/${p.id}/budget`} className="text-indigo-600 hover:text-indigo-800">Budget</a>
                  <span className="mx-2 text-zinc-300">·</span>
                  <a href={`/admin/projects/${p.id}/pcs`} className="text-indigo-600 hover:text-indigo-800">PCs</a>
                  <span className="mx-2 text-zinc-300">·</span>
                  <button onClick={() => startEdit(p)} className="text-indigo-600 hover:text-indigo-800">Edit</button>
                  <span className="mx-2 text-zinc-300">·</span>
                  <button onClick={() => remove(p)} className="text-red-600 hover:text-red-800">Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
