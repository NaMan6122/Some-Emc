import { z } from "zod";
import { apiHandler } from "@/lib/http-error";
import { requireAuth, requireRole } from "@/server/auth/guards";
import { createSupplier, listSuppliers } from "@/server/services/suppliers";
import { parseJsonBody } from "@/server/validation/parse";
import { jsonSafe } from "@/lib/bigint-json";

const createSchema = z.object({
  name: z.string().trim().min(2).max(200),
  aliases: z.array(z.string().trim().min(1).max(200)).max(20).default([]),
});

// spec-006-v1: GET (any role, optional ?q=) | POST (ADMIN|PROCUREMENT) /api/v1/suppliers
export const GET = apiHandler(async (request) => {
  await requireAuth(request);
  const q = new URL(request.url).searchParams.get("q") ?? undefined;
  return Response.json(jsonSafe({ items: await listSuppliers(q) }));
});

export const POST = apiHandler(async (request) => {
  const session = await requireRole(request, "ADMIN", "PROCUREMENT");
  const input = await parseJsonBody(createSchema, request);
  const created = await createSupplier(session.id, input.name, input.aliases);
  return Response.json(jsonSafe(created), { status: 201 });
});
