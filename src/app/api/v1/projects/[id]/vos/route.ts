import { apiHandler, HttpApiError } from "@/lib/http-error";
import { requireAuth, requireRole } from "@/server/auth/guards";
import { createVo, listVos } from "@/server/services/vos";
import { createVoSchema } from "@/server/validation/vo";
import { parseJsonBody } from "@/server/validation/parse";
import { jsonSafe } from "@/lib/bigint-json";

type Ctx = { params: Promise<{ id: string }> };

// spec-013: GET|POST /api/v1/projects/:id/vos
export const GET = apiHandler<Ctx>(async (request, ctx) => {
  await requireAuth(request);
  const { id } = await ctx.params;
  if (!/^\d+$/.test(id)) throw new HttpApiError(404, "NOT_FOUND", "Project not found");
  const vos = await listVos(Number(id));
  return Response.json(jsonSafe({ items: vos }));
});

export const POST = apiHandler<Ctx>(async (request, ctx) => {
  // TDD §7 matrix: COMMERCIAL and ADMIN hold VO write rights.
  const session = await requireRole(request, "ADMIN", "COMMERCIAL");
  const { id } = await ctx.params;
  if (!/^\d+$/.test(id)) throw new HttpApiError(404, "NOT_FOUND", "Project not found");
  const input = await parseJsonBody(createVoSchema, request);
  const created = await createVo(session.id, Number(id), input);
  return Response.json(jsonSafe(created), { status: 201 });
});
