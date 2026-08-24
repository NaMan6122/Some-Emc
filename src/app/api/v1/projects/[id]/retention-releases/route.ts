import { apiHandler, HttpApiError } from "@/lib/http-error";
import { requireAuth, requireRole } from "@/server/auth/guards";
import { createRetentionRelease, listRetentionReleases } from "@/server/services/retention";
import { createRetentionReleaseSchema } from "@/server/validation/retention";
import { parseJsonBody } from "@/server/validation/parse";
import { jsonSafe } from "@/lib/bigint-json";

type Ctx = { params: Promise<{ id: string }> };

// spec-019-v1: GET (any authenticated) | POST (FINANCE+ADMIN per TDD §7 PCs
// row) /api/v1/projects/:id/retention-releases. No PATCH — financial record.
export const GET = apiHandler<Ctx>(async (request, ctx) => {
  await requireAuth(request);
  const { id } = await ctx.params;
  if (!/^\d+$/.test(id)) throw new HttpApiError(404, "NOT_FOUND", "Project not found");
  const items = await listRetentionReleases(Number(id));
  return Response.json(jsonSafe({ items }));
});

export const POST = apiHandler<Ctx>(async (request, ctx) => {
  const session = await requireRole(request, "ADMIN", "FINANCE");
  const { id } = await ctx.params;
  if (!/^\d+$/.test(id)) throw new HttpApiError(404, "NOT_FOUND", "Project not found");
  const input = await parseJsonBody(createRetentionReleaseSchema, request);
  const created = await createRetentionRelease(session.id, Number(id), input);
  return Response.json(jsonSafe(created), { status: 201 });
});
