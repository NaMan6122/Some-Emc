"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { EmptyState } from "@/components/ui/primitives";
import { useSession } from "@/hooks/use-app-data";

type AdminUser = {
  id: number;
  name: string;
  email: string;
  role: string;
  active: boolean;
  createdAt: string;
};

const ROLES = ["ADMIN", "MANAGEMENT", "PROCUREMENT", "COMMERCIAL", "FINANCE", "VIEWER"];

const selectCls =
  "rounded-lg border border-zinc-300 bg-white px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-900";
const inputCls =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100";

// spec-024-v1: user lifecycle administration (ADMIN only; API enforces the
// same gate). One-time passwords are revealed once with copy support.
export function UsersAdminClient() {
  const { session } = useSession();
  const isAdmin = session?.role === "ADMIN";

  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [otp, setOtp] = useState<{ email: string; password: string } | null>(null);
  const [form, setForm] = useState({ name: "", email: "", role: "VIEWER" });
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/v1/users");
    if (res.ok) setUsers((await res.json()).items);
  }, []);

  useEffect(() => {
    if (isAdmin) void load();
  }, [isAdmin, load]);

  const activeCount = useMemo(() => (users ?? []).filter((u) => u.active).length, [users]);

  async function createUser() {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/v1/users", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        const b = await res.json();
        setOtp({ email: b.email, password: b.oneTimePassword });
        setMsg({ ok: true, text: `User ${b.name} created.` });
        setForm({ name: "", email: "", role: "VIEWER" });
        await load();
      } else {
        const b = await res.json().catch(() => null);
        setMsg({ ok: false, text: b?.error?.message ?? `Failed (${res.status})` });
      }
    } finally {
      setBusy(false);
    }
  }

  async function patch(id: number, body: Record<string, unknown>, okText: string) {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/v1/users/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const b = await res.json();
        await load();
        if (b.oneTimePassword) setOtp({ email: b.user.email, password: b.oneTimePassword });
        else setMsg({ ok: true, text: okText });
      } else {
        const b = await res.json().catch(() => null);
        setMsg({ ok: false, text: b?.error?.message ?? `Failed (${res.status})` });
      }
    } finally {
      setBusy(false);
    }
  }

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-3xl">
        <EmptyState title="Users" body="Administrator access required." />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Administration</p>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">Users</h1>
        <p className="mt-0.5 text-sm text-zinc-500">
          {activeCount} active of {(users ?? []).length} total · deactivation revokes sessions instantly and preserves audit history.
        </p>
      </div>

      {otp && (
        <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4 dark:border-indigo-900 dark:bg-indigo-950" data-testid="otp-reveal">
          <p className="text-sm font-semibold text-indigo-900 dark:text-indigo-200">
            One-time password for {otp.email} — shown only now:
          </p>
          <div className="mt-2 flex items-center gap-3">
            <code className="rounded-lg bg-white px-3 py-1.5 font-mono text-sm dark:bg-zinc-900">{otp.password}</code>
            <button
              onClick={() => void navigator.clipboard.writeText(otp.password)}
              className="rounded-lg border border-indigo-300 px-2 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-100 dark:border-indigo-800 dark:text-indigo-300"
            >
              Copy
            </button>
            <button onClick={() => setOtp(null)} className="ml-auto text-zinc-400 hover:text-zinc-600">
              Dismiss ✕
            </button>
          </div>
        </div>
      )}

      {msg && (
        <div
          role="status"
          className={`flex items-center justify-between rounded-lg border px-4 py-2 text-sm ${
            msg.ok
              ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200"
              : "border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200"
          }`}
        >
          {msg.text}
          <button className="ml-3 text-zinc-400" onClick={() => setMsg(null)}>✕</button>
        </div>
      )}

      <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Create user</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_auto_auto]">
          <input aria-label="Full name" placeholder="Full name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputCls} />
          <input aria-label="Email" type="email" placeholder="name@company.ae" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={inputCls} />
          <select aria-label="Role" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className={`${inputCls} sm:w-40`}>
            {ROLES.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
          <button
            onClick={() => void createUser()}
            disabled={busy || !form.name || !form.email}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
          >
            Create
          </button>
        </div>
        <p className="mt-1.5 text-xs text-zinc-500">Leave password generation to ProCare — a one-time password is produced automatically.</p>
      </section>

      {!users ? (
        <div className="h-64 animate-pulse rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900" aria-busy="true" />
      ) : users.length === 0 ? (
        <EmptyState title="No users" body="Create the first account above." />
      ) : (
        <section className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-800/60">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Created</th>
                <th className="px-4 py-3 text-right"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className={`border-t border-zinc-100 hover:bg-zinc-50 dark:border-zinc-800 ${!u.active ? "opacity-60" : ""}`}>
                  <td className="px-4 py-2.5 font-medium text-zinc-900 dark:text-zinc-100">{u.name}</td>
                  <td className="px-4 py-2.5 text-zinc-500">{u.email}</td>
                  <td className="px-4 py-2.5">
                    <select
                      aria-label={`Role for ${u.email}`}
                      value={u.role}
                      disabled={busy || u.id === session?.id}
                      onChange={(e) => void patch(u.id, { role: e.target.value }, `Role updated for ${u.name}`)}
                      className={selectCls}
                    >
                      {ROLES.map((r) => (
                        <option key={r}>{r}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${u.active ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"}`}>
                      {u.active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-zinc-500">{u.createdAt?.slice(0, 10)}</td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-right">
                    <span className="flex justify-end gap-2">
                      <button
                        disabled={busy}
                        onClick={() => void patch(u.id, { resetPassword: true }, `Password reset for ${u.name}`)}
                        className="rounded-lg border border-zinc-300 px-2 py-1 text-xs font-medium hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
                      >
                        Reset password
                      </button>
                      {u.id !== session?.id && (
                        <button
                          disabled={busy}
                          onClick={() =>
                            window.confirm(u.active ? `Deactivate ${u.name}? Their sessions end immediately.` : `Reactivate ${u.name}?`) &&
                            void patch(u.id, { active: !u.active }, u.active ? `${u.name} deactivated` : `${u.name} reactivated`)
                          }
                          className={`rounded-lg border px-2 py-1 text-xs font-medium disabled:opacity-50 ${
                            u.active
                              ? "border-red-300 text-red-600 hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950"
                              : "border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-900 dark:hover:bg-emerald-950"
                          }`}
                        >
                          {u.active ? "Deactivate" : "Reactivate"}
                        </button>
                      )}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
