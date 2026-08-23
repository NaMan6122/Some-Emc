import { apiHandler, HttpApiError } from "@/lib/http-error";
import { requireAuth } from "@/server/auth/guards";
import { computeVariance } from "@/server/services/budgets";
import { jsonSafe } from "@/lib/bigint-json";

type Ctx = { params: Promise<{ id: string }> };

// spec-011: GET /api/v1/projects/:id/variance
export const GET = apiHandler<Ctx>(async (request, ctx) => {
  await requireAuth(request);
  const { id } = await ctx.params;
  if (!/^\d+$/.test(id)) throw new HttpApiError(404, "NOT_FOUND", "Project not found");
  const rows = await computeVariance(Number(id));
  return Response.json(
    jsonSafe({
      items: rows.map((r) => ({
        ...r,
        budgetFils: r.budgetFils.toString(),
        committedFils: r.committedFils.toString(),
      })),
    }),
  );
});
