import { apiHandler } from "@/lib/http-error";
import { requireAuth } from "@/server/auth/guards";

// spec-003-v2: GET /api/v1/auth/me
export const GET = apiHandler(async (request) => {
  const session = await requireAuth(request);
  return Response.json({ id: session.id, email: session.email, name: session.name, role: session.role });
});
