import { apiHandler, HttpApiError } from "@/lib/http-error";
import { requireAuth, requireRole } from "@/server/auth/guards";
import { createBudgetLine, listBudgetLines } from "@/server/services/budgets";
import { createBudgetLineSchema } from "@/server/validation/budget-line";
import { parseJsonBody } from "@/server/validation/parse";
import { jsonSafe } from "@/lib/bigint-json";

type Ctx = { params: Promise<{ id: string }> };

// spec-011: GET|POST /api/v1/projects/:id/budget-lines
// Accepts both numeric id (for route-level) and code via the service.
export const GET = apiHandler<Ctx>(async (request, ctx) => {
  await requireAuth(request);
  const { id } = await ctx.params;
  if (!/^\d+$/.test(id)) throw new HttpApiError(404, "NOT_FOUND", "Project not found");
  const lines = await listBudgetLines(Number(id));
  return Response.json(jsonSafe({ items: lines }));
});

export const POST = apiHandler<Ctx>(async (request, ctx) => {
  const session = await requireRole(request, "ADMIN", "COMMERCIAL");
  const { id } = await ctx.params;
  if (!/^\d+$/.test(id)) throw new HttpApiError(404, "NOT_FOUND", "Project not found");
  const input = await parseJsonBody(createBudgetLineSchema, request);
  const created = await createBudgetLine(session.id, Number(id), input);
  return Response.json(jsonSafe(created), { status: 201 });
});
