"use client";

import { useState } from "react";
import useSWR from "swr";
import { EmptyState } from "@/components/ui/primitives";
import { useProjectContext } from "@/hooks/use-app-data";

type Flag = {
  id: string;
  entityType: string;
  entityId: string;
  ruleCode: string;
  severity: string;
  message: string;
  status: string;
  createdAt: string;
};

const SEVERITY_DOT: Record<string, string> = {
  HIGH: "bg-red-500",
  MEDIUM: "bg-amber-500",
  LOW: "bg-sky-500",
};

export function FlagsClient() {
  const { code } = useProjectContext();
  const [showResolved, setShowResolved] = useState(false);
  const flagsSwr = useSWR<{ items: Flag[] }>(`/api/v1/flags?limit=200`, (u: string) =>
    fetch(u).then((r) => (r.ok ? r.json() : null)),
  );
  const all = flagsSwr.data?.items ?? [];
  const items = all.filter((f) => (showResolved ? true : f.status === "OPEN"));

  if (!flagsSwr.data) {
    return <div className="h-64 animate-pulse rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900" aria-busy="true" />;
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Governance{code ? ` · ${code}` : ""}</p>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">Data Flags</h1>
        <p className="mt-0.5 text-sm text-zinc-500">Data-quality queue (read-only preview — triage workflow lands in M3).</p>
      </div>

      <label className="flex w-fit items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
        <input type="checkbox" checked={showResolved} onChange={(e) => setShowResolved(e.target.checked)} />
        Show resolved
      </label>

      {items.length === 0 ? (
        <EmptyState title="No open flags" body="Nothing needs attention." />
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
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {items.map((f) => (
                <tr key={f.id} className="border-t border-zinc-100 hover:bg-zinc-50 dark:border-zinc-800">
                  <td className="px-4 py-2.5">
                    <span
                      aria-label={`${f.severity} severity`}
                      title={f.severity}
                      className={`inline-block h-2.5 w-2.5 rounded-full ${SEVERITY_DOT[f.severity] ?? "bg-zinc-400"}`}
                    />
                  </td>
                  <td className="px-4 py-2.5 font-mono text-xs text-zinc-900 dark:text-zinc-100">{f.ruleCode}</td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-xs text-zinc-500">{f.entityType} #{String(f.entityId).slice(0, 8)}</td>
                  <td className="max-w-[36rem] px-4 py-2.5 text-zinc-700 dark:text-zinc-300">{f.message}</td>
                  <td className="px-4 py-2.5 text-xs text-zinc-500">
                    {Math.max(0, Math.round((Date.now() - new Date(f.createdAt).getTime()) / 86_400_000))}d
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                      f.status === "OPEN"
                        ? "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300"
                        : "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"}`}>
                      {f.status}
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
