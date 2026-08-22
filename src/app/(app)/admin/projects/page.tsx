import { ProjectsClient } from "./ProjectsClient";

// spec-005-v1: minimal admin screen — list + create/edit form.
export default function AdminProjectsPage() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Administration</p>
      <h1 className="mb-6 text-2xl font-semibold tracking-tight text-zinc-900">Projects</h1>
      <ProjectsClient />
    </main>
  );
}
