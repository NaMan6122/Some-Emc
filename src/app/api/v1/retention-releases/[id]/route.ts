import { apiHandler } from "@/lib/http-error";
import { requireRole } from "@/server/auth/guards";
import { deleteRetentionRelease } from "@/server/services/retention";
import { jsonSafe } from "@/lib/bigint-json";

type Ctx = { params: Promise<{ id: string }> };

// spec-019-v1: DELETE /api/v1/retention-releases/:id — admin-only correction
// path for the immutable ledger; audited. No PATCH by design.
export const DELETE = apiHandler<Ctx>(async (request, ctx) => {
  const session = await requireRole(request, "ADMIN");
  const { id } = await ctx.params;
  const deleted = await deleteRetentionRelease(session.id, id);
  return Response.json(jsonSafe(deleted));
});
