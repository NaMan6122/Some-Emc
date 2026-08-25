"use client";

// spec-010-v1: LPO log — filter bar, server-sorted table, detail drawer with
// revision timeline, role-gated actions, CSV export. Data: /api/v1/projects/:id/lpos

import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
  type SortingState,
} from "@tanstack/react-table";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Drawer } from "@/components/ui/Drawer";
import { ProvenanceChip, StatusPill, TradeDot } from "@/components/ui/StatusPill";
import { ErrorBanner } from "@/components/ui/primitives";
import { useDebounced } from "@/hooks/use-debounced";
import { useProjectContext, useProjects, useSession } from "@/hooks/use-app-data";

type LpoRow = {
  id: string;
  refNo: string;
  revisionNo: number;
  supplier: { id: number; name: string };
  trade: TradeKey;
  description: string;
  issueDate: string;
  amountFils: string;
  status: "DRAFT" | "ISSUED" | "CLOSED" | "CANCELLED";
  verification: "PENDING" | "VERIFIED" | "FLAGGED";
};

const TRADES = ["ELECTRICAL", "PLUMBING", "HVAC", "FIRE_FIGHTING", "GENERAL", "HSE", "OTHER"] as const;
type TradeKey = (typeof TRADES)[number];

function formatAED(fils: string | bigint): string {
  const n = BigInt(fils);
  const neg = n < 0n;
  const abs = neg ? -n : n;
  return `${neg ? "-" : ""}AED ${(abs / 100n).toLocaleString("en-US")}.${(abs % 100n).toString().padStart(2, "0")}`;
}

export function buildQuery(f: Filters): URLSearchParams {
  const p = new URLSearchParams();
  if (f.trade) p.set("trade", f.trade);
  if (f.status) p.set("status", f.status);
  if (f.verification) p.set("verification", f.verification);
  if (f.q) p.set("q", f.q);
  if (f.from) p.set("from", new Date(f.from + "T00:00:00Z").toISOString());
  if (f.to) p.set("to", new Date(f.to + "T23:59:59Z").toISOString());
  if (f.includeSuperseded) p.set("includeSuperseded", "true");
  if (f.sort) p.set("sort", f.sort);
  if (f.dir) p.set("dir", f.dir);
  p.set("limit", String(f.limit ?? 50));
  if (f.cursor) p.set("cursor", f.cursor);
  return p;
}

export type Filters = {
  trade?: string;
  status?: string;
  verification?: string;
  q?: string;
  from?: string;
  to?: string;
  includeSuperseded?: boolean;
  sort?: "issueDate" | "amountFils" | "refNo";
  dir?: "asc" | "desc";
  limit?: number;
  cursor?: string;
};

