import { apiHandler, HttpApiError } from "@/lib/http-error";
import { requireRole } from "@/server/auth/guards";
import { updateVo } from "@/server/services/vos";
import { patchVoSchema } from "@/server/validation/vo";
import { parseJsonBody } from "@/server/validation/parse";
import { jsonSafe } from "@/lib/bigint-json";

type Ctx = { params: Promise<{ id: string }> };

// spec-013: PATCH /api/v1/vos/:id (COMMERCIAL + ADMIN per TDD §7). No DELETE:
// variation orders are financial records; spec deliberately omits it.
export const PATCH = apiHandler<Ctx>(async (request, ctx) => {
  const session = await requireRole(request, "ADMIN", "COMMERCIAL");
  const { id } = await ctx.params;
  const patch = await parseJsonBody(patchVoSchema, request);
  if (Object.keys(patch).length === 0) throw new HttpApiError(422, "VALIDATION_ERROR", "Empty patch");
  const updated = await updateVo(session.id, id, patch);
  return Response.json(jsonSafe(updated));
});
