import { apiHandler, HttpApiError } from "@/lib/http-error";
import { requireAuth, requireRole } from "@/server/auth/guards";
import { createLpo, listLpos } from "@/server/services/lpos";
import { createLpoSchema, listQuerySchema } from "@/server/validation/lpo";
import { parseJsonBody } from "@/server/validation/parse";
import { jsonSafe } from "@/lib/bigint-json";

type Ctx = { params: Promise<{ id: string }> };

// spec-007-v1: GET|POST /api/v1/projects/:id/lpos
export const GET = apiHandler<Ctx>(async (request, ctx) => {
  await requireAuth(request);
  const { id } = await ctx.params;
  if (!/^\d+$/.test(id)) throw new HttpApiError(404, "NOT_FOUND", "Project not found");

  const parsed = listQuerySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) {
    throw new HttpApiError(422, "VALIDATION_ERROR", "Invalid query", parsed.error.flatten().fieldErrors);
  }
  const result = await listLpos(Number(id), parsed.data);
  return Response.json(
    jsonSafe({
      items: result.items,
      nextCursor: result.nextCursor,
      totals: { ...result.totals, activeSumFils: result.totals.activeSumFils.toString() },
    }),
  );
});

export const POST = apiHandler<Ctx>(async (request, ctx) => {
  const session = await requireRole(request, "ADMIN", "PROCUREMENT");
  const { id } = await ctx.params;
  if (!/^\d+$/.test(id)) throw new HttpApiError(404, "NOT_FOUND", "Project not found");

  const input = await parseJsonBody(createLpoSchema, request);
  const created = await createLpo(session.id, session.role, Number(id), input);
  return Response.json(jsonSafe(created), { status: 201 });
});
