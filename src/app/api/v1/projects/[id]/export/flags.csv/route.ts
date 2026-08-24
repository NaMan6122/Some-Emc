import { apiHandler, HttpApiError } from "@/lib/http-error";
import { requireAuth } from "@/server/auth/guards";
import { flagListWhere } from "@/server/services/flags";
import { prisma } from "@/server/db";
import { jsonSafe } from "@/lib/bigint-json";
import { csvResponse, toCsv, type CsvCell } from "@/lib/csv";

type Ctx = { params: Promise<{ id: string }> };

// spec-018-v1: GET /api/v1/projects/:id/export/flags.csv — any authenticated
// role; honors the same status/severity/ruleCode/entityType/assigneeId filters
// as GET /api/v1/flags. Note: DataFlag rows are not project-scoped; this route
// exports the queue filtered by query params only (same as the JSON feed).
export const GET = apiHandler<Ctx>(async (request, ctx) => {
  await requireAuth(request);
  const { id } = await ctx.params;
  if (!/^\d+$/.test(id)) throw new HttpApiError(404, "NOT_FOUND", "Project not found");
  const where = flagListWhere(new URL(request.url).searchParams);
  const flags = await prisma.dataFlag.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 5000,
  });
  const body = toCsv(
    ["severity", "ruleCode", "entityType", "entityId", "status", "assigneeId", "message", "resolutionNote", "resolvedAt", "createdAt"],
    jsonSafe(flags).map((f: Record<string, unknown>): CsvCell[] => [
      String(f.severity),
      String(f.ruleCode),
      String(f.entityType),
      f.entityId as CsvCell,
      String(f.status),
      (f.assigneeId ?? "") as CsvCell,
      String(f.message),
      (f.resolutionNote ?? "") as CsvCell,
      (f.resolvedAt ?? "") as CsvCell,
      String(f.createdAt),
    ]),
  );
  return csvResponse(`flags-${id}.csv`, body);
});
