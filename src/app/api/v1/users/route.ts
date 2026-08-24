import { apiHandler } from "@/lib/http-error";
import { requireRole } from "@/server/auth/guards";
import { prisma } from "@/server/db";

// spec-016-v1: GET /api/v1/users — assignee picker for the flag queue.
// Returns directory-light rows only ({id,name,role}); full user administration
// stays out of scope. Triage-capable roles + ADMIN may read it.
export const GET = apiHandler(async (request) => {
  await requireRole(request, "ADMIN", "PROCUREMENT", "COMMERCIAL", "FINANCE");
  const items = await prisma.user.findMany({
    select: { id: true, name: true, role: true },
    orderBy: [{ name: "asc" }, { id: "asc" }],
  });
  return Response.json({ items });
});