export function LpoLogClient() {
  const { code } = useProjectContext();
  const { projects } = useProjects();
  const projectId = projects.find((p) => p.code === code)?.id ?? null;
  const { session } = useSession();
  const role = session?.role ?? null;
  const canWrite = role === "ADMIN" || role === "PROCUREMENT";

  const [trade, setTrade] = useState<string>("");
  const [status, setStatus] = useState<string>("");
  const [verification, setVerification] = useState<string>("");
  const [qRaw, setQRaw] = useState("");
  const q = useDebounced(qRaw, 300);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [includeSuperseded, setIncludeSuperseded] = useState(false);
  const [sorting, setSorting] = useState<SortingState>([{ id: "issueDate", desc: true }]);
  const [rows, setRows] = useState<LpoRow[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [totals, setTotals] = useState<{ activeCount: number; activeSumFils: string } | null>(null);
  const [loadingFirst, setLoadingFirst] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const filters: Filters = useMemo(
    () => ({
      trade: trade || undefined,
      status: status || undefined,
      verification: verification || undefined,
      q: q || undefined,
      from: from ? new Date(from + "T00:00:00Z").toISOString() : undefined,
      to: to ? new Date(to + "T23:59:59Z").toISOString() : undefined,
      includeSuperseded,
      sort: (sorting[0]?.id as Filters["sort"]) ?? "issueDate",
      dir: sorting[0]?.desc === false ? "asc" : "desc",
    }),
    [trade, status, verification, q, from, to, includeSuperseded, sorting],
  );

  const load = useCallback(
    async (cursor?: string) => {
      if (projectId === null) return;
      const params = buildQuery({ ...filters, limit: 50, cursor });
      const res = await fetch(`/api/v1/projects/${String(projectId)}/lpos?${params}`);
      if (!res.ok) {
        setToast(`Load failed (${res.status})`);
        return;
      }
      const body = await res.json();
      setRows((prev) => (cursor ? [...prev, ...body.items] : body.items));
      setNextCursor(body.nextCursor);
      setTotals(body.totals);
      setLoadingFirst(false);
    },
    [projectId, filters],
  );

  // Re-query whenever filters/sort/project change; cursor resets.
  useEffect(() => {
    setRows([]);
    setLoadingFirst(true);
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, JSON.stringify(filters)]);

  function hasActiveFilters(): boolean {
    return Boolean(trade || status || verification || q || from || to || includeSuperseded);
  }

  function clearAll() {
    setTrade("");
    setStatus("");
    setVerification("");
    setQRaw("");
    setFrom("");
    setTo("");
    setIncludeSuperseded(false);
  }

  function exportCsv() {
    if (projectId === null) return;
    const params = buildQuery(filters);
    window.open(`/api/v1/projects/${String(projectId)}/lpos/export?${params}`, "_blank");
  }

  const columnHelper = createColumnHelper<LpoRow>();
  const columns = useMemo(
    () => [
      columnHelper.accessor("refNo", {
        header: "Ref",
        cell: (info) => (
          <div className="flex items-center gap-1.5 font-mono text-xs">
            {info.getValue()}
            {info.row.original.revisionNo > 0 && (
              <span className="rounded bg-zinc-100 px-1 text-[10px] text-zinc-500 dark:bg-zinc-800">
                R{info.row.original.revisionNo}
              </span>
            )}
          </div>
        ),
      }),
      columnHelper.accessor((r) => r.supplier.name, { id: "supplier", header: "Supplier" }),
      columnHelper.accessor("description", { header: "Description" }),
      columnHelper.accessor("trade", {
        header: "Trade",
        cell: (info) => (
          <span className="inline-flex items-center gap-1.5">
            <TradeDot trade={info.getValue()} />
            {String(info.getValue()).replace("_", " ")}
          </span>
        ),
      }),
      columnHelper.accessor("issueDate", { header: "Issued", cell: (i) => i.getValue().slice(0, 10) }),
      columnHelper.accessor("amountFils", {
        header: "Amount",
        cell: (i) => <span className="tabular-nums">{formatAED(i.getValue())}</span>,
      }),
      columnHelper.accessor("status", { header: "Status", cell: (i) => <StatusPill domain="lpo" value={i.getValue()} /> }),
      columnHelper.accessor("verification", {
        header: "Ver.",
        cell: (i) => <StatusPill domain="verification" value={i.getValue()} />,
      }),
    ],
    [columnHelper],
  );

  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting },
    manualSorting: true,
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="flex flex-col gap-4">
      {/* Filter bar */}
      <section className="rounded-xl border border-zinc-200 bg-white p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <input
            value={qRaw}
            onChange={(e) => setQRaw(e.target.value)}
            placeholder="Search supplier / material / ref…"
            data-testid="lpo-q"
            className="w-full rounded-lg border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-800 sm:min-w-[220px] sm:flex-1"
          />
          <select
            aria-label="Status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="rounded-lg border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-800"
          >
            <option value="">All statuses</option>
            {["DRAFT", "ISSUED", "CLOSED", "CANCELLED"].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          <select
            aria-label="Verification"
            value={verification}
            onChange={(e) => setVerification(e.target.value)}
            className="rounded-lg border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-800"
          >
            <option value="">All verification</option>
            {["PENDING", "VERIFIED", "FLAGGED"].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          <input type="date" aria-label="From" value={from} onChange={(e) => setFrom(e.target.value)}
            className="rounded-lg border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-800" />
          <input type="date" aria-label="To" value={to} onChange={(e) => setTo(e.target.value)}
            className="rounded-lg border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-800" />
          <label className="flex items-center gap-1 text-xs text-zinc-600 dark:text-zinc-300">
            <input type="checkbox" checked={includeSuperseded} onChange={(e) => setIncludeSuperseded(e.target.checked)} />
            superseded
          </label>
          {hasActiveFilters() && (
            <button onClick={clearAll} className="text-xs text-indigo-600 hover:underline">
              Clear all
            </button>
          )}
        </div>
        <div className="mt-2 flex flex-nowrap gap-1.5 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible sm:pb-0">
          {TRADES.map((t) => (
            <button
              key={t}
              onClick={() => setTrade(trade === t ? "" : t)}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs ${
                trade === t
                  ? "border-indigo-600 bg-indigo-50 font-medium text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300"
                  : "border-zinc-200 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300"
              }`}
            >
              <TradeDot trade={t} />
              {t.replace("_", " ")}
            </button>
          ))}
        </div>
      </section>

      {toast && (
        <div className="fixed bottom-6 right-6 z-50 rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm shadow-lg dark:bg-zinc-800">
          {toast}
          <button className="ml-3 text-zinc-400" onClick={() => setToast(null)}>✕</button>
        </div>
      )}

      {/* Table */}
      <section className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-800">
              {table.getHeaderGroups().map((hg) => (
                <tr key={hg.id}>
                  {hg.headers.map((h, idx: number) => {
                    const sortable = ["issueDate", "amountFils", "refNo"].includes(h.column.id);
                    return (
                      <th
                        key={h.id}
                        onClick={
                          sortable
                            ? h.column.getToggleSortingHandler()
                            : undefined
                        }
                        className={`px-3 py-2.5 ${idx === 0 ? "sticky left-0 z-10 bg-zinc-50 dark:bg-zinc-800" : ""} ${
                          ["Amount"].includes(String(h.column.columnDef.meta ?? "")) ? "text-right" : ""
                        } ${h.column.id === "amountFils" ? "text-right" : ""} ${sortable ? "cursor-pointer select-none" : ""}`}
                      >
                        {h.isPlaceholder ? null : flexRender(h.column.columnDef.header, h.getContext())}
                        {{ asc: " ▲", desc: " ▼" }[h.column.getIsSorted() as string] ?? ""}
                      </th>
                    );
                  })}
                  <th className="px-3 py-2.5" />
                </tr>
              ))}
            </thead>
            <tbody>
              {loadingFirst && rows.length === 0 && (
                <tr><td colSpan={9} className="px-3 py-8 text-center text-zinc-400">Loading…</td></tr>
              )}
              {!loadingFirst && rows.length === 0 && (
                <tr><td colSpan={9} className="px-3 py-8 text-center text-zinc-400">No LPOs match these filters.</td></tr>
              )}
              {table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  onClick={() => setDetailId(row.original.id)}
                  className="group h-10 cursor-pointer border-t border-zinc-100 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800/60"
                >
                  {row.getVisibleCells().map((cell, idx) => (
                    <td
                      key={cell.id}
                      className={`px-3 py-2 align-middle ${idx === 0 ? "sticky left-0 z-10 bg-white group-hover:bg-zinc-50 dark:bg-zinc-900 dark:group-hover:bg-zinc-800" : ""} ${
                        cell.column.id === "amountFils" ? "text-right tabular-nums" : ""
                      }`}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                  <td />
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer: totals + pagination + export */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-100 px-3 py-2 text-xs text-zinc-500 dark:border-zinc-800">
          <span data-testid="lpo-totals">
            {totals ? `${totals.activeCount.toLocaleString()} active · ${formatAED(totals.activeSumFils)}` : "—"}
          </span>
          <div className="flex items-center gap-2">
            {nextCursor && (
              <button
                onClick={() => void load(nextCursor)}
                className="rounded-lg border border-zinc-200 px-3 py-1 font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
              >
                Load more
              </button>
            )}
            <button
              onClick={exportCsv}
              className="rounded-lg border border-zinc-200 px-3 py-1 font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              Export CSV
            </button>
            {canWrite && (
              <button
                onClick={() => setCreateOpen(true)}
                className="rounded-lg bg-indigo-600 px-3 py-1 font-semibold text-white hover:bg-indigo-700"
              >
                New LPO
              </button>
            )}
          </div>
        </div>
      </section>

      {detailId && <DetailDrawer id={detailId} role={role} onClose={() => setDetailId(null)} onChanged={() => void load(nextCursor ?? undefined)} />}
      {createOpen && (
        <CreateDrawer
          projectId={projectId}
          onClose={() => setCreateOpen(false)}
          onCreated={() => {
            setCreateOpen(false);
            setRows([]);
            setLoadingFirst(true);
            void load();
          }}
        />
      )}
    </div>
  );
}

// ---------- Detail drawer ----------

type ChainLink = {
  id: string;
  refNo: string;
  revisionNo: number;
  amountFils: string;
  issueDate: string;
  status: string;
  supersededById: string | null;
};

function DetailDrawer({
  id,
  role,
  onClose,
  onChanged,
}: {
  id: string;
  role: string | null;
  onClose: () => void;
  onChanged: () => void;
}) {
  const canWrite = role === "ADMIN" || role === "PROCUREMENT";
  const isCommercial = role === "COMMERCIAL";
  const [data, setData] = useState<{
    refNo: string;
    revisionNo: number;
    amountFils: string;
    supplier: { name: string };
    description: string;
    issueDate: string;
    indentDate?: string | null;
    deliveryDate?: string | null;
    vatRate: string;
    kind: string;
    status: string;
    verification: string;
    provenance: string;
    remark: string | null;
    voId: string | null;
    flagNote: string | null;
    chain: ChainLink[];
  } | null>(null);
  const [amountEdit, setAmountEdit] = useState("");
  const [flagNote, setFlagNote] = useState("");
  const [verSel, setVerSel] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  const fetchChain = useCallback(async () => {
    const res = await fetch(`/api/v1/lpos/${id}`);
    if (res.ok) {
      const b = await res.json();
      setData(b);
      setAmountEdit((Number(b.amountFils) / 100).toFixed(2));
    }
  }, [id]);

  useEffect(() => {
    void fetchChain();
  }, [fetchChain]);

  async function patch(payload: Record<string, unknown>, okMsg: string) {
    const res = await fetch(`/api/v1/lpos/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      setMsg(okMsg);
      await fetchChain();
      onChanged();
      setTimeout(() => setMsg(null), 2500);
    } else {
      const b = await res.json().catch(() => null);
      setMsg(b?.error?.message ?? `Failed (${res.status})`);
    }
  }

  if (!data) {
    return (
      <Drawer title="LPO" onClose={onClose}>
        <p className="text-sm text-zinc-400">Loading…</p>
      </Drawer>
    );
  }

  return (
    <Drawer title={`${data.refNo}${data.revisionNo > 0 ? ` · R${data.revisionNo}` : ""}`} onClose={onClose}>
      <div className="flex flex-col gap-4 text-sm">
        <dl className="grid grid-cols-[100px_1fr] gap-y-1.5">
          <dt className="text-zinc-500">Supplier</dt>
          <dd>{data.supplier.name}</dd>
          <dt className="text-zinc-500">Description</dt>
          <dd>{data.description}</dd>
          <dt className="text-zinc-500">Issued</dt>
          <dd className="tabular-nums">{data.issueDate.slice(0, 10)}</dd>
          <dt className="text-zinc-500">Indent date</dt>
          <dd className="tabular-nums">{data.indentDate ? data.indentDate.slice(0, 10) : "—"}</dd>
          <dt className="text-zinc-500">Delivery due</dt>
          <dd className="tabular-nums">{data.deliveryDate ? data.deliveryDate.slice(0, 10) : "—"}</dd>
          <dt className="text-zinc-500">Amount</dt>
          <dd className="tabular-nums font-medium">{formatAED(data.amountFils)}</dd>
          <dt className="text-zinc-500">VAT</dt>
          <dd className="tabular-nums">{Number(data.vatRate) * 100}%</dd>
          <dt className="text-zinc-500">Kind</dt>
          <dd>{data.kind}</dd>
          <dt className="text-zinc-500">Provenance</dt>
          <dd><ProvenanceChip value={data.provenance} /></dd>
          <dt className="text-zinc-500">Remark</dt>
          <dd>{data.remark ?? "—"}</dd>
          <dt className="text-zinc-500">Status</dt>
          <dd><StatusPill domain="lpo" value={data.status} /></dd>
          <dt className="text-zinc-500">Verification</dt>
          <dd><StatusPill domain="verification" value={data.verification} /></dd>
        </dl>

        {data.flagNote && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
            Flag: {data.flagNote}
          </div>
        )}

        {canWrite && data.status !== "CANCELLED" && (
          <section className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-700">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">Actions</p>
            {canWrite && (
              <>
                <div className="flex items-end gap-2">
                  <label className="flex-1 text-xs text-zinc-500">
                    Correct amount (AED)
                    <input
                      value={amountEdit}
                      onChange={(e) => setAmountEdit(e.target.value)}
                      disabled={data.status !== "ISSUED"}
                      className="mt-0.5 w-full rounded-lg border border-zinc-300 px-2 py-1.5 tabular-nums text-sm disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800"
                    />
                  </label>
                  <button
                    onClick={() => void patch({ amountFils: amountEdit }, "Revision created")}
                    disabled={data.status !== "ISSUED"}
                    className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                  >
                    Revise
                  </button>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <select
                    aria-label="Set verification"
                    value={verSel}
                    onChange={(e) => setVerSel(e.target.value)}
                    className="rounded-lg border border-zinc-300 px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-800"
                  >
                    <option value="">Set verification…</option>
                    <option>PENDING</option>
                    <option>VERIFIED</option>
                    <option>FLAGGED</option>
                  </select>
                  {verSel === "FLAGGED" && (
                    <input
                      placeholder="Why? (min 3 chars)"
                      value={flagNote}
                      onChange={(e) => setFlagNote(e.target.value)}
                      className="flex-1 rounded-lg border border-zinc-300 px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-800"
                    />
                  )}
                  <button
                    onClick={() => void patch({ verification: verSel, ...(verSel === "FLAGGED" ? { flagNote } : {}) }, "Verification updated")}
                    disabled={!verSel}
                    className="rounded-lg border border-zinc-300 px-3 py-1 text-xs font-medium disabled:opacity-50 dark:border-zinc-700"
                  >
                    Apply
                  </button>
                  {data.status === "ISSUED" && (
                    <button
                      onClick={() => window.confirm("Close this LPO?") && void patch({ status: "CLOSED" }, "Closed")}
                      className="rounded-lg border border-emerald-300 px-3 py-1 text-xs font-medium text-emerald-700"
                    >
                      Close
                    </button>
                  )}
                  <button
                    onClick={() => window.confirm("Cancel this LPO? History is retained.") && void patch({ status: "CANCELLED" }, "Cancelled")}
                    className="rounded-lg border border-red-300 px-3 py-1 text-xs font-medium text-red-700"
                  >
                    Cancel
                  </button>
                </div>
              </>
            )}
            {isCommercial && data.kind === "VARIATION" && (
              <VOEditor lpoId={id} currentVoId={data.voId} onSaved={(m) => { setMsg(m); onChanged(); }} />
            )}
            {msg && <p className="mt-2 text-xs text-indigo-600">{msg}</p>}
          </section>
        )}

        {isCommercial && !canWrite && data.kind === "VARIATION" && (
          <section className="rounded-lg border border-zinc-200 p-3 text-xs text-zinc-500 dark:border-zinc-700">
            COMMERCIAL may edit the VO link only.
          </section>
        )}

        {/* Cross-project allocations (spec-022) */}
        <AllocationsPanel lpoId={id} role={role} onMsg={(m) => setMsg(m)} />

        {/* Revision timeline */}
        <section>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">Revision timeline</p>
          <ol className="relative flex flex-col gap-2 border-l border-zinc-200 pl-4 dark:border-zinc-700">
            {data.chain.map((c, i) => (
              <li key={c.id} className="relative text-xs">
                <span className="absolute -left-[21px] top-1 h-2 w-2 rounded-full bg-indigo-500" />
                <p className="font-mono">
                  {c.refNo} <span className="text-zinc-400">· rev {c.revisionNo}</span>
                </p>
                <p className="tabular-nums text-zinc-600 dark:text-zinc-300">
                  {formatAED(c.amountFils)} · {c.issueDate.slice(0, 10)}
                </p>
                {c.supersededById && <p className="text-zinc-400">superseded ↓</p>}
                {i === data.chain.length - 1 && <p className="text-emerald-600">latest</p>}
              </li>
            ))}
          </ol>
        </section>
      </div>
    </Drawer>
  );
}

function VOEditor({ lpoId, currentVoId, onSaved }: { lpoId: string; currentVoId: string | null; onSaved: (m: string) => void }) {
  const [voId, setVoId] = useState(currentVoId ?? "");
  return (
    <div className="mt-2 flex items-end gap-2">
      <label className="flex-1 text-xs text-zinc-500">
        Link to VO #
        <input
          value={voId}
          onChange={(e) => setVoId(e.target.value.replace(/[^\d]/g, ""))}
          placeholder="VO # (e.g. 12)"
          className="mt-0.5 w-full rounded-lg border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-800"
        />
      </label>
      <button
        onClick={async () => {
          const res = await fetch(`/api/v1/lpos/${lpoId}`, {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ voId: voId || null }),
          });
          onSaved(res.ok ? "VO link updated" : `Failed (${res.status})`);
        }}
        className="rounded-lg border border-zinc-300 px-3 py-1 text-xs font-medium dark:border-zinc-700"
      >
        Save link
      </button>
    </div>
  );
}

