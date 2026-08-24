import { apiHandler } from "@/lib/http-error";
import { requireRole } from "@/server/auth/guards";
import { prisma } from "@/server/db";
import { createUser } from "@/server/services/users-admin";
import { createUserSchema } from "@/server/validation/user-admin";
import { parseJsonBody } from "@/server/validation/parse";
import { jsonSafe } from "@/lib/bigint-json";

// spec-016 + spec-024: GET /api/v1/users.
// - ADMIN (user administration): rich rows incl. email/status/created.
// - Triage roles (assignee picker): minimal {id,name,role} of active users only.
export const GET = apiHandler(async (request) => {
  const session = await requireRole(request, "ADMIN", "PROCUREMENT", "COMMERCIAL", "FINANCE");
  if (session.role === "ADMIN") {
    const items = await prisma.user.findMany({
      select: { id: true, name: true, email: true, role: true, active: true, createdAt: true },
      orderBy: [{ name: "asc" }, { id: "asc" }],
    });
    return Response.json(jsonSafe({ items }));
  }
  const items = await prisma.user.findMany({
    where: { active: true },
    select: { id: true, name: true, role: true },
    orderBy: [{ name: "asc" }, { id: "asc" }],
  });
  return Response.json({ items });
});

// spec-024-v1: POST /api/v1/users — ADMIN only. Response carries the one-time
// password exactly once; audit stores no credential material.
export const POST = apiHandler(async (request) => {
  const session = await requireRole(request, "ADMIN");
  const input = await parseJsonBody(createUserSchema, request);
  const { user, oneTimePassword } = await createUser(session.id, input);
  return Response.json(jsonSafe({ ...user, oneTimePassword }), { status: 201 });
});

