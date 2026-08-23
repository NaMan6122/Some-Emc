import { BudgetClient } from "./BudgetClient";

// spec-011-v1: minimal admin screen section — Administration → Projects → Budget tab.
// Route access inherits the ADMIN-only /admin/projects rule from nav config.
export default async function ProjectBudgetPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
        Administration · Projects · Budget
      </p>
      <BudgetClient projectId={id} />
    </main>
  );
}
