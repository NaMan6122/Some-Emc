import { apiHandler } from "@/lib/http-error";
import { requireAuth } from "@/server/auth/guards";
import { patchFlag } from "@/server/services/flags";
import { patchFlagSchema } from "@/server/validation/flag";
import { parseJsonBody } from "@/server/validation/parse";
import { jsonSafe } from "@/lib/bigint-json";

type Ctx = { params: Promise<{ id: string }> };

// spec-016-v1: PATCH /api/v1/flags/:id — assign / resolve / wont-fix.
// Role gates are domain-scoped inside the service (TDD §7 flags-resolve row).
export const PATCH = apiHandler<Ctx>(async (request, ctx) => {
  const session = await requireAuth(request);
  const { id } = await ctx.params;
  const patch = await parseJsonBody(patchFlagSchema, request);
  const updated = await patchFlag(session, id, patch);
  return Response.json(jsonSafe(updated));
});
