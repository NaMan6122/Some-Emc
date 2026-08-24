"use client";

// spec-009-v1 shared primitives — design.md §8 states & KPI card.

export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div
      data-testid="empty-state"
      className="rounded-xl border border-zinc-200 bg-white p-10 text-center shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
    >
      <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{title}</p>
      <p className="mt-1 text-sm text-zinc-500">{body}</p>
    </div>
  );
}

export function ErrorBanner({ message }: { message: string }) {
  return (
    <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
      {message}
    </div>
  );
}

export function KpiCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="flex min-w-0 flex-col rounded-xl border border-zinc-200 bg-white p-3 sm:p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <p className="truncate text-[10px] font-semibold uppercase tracking-wide text-zinc-500 sm:text-[11px]">{label}</p>
      <p
        className="mt-1 break-words text-base font-semibold tabular-nums tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-lg lg:text-xl xl:text-2xl"
        title={value}
      >
        {value}
      </p>
      {sub && <p className="mt-0.5 truncate text-[11px] text-zinc-500 sm:text-xs">{sub}</p>}
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  context,
  actions,
}: {
  eyebrow: string;
  title: string;
  context?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">{eyebrow}</p>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">{title}</h1>
        {context && <p className="mt-0.5 text-sm text-zinc-500">{context}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
