"use client";

import { Fragment, useState } from "react";
import useSWR from "swr";
import { EmptyState } from "@/components/ui/primitives";
import { useProjectContext, useSession } from "@/hooks/use-app-data";

type Flag = {
  id: string;
  entityType: string;
  entityId: string;
  ruleCode: string;
  severity: string;
  message: string;
  status: string;
  assigneeId: number | null;
  resolutionNote: string | null;
  resolvedAt: string | null;
  createdAt: string;
};

type QueueData = {
  items: Flag[];
  meta?: { openBySeverity?: Record<string, number> };
};

type QueueUser = { id: number; name: string; role: string };

const SEVERITY_DOT: Record<string, string> = {
  HIGH: "bg-red-500",
  MEDIUM: "bg-amber-500",
  LOW: "bg-sky-500",
};

const STATUS_PILL: Record<string, string> = {
  OPEN: "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300",
  RESOLVED: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  WONT_FIX: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
};

// spec-016-v1: roles that may triage at least one flag domain. The server
// enforces the per-entityType domain map; a 403 here means "wrong domain"
// and its message surfaces in the toast.
const TRIAGE_ROLES = ["ADMIN", "PROCUREMENT", "COMMERCIAL", "FINANCE"];

function assigneeLabel(flag: Flag, users: QueueUser[] | undefined): string {
  if (flag.assigneeId == null) return "—";
  return users?.find((u) => u.id === flag.assigneeId)?.name ?? `#${flag.assigneeId}`;
}

