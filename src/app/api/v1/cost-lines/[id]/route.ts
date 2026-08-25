import { apiHandler } from "@/lib/http-error";
import { requireRole } from "@/server/auth/guards";
import { deleteCost } from "@/server/services/cost-overviews";
import { jsonSafe } from "@/lib/bigint-json";

type Ctx = { params: Promise<{ id: string }> };

// spec-028-v1: DELETE /api/v1/cost-lines/:id — ADMIN+COMMERCIAL; audited.
export const DELETE = apiHandler<Ctx>(async (request, ctx) => {
  const session = await requireRole(request, "ADMIN", "COMMERCIAL");
  const { id } = await ctx.params;
  const deleted = await deleteCost("CostLine", session.id, id);
  return Response.json(jsonSafe(deleted));
});
