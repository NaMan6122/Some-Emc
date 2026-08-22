import { z } from "zod";
import { prisma } from "@/server/db";
import { apiHandler, HttpApiError } from "@/lib/http-error";
import { requireRole } from "@/server/auth/guards";
import { jsonSafe } from "@/lib/bigint-json";

const querySchema = z.object({
  entity: z.string().max(50).optional(),
  entityId: z.string().max(50).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  cursor: z.string().regex(/^\d+$/).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// spec-004-v1: GET /api/v1/audit — ADMIN-only, filtered, cursor-paginated.
// Immutability by design: this module intentionally exports NO mutating handler
// (no POST/PATCH/PUT/DELETE) — verified by structural test.
export const GET = apiHandler(async (request) => {
  await requireRole(request, "ADMIN");

  const url = new URL(request.url);
  const parsed = querySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) {
    throw new HttpApiError(422, "VALIDATION_ERROR", "Invalid audit query", parsed.error.flatten().fieldErrors);
  }
  const q = parsed.data;

  const where = {
    ...(q.entity ? { entity: q.entity } : {}),
    ...(q.entityId ? { entityId: q.entityId } : {}),
    ...(q.from || q.to
      ? { at: { ...(q.from ? { gte: new Date(q.from) } : {}), ...(q.to ? { lte: new Date(q.to) } : {}) } }
      : {}),
  };

  const rows = await prisma.auditLog.findMany({
    where,
    orderBy: { id: "desc" },
    take: q.limit + 1,
    ...(q.cursor ? { cursor: { id: BigInt(q.cursor) }, skip: 1 } : {}),
  });

  const hasMore = rows.length > q.limit;
  const items = hasMore ? rows.slice(0, -1) : rows;
  const nextCursor = hasMore ? String(items[items.length - 1].id) : null;

  return Response.json(jsonSafe({ items, nextCursor }));
});
