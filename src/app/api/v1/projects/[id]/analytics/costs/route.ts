import { apiHandler } from "@/lib/http-error";
import { requireAuth } from "@/server/auth/guards";
import { costControl } from "@/server/services/analytics";
import { jsonSafe } from "@/lib/bigint-json";

type Ctx = { params: Promise<{ id: string }> };

// spec-030-v1: GET /api/v1/projects/:id/analytics/costs — read-only derived
// analytics (budget → committed → actual → forecast → margin). No mutations.
export const GET = apiHandler<Ctx>(async (request, ctx) => {
  await requireAuth(request);
  const { id } = await ctx.params;
  const data = await costControl(Number(id));
  return Response.json(jsonSafe(data));
});
