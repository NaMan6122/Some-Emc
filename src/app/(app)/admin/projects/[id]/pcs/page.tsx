import { PcsClient } from "./PcsClient";

// spec-012-v2: admin PC log — table + create/edit form + status workflow.
// Route access inherits the ADMIN-only /admin/projects rule from nav config;
// API writes are ADMIN+FINANCE per TDD §7.
export default async function ProjectPcsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PcsClient projectId={id} />;
}
