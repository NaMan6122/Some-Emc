import { apiHandler, HttpApiError } from "@/lib/http-error";
import { requireRole } from "@/server/auth/guards";
import { deletePc, updatePc } from "@/server/services/pcs";
import { patchPcSchema } from "@/server/validation/pc";
import { parseJsonBody } from "@/server/validation/parse";
import { jsonSafe } from "@/lib/bigint-json";

type Ctx = { params: Promise<{ id: string }> };

// spec-012: PATCH|DELETE /api/v1/pcs/:id (ADMIN + FINANCE per TDD §7)
export const PATCH = apiHandler<Ctx>(async (request, ctx) => {
  const session = await requireRole(request, "ADMIN", "FINANCE");
  const { id } = await ctx.params;
  const patch = await parseJsonBody(patchPcSchema, request);
  if (Object.keys(patch).length === 0) throw new HttpApiError(422, "VALIDATION_ERROR", "Empty patch");
  const updated = await updatePc(session.id, id, patch);
  return Response.json(jsonSafe(updated));
});

export const DELETE = apiHandler<Ctx>(async (request, ctx) => {
  const session = await requireRole(request, "ADMIN", "FINANCE");
  const { id } = await ctx.params;
  await deletePc(session.id, id);
  return Response.json({ ok: true });
});
