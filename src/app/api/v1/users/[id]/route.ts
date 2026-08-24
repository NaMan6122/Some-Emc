import { apiHandler } from "@/lib/http-error";
import { requireRole } from "@/server/auth/guards";
import { patchUser } from "@/server/services/users-admin";
import { patchUserSchema } from "@/server/validation/user-admin";
import { parseJsonBody } from "@/server/validation/parse";
import { jsonSafe } from "@/lib/bigint-json";

type Ctx = { params: Promise<{ id: string }> };

// spec-024-v1: PATCH /api/v1/users/:id — ADMIN only. Handles role change,
// activation toggle and password reset; every rights/credential change bumps
// tokenVersion (instant revocation). One-time passwords returned once.
export const PATCH = apiHandler<Ctx>(async (request, ctx) => {
  const session = await requireRole(request, "ADMIN");
  const { id } = await ctx.params;
  const patch = await parseJsonBody(patchUserSchema, request);
  const result = await patchUser(session.id, id, patch);
  return Response.json(jsonSafe(result));
});
