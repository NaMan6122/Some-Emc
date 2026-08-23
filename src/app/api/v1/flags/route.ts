import { apiHandler } from "@/lib/http-error";
import { requireAuth } from "@/server/auth/guards";
import { prisma } from "@/server/db";
import { jsonSafe } from "@/lib/bigint-json";

// spec-015 tab 6: read-only flags feed for the placeholder Data Quality queue.
// Full FR-9 management API (assign/resolve) arrives in M3.
export const GET = apiHandler(async (request) => {
  await requireAuth(request);
  const url = new URL(request.url);
  const status = url.searchParams.get("status");
  const limitRaw = Number(url.searchParams.get("limit") ?? "100");
  const limit = Math.min(Math.max(Number.isFinite(limitRaw) ? limitRaw : 100, 1), 200);
  const items = await prisma.dataFlag.findMany({
    where: status === "OPEN" || status === "RESOLVED" ? { status } : undefined,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit,
  });
  return Response.json(jsonSafe({ items }));
});
