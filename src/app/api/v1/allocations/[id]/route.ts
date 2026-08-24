import { apiHandler } from "@/lib/http-error";
import { requireRole } from "@/server/auth/guards";
import { deleteAllocation } from "@/server/services/lpo-allocations";
import { jsonSafe } from "@/lib/bigint-json";

type Ctx = { params: Promise<{ id: string }> };

// spec-022-v1: DELETE /api/v1/allocations/:id — ADMIN+COMMERCIAL; audited.
export const DELETE = apiHandler<Ctx>(async (request, ctx) => {
  const session = await requireRole(request, "ADMIN", "COMMERCIAL");
  const { id } = await ctx.params;
  const deleted = await deleteAllocation(session.id, id);
  return Response.json(jsonSafe(deleted));
});
