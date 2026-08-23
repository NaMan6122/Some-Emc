import { VosClient } from "./VosClient";

// spec-013-v1: admin VO list — status pills, claim-exposure banner.
// Route access inherits the ADMIN-only /admin/projects rule; API writes are
// ADMIN+COMMERCIAL per TDD §7.
export default async function ProjectVosPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <VosClient projectId={id} />;
}
