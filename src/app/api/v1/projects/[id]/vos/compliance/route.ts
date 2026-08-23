import { apiHandler, HttpApiError } from "@/lib/http-error";
import { requireAuth } from "@/server/auth/guards";
import { computeCompliance, reconcileUnapprovedVoClaim } from "@/server/services/vos";
import { jsonSafe } from "@/lib/bigint-json";

type Ctx = { params: Promise<{ id: string }> };

// spec-013: GET /api/v1/projects/:id/vos/compliance — unapprovedVoExposure KPI.
export const GET = apiHandler<Ctx>(async (request, ctx) => {
  await requireAuth(request);
  const { id } = await ctx.params;
  if (!/^\d+$/.test(id)) throw new HttpApiError(404, "NOT_FOUND", "Project not found");
  const projectId = Number(id);
  await reconcileUnapprovedVoClaim(projectId);
  return Response.json(jsonSafe(await computeCompliance(projectId)));
});
