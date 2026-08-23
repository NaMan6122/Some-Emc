import { apiHandler, HttpApiError } from "@/lib/http-error";
import { requireAuth } from "@/server/auth/guards";
import { budgetAnalytics } from "@/server/services/analytics";
import { jsonSafe } from "@/lib/bigint-json";

type Ctx = { params: Promise<{ id: string }> };

// spec-014: GET /api/v1/projects/:id/analytics/budget (variance incl. SWPS exclusion lens)
export const GET = apiHandler<Ctx>(async (request, ctx) => {
  await requireAuth(request);
  const { id } = await ctx.params;
  if (!/^\d+$/.test(id)) throw new HttpApiError(404, "NOT_FOUND", "Project not found");
  return Response.json(jsonSafe(await budgetAnalytics(Number(id))));
});
