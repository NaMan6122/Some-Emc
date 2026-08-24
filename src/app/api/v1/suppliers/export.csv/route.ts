import { apiHandler, HttpApiError } from "@/lib/http-error";
import { z } from "zod";
import { requireAuth } from "@/server/auth/guards";
import { prisma } from "@/server/db";
import { normalizeSupplierName } from "@/server/services/suppliers";
import { jsonSafe } from "@/lib/bigint-json";
import { csvResponse, toCsv, type CsvCell } from "@/lib/csv";

const querySchema = z.object({ q: z.string().max(100).optional() });

// spec-018-v1: GET /api/v1/suppliers/export.csv?q= — same read gate and q
// filter as GET /api/v1/suppliers.
export const GET = apiHandler(async (request) => {
  await requireAuth(request);
  const parsed = querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) {
    throw new HttpApiError(422, "VALIDATION_ERROR", "Invalid query", parsed.error.flatten().fieldErrors);
  }
  const q = parsed.data.q;
  const suppliers = await prisma.supplier.findMany({
    where: q ? { name: { contains: normalizeSupplierName(q) } } : undefined,
    orderBy: { name: "asc" },
    select: { id: true, name: true, aliases: true, mergedIntoId: true, _count: { select: { lpos: true } } },
  });
  const rows = jsonSafe(suppliers).map((s: Record<string, unknown>): CsvCell[] => [
    s.id as CsvCell,
    String(s.name),
    JSON.stringify(s.aliases ?? []),
    s.mergedIntoId as CsvCell,
    (s as { _count?: { lpos?: number } })._count?.lpos ?? 0,
  ]);
  return csvResponse("suppliers.csv", toCsv(["id", "name", "aliases", "mergedIntoId", "lpoCount"], rows));
});