// ---------- Allocations (spec-022) ----------
type Alloc = {
  id: string;
  targetProjectId: number;
  pct: number;
  note: string | null;
  targetProject: { id: number; code: string; name: string };
};

function AllocationsPanel({
  lpoId,
  role,
  onMsg,
}: {
  lpoId: string;
  role: string | null;
  onMsg: (m: string) => void;
}) {
  const canAllocate = role === "ADMIN" || role === "COMMERCIAL";
  const [items, setItems] = useState<Alloc[] | null>(null);
  const [totalPct, setTotalPct] = useState(0);
  const [projects, setProjects] = useState<{ id: number; code: string; name: string }[]>([]);
  const [pct, setPct] = useState("");
  const [targetId, setTargetId] = useState("");
  const [note, setNote] = useState("");

  const load = useCallback(async () => {
    const res = await fetch(`/api/v1/lpos/${lpoId}/allocation`);
    if (res.ok) {
      const b = await res.json();
      setItems(b.items);
      setTotalPct(b.totalPct);
    }
  }, [lpoId]);

  useEffect(() => {
    if (canAllocate) {
      void fetch("/api/v1/projects")
        .then((r) => (r.ok ? r.json() : null))
        .then((b) => b && setProjects(b.items));
    }
    void load();
  }, [canAllocate, load]);

  async function add() {
    const res = await fetch(`/api/v1/lpos/${lpoId}/allocation`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ targetProjectId: Number(targetId), pct: Number(pct), note: note || null }),
    });
    if (res.ok) {
      onMsg("Allocation recorded");
      setPct("");
      setTargetId("");
      setNote("");
      await load();
    } else {
      const b = await res.json().catch(() => null);
      onMsg(b?.error?.message ?? `Failed (${res.status})`);
    }
  }

  async function remove(id: string) {
    const res = await fetch(`/api/v1/allocations/${id}`, { method: "DELETE" });
    if (res.ok) {
      onMsg("Allocation removed");
      await load();
    } else {
      const b = await res.json().catch(() => null);
      onMsg(b?.error?.message ?? `Failed (${res.status})`);
    }
  }

  return (
    <section>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
        Cross-project allocation{totalPct > 0 && <span className="ml-2 normal-case text-indigo-600">{totalPct}% allocated</span>}
      </p>
      {!items ? (
        <p className="text-sm text-zinc-400">Loading…</p>
      ) : items.length === 0 && !canAllocate ? (
        <p className="text-xs text-zinc-400">No allocations.</p>
      ) : (
        <>
          {items.length > 0 && (
            <ul className="mb-2 flex flex-col gap-1">
              {items.map((a) => (
                <li key={a.id} className="flex items-center justify-between rounded-lg border border-zinc-200 px-3 py-1.5 text-xs dark:border-zinc-800">
                  <span className="min-w-0 truncate">
                    → <span className="font-medium">{a.targetProject.code}</span> · {a.pct}%{a.note ? ` · ${a.note}` : ""}
                  </span>
                  {canAllocate && (
                    <button onClick={() => void remove(a.id)} className="ml-3 shrink-0 text-red-500 hover:underline">
                      Remove
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
          {canAllocate && totalPct < 100 && (
            <div className="flex flex-wrap items-center gap-2">
              <select
                aria-label="Allocation target project"
                value={targetId}
                onChange={(e) => setTargetId(e.target.value)}
                className="rounded-lg border border-zinc-300 px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-800"
              >
                <option value="">Allocate to project…</option>
                {projects
                  .filter((p) => !items.some((a) => a.targetProjectId === p.id))
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.code} — {p.name}
                    </option>
                  ))}
              </select>
              <input
                aria-label="Percent"
                placeholder="%"
                value={pct}
                onChange={(e) => setPct(e.target.value)}
                className={`w-16 rounded-lg border px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-800 ${/^\d+$/.test(pct) && Number(pct) >= 1 && Number(pct) <= 100 - totalPct ? "" : pct === "" ? "" : "border-red-400"}`}
              />
              <input
                aria-label="Allocation note"
                placeholder="Note (optional)"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="flex-1 min-w-[8rem] rounded-lg border border-zinc-300 px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-800"
              />
              <button
                onClick={() => void add()}
                disabled={!targetId || !/^\d+$/.test(pct) || Number(pct) < 1 || Number(pct) > 100 - totalPct}
                className="rounded-lg bg-indigo-600 px-3 py-1 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                Add
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}

// ---------- Create drawer ----------

function CreateDrawer({
  projectId,
  onClose,
  onCreated,
}: {
  projectId: number | null;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [suppliers, setSuppliers] = useState<{ id: number; name: string }[]>([]);
  const [form, setForm] = useState({
    supplierId: "",
    trade: "ELECTRICAL",
    description: "",
    issueDate: new Date().toISOString().slice(0, 10),
    amount: "",
    kind: "STANDARD",
    status: "ISSUED",
    remark: "",
  });
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    void fetch("/api/v1/suppliers")
      .then((r) => r.json())
      .then((b) => setSuppliers(b.items ?? []))
      .catch(() => undefined);
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    const payload: Record<string, unknown> = {
      supplierId: Number(form.supplierId),
      trade: form.trade,
      description: form.description,
      issueDate: new Date(form.issueDate + "T00:00:00Z").toISOString(),
      amountFils: form.amount,
      kind: form.kind,
      status: form.status,
    };
    if (form.remark) payload.remark = form.remark;
    const res = await fetch(`/api/v1/projects/${String(projectId)}/lpos`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.status === 201) {
      onCreated();
      return;
    }
    const b = await res.json().catch(() => null);
    setErr(b?.error?.message ?? `Failed (${res.status})`);
  }

  const inputCls =
    "w-full rounded-lg border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-800";
  const labelCls = "block text-xs text-zinc-500";

  return (
    <Drawer title="New LPO" onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-3 text-sm">
        <label className={labelCls}>
          Supplier
          <select required value={form.supplierId} onChange={(e) => setForm({ ...form, supplierId: e.target.value })} className={inputCls}>
            <option value="">Select…</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className={labelCls}>
            Trade
            <select value={form.trade} onChange={(e) => setForm({ ...form, trade: e.target.value })} className={inputCls}>
              {TRADES.map((t) => <option key={t}>{t}</option>)}
            </select>
          </label>
          <label className={labelCls}>
            Issue date
            <input required type="date" value={form.issueDate} onChange={(e) => setForm({ ...form, issueDate: e.target.value })} className={inputCls} />
          </label>
          <label className={labelCls}>
            Amount (AED)
            <input required placeholder="12345.67" className={`${inputCls} tabular-nums`} value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
          </label>
          <label className={labelCls}>
            Kind
            <select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })} className={inputCls}>
              <option>STANDARD</option>
              <option>VARIATION</option>
              <option>INTERNAL_TRANSFER</option>
            </select>
          </label>
        </div>
        <label className={labelCls}>
          Description
          <input required maxLength={500} className={inputCls} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </label>
        <label className={labelCls}>
          Remark (optional)
          <input maxLength={500} className={inputCls} value={form.remark} onChange={(e) => setForm({ ...form, remark: e.target.value })} />
        </label>
        {err && <ErrorBanner message={err} />}
        <div className="flex gap-2">
          <button type="submit" className="rounded-lg bg-indigo-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-indigo-700">
            Create LPO
          </button>
          <button type="button" onClick={onClose} className="rounded-lg border border-zinc-300 px-4 py-1.5 text-sm dark:border-zinc-700">
            Cancel
          </button>
        </div>
      </form>
    </Drawer>
  );
}
