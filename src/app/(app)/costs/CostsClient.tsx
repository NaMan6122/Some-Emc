"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, XAxis, YAxis } from "recharts";
import { EmptyState, ErrorBanner, KpiCard } from "@/components/ui/primitives";
import { ChartFrame, ChartTooltip, CHART_COLORS } from "@/components/charts/themed";
import { useProjectContext, useSession } from "@/hooks/use-app-data";

// spec-028-v1: generic cost-control overview — one component driving the
// Labour / Supervision / Admin / DLP tabs via ?category=.

const CATEGORIES = ["LABOUR_INHOUSE", "LABOUR_SUBCONTRACT", "SUPERVISION", "ADMIN", "DLP"] as const;
type Category = (typeof CATEGORIES)[number];

const LABELS: Record<Category, string> = {
  LABOUR_INHOUSE: "Labour — In-house",
  LABOUR_SUBCONTRACT: "Labour — Subcontractors",
  SUPERVISION: "Supervision (Site & HO) + SRC",
  ADMIN: "Admin / Project Management Costs",
  DLP: "Defects Liability Period (DLP)",
};

type CostLine = { id: string; amountFils: string; sourceLabel: string; note: string | null };
type CostEntry = { id: string; entryDate: string; amountFils: string; description: string; reference: string | null };

function aed(fils: string): string {
  const n = BigInt(fils);
  return `AED ${(n / 100n).toLocaleString("en-US")}.${(n % 100n).toString().padStart(2, "0")}`;
}

