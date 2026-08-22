import { EmptyState } from "@/components/ui/primitives";

export default function Page() {
  return (
    <div className="mx-auto max-w-3xl">
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">ProCare</p>
      <h1 className="mb-6 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">Data Flags</h1>
      <EmptyState title="Data Flags" body="Full FR-9 queue arrives in M3; seeded flags listed then." />
    </div>
  );
}