export function FlagsClient() {
  const { code } = useProjectContext();
  const { session } = useSession();
  const canTriage = !!session && TRIAGE_ROLES.includes(session.role);
  const [showResolved, setShowResolved] = useState(false);
  const [mineOnly, setMineOnly] = useState(false);
  const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(null);
  const [noteFor, setNoteFor] = useState<{ flagId: string; action: "RESOLVED" | "WONT_FIX"; value: string } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const flagsSwr = useSWR<QueueData>("/api/v1/flags?limit=200", (u: string) =>
    fetch(u).then((r) => (r.ok ? r.json() : null)),
  );
  const usersSwr = useSWR<{ items: QueueUser[] }>(canTriage ? "/api/v1/users" : null, (u: string) =>
    fetch(u).then((r) => (r.ok ? r.json() : null)),
  );

  const all = flagsSwr.data?.items ?? [];
  const items = all.filter((f) => {
    if (!showResolved && f.status !== "OPEN") return false;
    if (mineOnly && f.assigneeId !== session?.id) return false;
    return true;
  });
  const counts = flagsSwr.data?.meta?.openBySeverity ?? {};
  const openTotal = Object.values(counts).reduce((s, n) => s + n, 0);

  async function patchFlag(id: string, body: Record<string, unknown>, okText: string) {
    setBusyId(id);
    try {
      const res = await fetch(`/api/v1/flags/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setToast({ ok: true, text: okText });
        setNoteFor(null);
        await flagsSwr.mutate();
      } else {
        const err = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
        setToast({ ok: false, text: err?.error?.message ?? `Update failed (${res.status})` });
      }
    } finally {
      setBusyId(null);
    }
  }

  if (!flagsSwr.data) {
    return (
      <div
        className="h-64 animate-pulse rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
        aria-busy="true"
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Governance{code ? ` · ${code}` : ""}</p>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">Data Flags</h1>
        <p className="mt-0.5 text-sm text-zinc-500">Data-quality review queue{canTriage ? "" : " (read-only)"}.</p>
      </div>

      <div className="flex gap-2" aria-label="Open flags by severity">
        {(["HIGH", "MEDIUM", "LOW"] as const).map((sev) => (
          <span
            key={sev}
            className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 px-2.5 py-1 text-xs font-medium text-zinc-700 dark:border-zinc-700 dark:text-zinc-300"
          >
            <span className={`inline-block h-2 w-2 rounded-full ${SEVERITY_DOT[sev]}`} aria-hidden="true" />
            {sev} {counts[sev] ?? 0}
          </span>
        ))}
        <span className="inline-flex items-center rounded-full border border-zinc-200 px-2.5 py-1 text-xs font-medium text-zinc-700 dark:border-zinc-700 dark:text-zinc-300">
          Open {openTotal}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-4 text-sm text-zinc-700 dark:text-zinc-300">
        <label className="flex w-fit items-center gap-2">
          <input type="checkbox" checked={showResolved} onChange={(e) => setShowResolved(e.target.checked)} />
          Show closed
        </label>
        <label className="flex w-fit items-center gap-2">
          <input type="checkbox" checked={mineOnly} onChange={(e) => setMineOnly(e.target.checked)} />
          Assigned to me
        </label>
      </div>

      {toast && (
        <div
          className={`flex items-center justify-between rounded-lg border px-4 py-2 text-sm ${
            toast.ok
              ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200"
              : "border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200"
          }`}
          role="status"
        >
          {toast.text}
          <button className="ml-3 text-zinc-400" onClick={() => setToast(null)}>
            ✕
          </button>
        </div>
      )}

      {items.length === 0 ? (
        <EmptyState title="No matching flags" body="Nothing needs attention." />
      ) : (
        <section className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-800/60">
              <tr>
                <th className="px-4 py-3" aria-label="Severity"><span className="sr-only">Severity</span></th>
                <th className="px-4 py-3">Rule</th>
                <th className="px-4 py-3">Entity</th>
                <th className="px-4 py-3">Message</th>
                <th className="px-4 py-3">Age</th>
                <th className="px-4 py-3">Assignee</th>
                <th className="px-4 py-3">Status</th>
                {canTriage && <th className="px-4 py-3"><span className="sr-only">Actions</span></th>}
              </tr>
            </thead>
            <tbody>
              {items.map((f) => (
                <Fragment key={f.id}>
                  <tr className="border-t border-zinc-100 hover:bg-zinc-50 dark:border-zinc-800">
                    <td className="px-4 py-2.5">
                      <span
                        aria-label={`${f.severity} severity`}
                        title={f.severity}
                        className={`inline-block h-2.5 w-2.5 rounded-full ${SEVERITY_DOT[f.severity] ?? "bg-zinc-400"}`}
                      />
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs text-zinc-900 dark:text-zinc-100">{f.ruleCode}</td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-xs text-zinc-500">
                      {f.entityType} #{String(f.entityId).slice(0, 8)}
                    </td>
                    <td className="max-w-[32rem] px-4 py-2.5 text-zinc-700 dark:text-zinc-300">
                      {f.message}
                      {f.resolutionNote && (
                        <span className="mt-1 block text-xs italic text-zinc-500">Note: {f.resolutionNote}</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-zinc-500">
                      {Math.max(0, Math.round((Date.now() - new Date(f.createdAt).getTime()) / 86_400_000))}d
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5">
                      {f.status === "OPEN" && canTriage ? (
                        <select
                          aria-label={`Assignee for flag ${f.ruleCode}`}
                          disabled={busyId === f.id}
                          value={f.assigneeId ?? ""}
                          onChange={(e) =>
                            patchFlag(
                              f.id,
                              { assigneeId: e.target.value === "" ? null : Number(e.target.value) },
                              e.target.value === "" ? "Assignment cleared" : "Flag assigned",
                            )
                          }
                          className="max-w-[11rem] truncate rounded-lg border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                        >
                          <option value="">Unassigned</option>
                          {(usersSwr.data?.items ?? []).map((u) => (
                            <option key={u.id} value={u.id}>
                              {u.name} ({u.role})
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-xs text-zinc-500">{assigneeLabel(f, usersSwr.data?.items)}</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_PILL[f.status] ?? STATUS_PILL.WONT_FIX}`}>
                        {f.status}
                      </span>
                    </td>
                    {canTriage && (
                      <td className="whitespace-nowrap px-4 py-2.5 text-right">
                        {f.status === "OPEN" ? (
                          <span className="flex gap-2">
                            <button
                              disabled={busyId === f.id}
                              onClick={() => setNoteFor({ flagId: f.id, action: "RESOLVED", value: "" })}
                              className="rounded-lg border border-emerald-300 px-2 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-50 disabled:opacity-50 dark:border-emerald-800 dark:text-emerald-300 dark:hover:bg-emerald-950"
                            >
                              Resolve
                            </button>
                            <button
                              disabled={busyId === f.id}
                              onClick={() => setNoteFor({ flagId: f.id, action: "WONT_FIX", value: "" })}
                              className="rounded-lg border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                            >
                              Won&apos;t fix
                            </button>
                          </span>
                        ) : (
                          <span className="text-xs text-zinc-400">—</span>
                        )}
                      </td>
                    )}
                  </tr>
                  {noteFor?.flagId === f.id && (
                    <tr className="border-t border-zinc-100 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-800/40">
                      <td colSpan={canTriage ? 8 : 7} className="px-4 py-3">
                        <label className="block text-xs font-medium uppercase tracking-wide text-zinc-500" htmlFor="flag-note">
                          Resolution note ({noteFor.action === "RESOLVED" ? "resolve" : "won't fix"} · required)
                        </label>
                        <textarea
                          id="flag-note"
                          rows={2}
                          autoFocus
                          value={noteFor.value}
                          onChange={(e) => setNoteFor({ ...noteFor, value: e.target.value })}
                          className="mt-1 w-full max-w-xl rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-indigo-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                          placeholder="What was checked / fixed / why no action?"
                        />
                        <div className="mt-2 flex gap-2">
                          <button
                            disabled={busyId === f.id || noteFor.value.trim().length === 0}
                            onClick={() =>
                              patchFlag(
                                f.id,
                                { status: noteFor.action, resolutionNote: noteFor.value.trim() },
                                noteFor.action === "RESOLVED" ? "Flag resolved" : "Marked won't-fix",
                              )
                            }
                            className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
                          >
                            Confirm
                          </button>
                          <button
                            onClick={() => setNoteFor(null)}
                            className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                          >
                            Cancel
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
