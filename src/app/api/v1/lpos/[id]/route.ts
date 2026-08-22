import { apiHandler } from "@/lib/http-error";
import { requireAuth } from "@/server/auth/guards";
import { getLpoChain, patchLpo } from "@/server/services/lpos";
import { patchLpoSchema } from "@/server/validation/lpo";
import { parseJsonBody } from "@/server/validation/parse";
import { jsonSafe } from "@/lib/bigint-json";

type Ctx = { params: Promise<{ id: string }> };

// spec-007-v1: GET /api/v1/lpos/:id (with revision chain)
export const GET = apiHandler<Ctx>(async (request, ctx) => {
  await requireAuth(request);
  const { id } = await ctx.params;
  return Response.json(jsonSafe(await getLpoChain(id)));
});

// PATCH handles both in-place edits and revision creation (financial fields on ISSUED).
// Auth only here — fine-grained role rules (COMMERCIAL voId-only, read-only roles)
// are enforced inside the service.
export const PATCH = apiHandler<Ctx>(async (request, ctx) => {
  const session = await requireAuth(request);
  const { id } = await ctx.params;
  const patch = await parseJsonBody(patchLpoSchema, request);
  if (Object.keys(patch).length === 0) {
    const { HttpApiError } = await import("@/lib/http-error");
    throw new HttpApiError(422, "VALIDATION_ERROR", "Empty patch");
  }
  const updated = await patchLpo(session.id, session.role, id, patch);
  return Response.json(jsonSafe(updated));
});
