import { apiHandler, HttpApiError } from "@/lib/http-error";
import { requireAuth, requireRole } from "@/server/auth/guards";
import { createPc, listPcs } from "@/server/services/pcs";
import { createPcSchema } from "@/server/validation/pc";
import { parseJsonBody } from "@/server/validation/parse";
import { jsonSafe } from "@/lib/bigint-json";

type Ctx = { params: Promise<{ id: string }> };

// spec-012: GET|POST /api/v1/projects/:id/pcs
export const GET = apiHandler<Ctx>(async (request, ctx) => {
  await requireAuth(request);
  const { id } = await ctx.params;
  if (!/^\d+$/.test(id)) throw new HttpApiError(404, "NOT_FOUND", "Project not found");
  const pcs = await listPcs(Number(id));
  return Response.json(jsonSafe({ items: pcs }));
});

export const POST = apiHandler<Ctx>(async (request, ctx) => {
  // TDD §7 matrix: ADMIN and FINANCE hold PC write rights.
  const session = await requireRole(request, "ADMIN", "FINANCE");
  const { id } = await ctx.params;
  if (!/^\d+$/.test(id)) throw new HttpApiError(404, "NOT_FOUND", "Project not found");
  const input = await parseJsonBody(createPcSchema, request);
  const created = await createPc(session.id, Number(id), input);
  return Response.json(jsonSafe(created), { status: 201 });
});
