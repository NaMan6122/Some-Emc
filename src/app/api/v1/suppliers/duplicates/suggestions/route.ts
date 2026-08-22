import { apiHandler } from "@/lib/http-error";
import { requireAuth } from "@/server/auth/guards";
import { prisma } from "@/server/db";
import { findDuplicatePairs } from "@/server/services/duplicates";

// spec-006-v1: GET /api/v1/suppliers/duplicates/suggestions — advisory pairs.
export const GET = apiHandler(async (request) => {
  await requireAuth(request);
  const suppliers = await prisma.supplier.findMany({
    where: { mergedIntoId: null },
    select: { id: true, name: true },
    orderBy: { id: "asc" },
  });
  return Response.json({
    items: findDuplicatePairs(suppliers).map((p) => ({
      a: suppliers.find((s) => s.id === p.aId),
      b: suppliers.find((s) => s.id === p.bId),
      score: p.score,
    })),
  });
});
