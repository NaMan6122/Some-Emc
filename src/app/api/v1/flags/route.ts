import { apiHandler } from "@/lib/http-error";
import { requireAuth } from "@/server/auth/guards";
import { prisma } from "@/server/db";
import { jsonSafe } from "@/lib/bigint-json";

// spec-015 tab 6 (read-only feed) extended by spec-016-v1: status/severity/
// ruleCode/entityType/assigneeId filters plus an openBySeverity summary for
// the queue header. Full triage writes live on PATCH /api/v1/flags/:id.
const FLAG_STATUSES = ["OPEN", "RESOLVED", "WONT_FIX"] as const;
const SEVERITIES = ["HIGH", "MEDIUM", "LOW"] as const;

export const GET = apiHandler(async (request) => {
  await requireAuth(request);
  const url = new URL(request.url);
  const p = url.searchParams;
  const status = p.get("status");
  const severity = p.get("severity");
  const ruleCode = p.get("ruleCode");
  const entityType = p.get("entityType");
  const assigneeRaw = p.get("assigneeId");
  const limitRaw = Number(p.get("limit") ?? "100");
  const limit = Math.min(Math.max(Number.isFinite(limitRaw) ? limitRaw : 100, 1), 200);

  const where = {
    ...(FLAG_STATUSES.includes(status as (typeof FLAG_STATUSES)[number]) ? { status: status! } : {}),
    ...(SEVERITIES.includes(severity as (typeof SEVERITIES)[number]) ? { severity: severity! } : {}),
    ...(ruleCode ? { ruleCode } : {}),
    ...(entityType ? { entityType } : {}),
    ...(assigneeRaw && /^\d+$/.test(assigneeRaw) ? { assigneeId: Number(assigneeRaw) } : {}),
  };

  const [items, bySeverity] = await Promise.all([
    prisma.dataFlag.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit,
    }),
    prisma.dataFlag.groupBy({ by: ["severity"], where: { status: "OPEN" }, _count: { _all: true } }),
  ]);

  return Response.json(
    jsonSafe({
      items,
      meta: {
        openBySeverity: Object.fromEntries(bySeverity.map((g) => [g.severity, g._count._all])),
      },
    }),
  );
});
