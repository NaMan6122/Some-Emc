import { apiHandler, HttpApiError } from "@/lib/http-error";
import { z } from "zod";
import { requireRole } from "@/server/auth/guards";
import { prisma } from "@/server/db";
import { jsonSafe } from "@/lib/bigint-json";
import { csvResponse, toCsv, type CsvCell } from "@/lib/csv";

const querySchema = z.object({
  entity: z.string().max(50).optional(),
  entityId: z.string().max(50).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

// spec-018-v1: GET /api/v1/audit.csv — ADMIN-only like the JSON feed; honors
// the identical entity/entityId/from/to filters. Bounded sweep at current scale.
export const GET = apiHandler(async (request) => {
  await requireRole(request, "ADMIN");
  const parsed = querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
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
  const rows = await prisma.auditLog.findMany({ where, orderBy: { id: "desc" }, take: 5000 });
  const body = toCsv(
    ["id", "at", "actorId", "entity", "entityId", "action", "before", "after"],
    jsonSafe(rows).map((r: Record<string, unknown>): CsvCell[] => [
      r.id as CsvCell,
      String(r.at),
      r.actorId as CsvCell,
      String(r.entity),
      String(r.entityId),
      String(r.action),
      r.before == null ? "" : JSON.stringify(r.before),
      r.after == null ? "" : JSON.stringify(r.after),
    ]),
  );
  return csvResponse("audit.csv", body);
});
