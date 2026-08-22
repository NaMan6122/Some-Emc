import { apiHandler, HttpApiError } from "@/lib/http-error";
import { requireRole } from "@/server/auth/guards";
import { deleteProject, getProject, updateProject } from "@/server/services/projects";
import { updateProjectSchema } from "@/server/validation/project";
import { parseJsonBody } from "@/server/validation/parse";
import { jsonSafe } from "@/lib/bigint-json";

type Ctx = { params: Promise<{ id: string }> };

// spec-005-v1: GET|PATCH|DELETE /api/v1/projects/:id — mutations ADMIN-only.
export const GET = apiHandler<Ctx>(async (_request, ctx) => {
  const { id } = await ctx.params;
  return Response.json(jsonSafe(await getProject(id)));
});

export const PATCH = apiHandler<Ctx>(async (request, ctx) => {
  const session = await requireRole(request, "ADMIN");
  const { id } = await ctx.params;
  const patch = await parseJsonBody(updateProjectSchema, request);
  if (Object.keys(patch).length === 0) {
    throw new HttpApiError(422, "VALIDATION_ERROR", "Empty patch");
  }
  const updated = await updateProject(session.id, id, patch);
  return Response.json(jsonSafe(updated));
});

export const DELETE = apiHandler<Ctx>(async (request, ctx) => {
  const session = await requireRole(request, "ADMIN");
  const { id } = await ctx.params;
  await deleteProject(session.id, id);
  return Response.json({ ok: true });
});