export function CostsClient() {
  const { code } = useProjectContext();
  const { session } = useSession();
  const category = (() => {
    const p = new URLSearchParams(typeof window === "undefined" ? "" : window.location.search).get("category");
    return CATEGORIES.includes(p as Category) ? (p as Category) : "LABOUR_INHOUSE";
  })();

  const [lines, setLines] = useState<CostLine[] | null>(null);
  const [entries, setEntries] = useState<CostEntry[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [lineForm, setLineForm] = useState({ amount: "", sourceLabel: "" });
  const [entryForm, setEntryForm] = useState({ date: new Date().toISOString().slice(0, 10), amount: "", description: "", reference: "" });

  const load = useCallback(async () => {
    try {
      const [linesRes, entriesRes] = await Promise.all([
        fetch(`/api/v1/projects/0/cost-lines?category=${category}`).catch(() => null),
        fetch(`/api/v1/projects/0/cost-entries?category=${category}`).catch(() => null),
      ]);
      void linesRes;
      void entriesRes;
    } catch {
      /* project id resolved below */
    }
  }, [category]);
  void load;

  // The real fetch needs the numeric project id — resolve via projects list.
  const [projectId, setProjectId] = useState<number | null>(null);
  useEffect(() => {
    fetch("/api/v1/projects")
      .then((r) => (r.ok ? r.json() : null))
      .then((b) => {
        const code = new URLSearchParams(window.location.search).get("project");
        const list = (b?.items ?? []) as { id: number; code: string }[];
        const match = (code && list.find((p) => p.code === code)) || list[0];
        if (match) setProjectId(match.id);
      });
  }, []);

  const fetchData = useCallback(async () => {
    if (!projectId) return;
    setErr(null);
    const [l, e] = await Promise.all([
      fetch(`/api/v1/projects/${projectId}/cost-lines?category=${category}`),
      fetch(`/api/v1/projects/${projectId}/cost-entries?category=${category}`),
    ]);
    if (!l.ok || !e.ok) {
      setErr("Could not load cost data.");
      return;
    }
    setLines((await l.json()).lines);
    setEntries((await e.json()).entries);
  }, [projectId, category]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  async function addLine() {
    if (busy || !lineForm.amount || !lineForm.sourceLabel) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/v1/projects/${projectId}/cost-lines`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ category, amountFils: lineForm.amount, sourceLabel: lineForm.sourceLabel }),
      });
      if (res.ok) {
        setMsg({ ok: true, text: "Budget line added." });
        setLineForm({ amount: "", sourceLabel: "" });
        await fetchData();
      } else {
        const b = await res.json().catch(() => null);
        setMsg({ ok: false, text: b?.error?.message ?? `Failed (${res.status})` });
      }
    } finally {
      setBusy(false);
    }
  }

  async function addEntry() {
    if (busy || !entryForm.date || !entryForm.amount || !entryForm.description) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/v1/projects/${projectId}/cost-entries`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ category, entryDate: entryForm.date, amountFils: entryForm.amount, description: entryForm.description, reference: entryForm.reference || null }),
      });
      if (res.ok) {
        setMsg({ ok: true, text: "Expense booked." });
        setEntryForm({ ...entryForm, amount: "", description: "", reference: "" });
        await fetchData();
      } else {
        const b = await res.json().catch(() => null);
        setMsg({ ok: false, text: b?.error?.message ?? `Failed (${res.status})` });
      }
    } finally {
      setBusy(false);
    }
  }

  async function remove(kind: "CostLine" | "CostEntry", id: string) {
    const endpoint = kind === "CostLine" ? `/api/v1/cost-lines/${id}` : `/api/v1/cost-entries/${id}`;
    const res = await fetch(endpoint, { method: "DELETE" });
    if (res.ok) {
      setMsg({ ok: true, text: `${kind} removed.` });
      await fetchData();
    } else {
      const b = await res.json().catch(() => null);
      setMsg({ ok: false, text: b?.error?.message ?? `Failed (${res.status})` });
    }
  }

  const budgetTotal = useMemo(
    () => (lines ?? []).reduce((s, l) => s + BigInt(l.amountFils), 0n),
    [lines],
  );
  const actualTotal = useMemo(
    () => (entries ?? []).reduce((s, e) => s + BigInt(e.amountFils), 0n),
    [entries],
  );
  const variance = budgetTotal - actualTotal;
  const utilisation = budgetTotal > 0n ? Number((actualTotal * 10000n) / budgetTotal) / 100 : null;

  const monthlySeries = useMemo(() => {
    const m = new Map<string, bigint>();
    for (const e of entries ?? []) {
      const k = e.entryDate.slice(0, 7);
      m.set(k, (m.get(k) ?? 0n) + BigInt(e.amountFils));
    }
    return [...m.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([month, fils]) => ({ month, booked: Number(fils) / 100 }));
  }, [entries]);

  const canWriteLine = session?.role === "ADMIN" || session?.role === "COMMERCIAL";
  const canWriteEntry = session?.role === "ADMIN" || session?.role === "FINANCE";

  const inputCls =
    "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100";

  if (err) return <ErrorBanner message={err} />;

  return (
    <div className="mx-auto flex max-w-[1200px] flex-col gap-6 px-1 sm:px-0">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Cost Control{code ? ` · ${code}` : ""}</p>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-3xl">{LABELS[category]}</h1>
        <p className="mt-0.5 text-sm text-zinc-500">JCA budget vs actual expenses booked — audited per entry.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {(Object.keys(LABELS) as Category[]).map((c) => (
          <a
            key={c}
            href={`/costs?category=${c}`}
            aria-current={c === category}
            className={`rounded-full border px-4 py-1.5 text-xs font-medium ${
              c === category
                ? "border-indigo-600 bg-indigo-50 text-indigo-700 dark:border-indigo-700 dark:bg-indigo-950 dark:text-indigo-300"
                : "border-zinc-300 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300"
            }`}
          >
            {LABELS[c]}
          </a>
        ))}
      </div>

      {msg && (
        <div
          role="status"
          className={`flex items-center justify-between rounded-lg border px-4 py-2 text-sm ${
            msg.ok ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200"
                   : "border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200"
          }`}
        >
          {msg.text}
          <button className="ml-3 text-zinc-400" onClick={() => setMsg(null)}>✕</button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 sm:gap-4">
        <KpiCard label="JCA budget" value={aed(budgetTotal.toString())} sub={`${lines?.length ?? 0} line(s)`} />
        <KpiCard label="Actual booked" value={aed(actualTotal.toString())} sub={`${entries?.length ?? 0} entr(y/ies)`} />
        <KpiCard
          label="Variance"
          value={`${variance < 0n ? "-" : ""}${aed((variance < 0n ? -variance : variance).toString())}`}
          sub={variance < 0n ? "over budget" : "remaining"}
        />
        <KpiCard label="Utilisation" value={utilisation != null ? `${utilisation.toFixed(1)}%` : "—"} />
      </div>

      <ChartFrame title="Expenses booked by month" unit="AED per month" ariaLabel="Monthly booked actuals.">
        <div className="w-full overflow-x-auto">
          <div className="min-w-[360px]">
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={monthlySeries} margin={{ top: 4, right: 8, left: 48 }}>
                <CartesianGrid stroke="#e4e4e7" vertical={false} strokeOpacity={0.5} className="dark:opacity-20" />
                <XAxis dataKey="month" tickLine={false} axisLine={false} fontSize={10} />
                <YAxis tickLine={false} axisLine={false} fontSize={10} width={52}
                  tickFormatter={(v: number) => `${v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M` : v >= 1000 ? `${Math.round(v / 1000)}K` : v}`} />
                <Bar dataKey="booked" name="Booked" fill={CHART_COLORS.committed} radius={[3, 3, 0, 0]} barSize={18} isAnimationActive={false} />
                <ChartTooltip moneyKeys={["booked"]} cursor={{ fill: "rgba(0,0,0,0.03)" }} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </ChartFrame>

      {(canWriteLine || canWriteEntry) && (
        <div className="grid gap-4 lg:grid-cols-2">
          {canWriteLine && (
            <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <h2 className="text-sm font-semibold">Add JCA budget line</h2>
              <div className="mt-3 flex flex-col gap-2">
                <input aria-label="Budget source label" placeholder="Source label (e.g. JCA Appendix V)" value={lineForm.sourceLabel} onChange={(e) => setLineForm({ ...lineForm, sourceLabel: e.target.value })} className={inputCls} />
                <input aria-label="Budget amount AED" placeholder="Amount (AED)" value={lineForm.amount} onChange={(e) => setLineForm({ ...lineForm, amount: e.target.value })} className={inputCls} />
                <button onClick={() => void addLine()} disabled={busy || !lineForm.amount || !lineForm.sourceLabel}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50">
                  Add budget line
                </button>
              </div>
            </section>
          )}
          {canWriteEntry && (
            <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <h2 className="text-sm font-semibold">Book an expense</h2>
              <div className="mt-3 flex flex-col gap-2">
                <input aria-label="Expense description" placeholder="Description (what was paid for)" value={entryForm.description} onChange={(e) => setEntryForm({ ...entryForm, description: e.target.value })} className={inputCls} />
                <div className="grid grid-cols-2 gap-2">
                  <input aria-label="Entry date" type="date" value={entryForm.date} onChange={(e) => setEntryForm({ ...entryForm, date: e.target.value })} className={inputCls} />
                  <input aria-label="Entry amount AED" placeholder="Amount (AED)" value={entryForm.amount} onChange={(e) => setEntryForm({ ...entryForm, amount: e.target.value })} className={inputCls} />
                </div>
                <input aria-label="Reference" placeholder="Reference / invoice # (optional)" value={entryForm.reference} onChange={(e) => setEntryForm({ ...entryForm, reference: e.target.value })} className={inputCls} />
                <button onClick={() => void addEntry()} disabled={busy || !entryForm.description || !entryForm.amount}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50">
                  Book expense
                </button>
              </div>
            </section>
          )}
        </div>
      )}

      {!entries ? (
        <div className="h-48 animate-pulse rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900" aria-busy="true" />
      ) : entries.length === 0 ? (
        <EmptyState title="No expenses booked yet" body="Actuals appear here as finance books them." />
      ) : (
        <section className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-800/60">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Description</th>
                  <th className="px-4 py-3">Ref</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                  {(canWriteEntry || canWriteLine) && <th className="px-4 py-3"><span className="sr-only">Actions</span></th>}
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr key={e.id} className="border-t border-zinc-100 hover:bg-zinc-50 dark:border-zinc-800">
                    <td className="whitespace-nowrap px-4 py-2.5 tabular-nums text-zinc-700 dark:text-zinc-300">{e.entryDate.slice(0, 10)}</td>
                    <td className="px-4 py-2.5 text-zinc-900 dark:text-zinc-100">{e.description}</td>
                    <td className="px-4 py-2.5 text-xs text-zinc-500">{e.reference ?? "—"}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-zinc-900 dark:text-zinc-100">{aed(e.amountFils)}</td>
                    {canWriteEntry && (
                      <td className="px-4 py-2.5 text-right">
                        <button onClick={() => void remove("CostEntry", e.id)} className="text-xs text-red-500 hover:underline">
                          Remove
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
