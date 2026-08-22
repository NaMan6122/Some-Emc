import { EmptyState } from "@/components/ui/primitives";

export default function Page() {
  return (
    <div className="mx-auto max-w-3xl">
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">ProCare</p>
      <h1 className="mb-6 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">Users</h1>
      <EmptyState title="Users" body="User management lands with the admin batch." />
    </div>
  );
}
