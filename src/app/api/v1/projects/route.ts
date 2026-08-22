import { apiHandler } from "@/lib/http-error";
import { requireAuth, requireRole } from "@/server/auth/guards";
import { createProject, listProjects } from "@/server/services/projects";
import { createProjectSchema } from "@/server/validation/project";
import { parseJsonBody } from "@/server/validation/parse";
import { jsonSafe } from "@/lib/bigint-json";

// spec-005-v1: GET (any authenticated role) | POST (ADMIN) /api/v1/projects
export const GET = apiHandler(async (request) => {
  await requireAuth(request);
  return Response.json(jsonSafe({ items: await listProjects() }));
});

export const POST = apiHandler(async (request) => {
  const session = await requireRole(request, "ADMIN");
  const input = await parseJsonBody(createProjectSchema, request);
  const created = await createProject(session.id, input);
  return Response.json(jsonSafe(created), { status: 201 });
});
