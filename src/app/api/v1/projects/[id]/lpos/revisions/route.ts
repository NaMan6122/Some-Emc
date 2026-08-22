import { apiHandler, HttpApiError } from "@/lib/http-error";
import { requireRole } from "@/server/auth/guards";
import { createLpo } from "@/server/services/lpos";
import { createLpoSchema } from "@/server/validation/lpo";
import { parseJsonBody } from "@/server/validation/parse";
import { jsonSafe } from "@/lib/bigint-json";

type Ctx = { params: Promise<{ id: string }> };

// spec-007-v1: POST /api/v1/projects/:id/lpos/revisions is folded into
// PATCH /api/v1/lpos/:id (revision rule). This route exists for explicit
// revision creation at a chosen project — same semantics as PATCH with
// financial fields on an ISSUED lpo.
export const POST = apiHandler<Ctx>(async (request, ctx) => {
  const session = await requireRole(request, "ADMIN", "PROCUREMENT");
  const { id } = await ctx.params;
  if (!/^\d+$/.test(id)) throw new HttpApiError(404, "NOT_FOUND", "Project not found");

  const input = await parseJsonBody(createLpoSchema, request);
  const created = await createLpo(session.id, session.role, Number(id), input);
  return Response.json(jsonSafe(created), { status: 201 });
});
