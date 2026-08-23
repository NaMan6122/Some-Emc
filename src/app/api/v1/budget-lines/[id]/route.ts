import { apiHandler, HttpApiError } from "@/lib/http-error";
import { requireRole } from "@/server/auth/guards";
import { deleteBudgetLine, updateBudgetLine } from "@/server/services/budgets";
import { updateBudgetLineSchema } from "@/server/validation/budget-line";
import { parseJsonBody } from "@/server/validation/parse";
import { jsonSafe } from "@/lib/bigint-json";

type Ctx = { params: Promise<{ id: string }> };

// spec-011: PATCH|DELETE /api/v1/budget-lines/:id
export const PATCH = apiHandler<Ctx>(async (request, ctx) => {
  const session = await requireRole(request, "ADMIN", "COMMERCIAL");
  const { id } = await ctx.params;
  const patch = await parseJsonBody(updateBudgetLineSchema, request);
  if (Object.keys(patch).length === 0) throw new HttpApiError(422, "VALIDATION_ERROR", "Empty patch");
  const updated = await updateBudgetLine(session.id, id, patch);
  return Response.json(jsonSafe(updated));
});

export const DELETE = apiHandler<Ctx>(async (request, ctx) => {
  const session = await requireRole(request, "ADMIN");
  const { id } = await ctx.params;
  await deleteBudgetLine(session.id, id);
  return Response.json({ ok: true });
});
