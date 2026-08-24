import { apiHandler } from "@/lib/http-error";
import { requireAuth, requireRole } from "@/server/auth/guards";
import { createAllocation, listAllocations } from "@/server/services/lpo-allocations";
import { createAllocationSchema } from "@/server/validation/lpo-allocation";
import { parseJsonBody } from "@/server/validation/parse";
import { jsonSafe } from "@/lib/bigint-json";

type Ctx = { params: Promise<{ id: string }> };

// spec-022-v1: GET (any authenticated) | POST (ADMIN+COMMERCIAL per TDD §7
// Budgets row) /api/v1/lpos/:id/allocation. No UPDATE — corrections delete
// and re-create.
export const GET = apiHandler<Ctx>(async (request, ctx) => {
  await requireAuth(request);
  const { id } = await ctx.params;
  return Response.json(jsonSafe(await listAllocations(id)));
});

export const POST = apiHandler<Ctx>(async (request, ctx) => {
  const session = await requireRole(request, "ADMIN", "COMMERCIAL");
  const { id } = await ctx.params;
  const input = await parseJsonBody(createAllocationSchema, request);
  const created = await createAllocation(session.id, id, input);
  return Response.json(jsonSafe(created), { status: 201 });
});
