import { apiHandler, HttpApiError } from "@/lib/http-error";
import { z } from "zod";
import { CostCategory } from "@prisma/client";
import { requireAuth } from "@/server/auth/guards";
import { prisma } from "@/server/db";
import { formatMoney } from "@/lib/money";
import { csvResponse, toCsv } from "@/lib/csv";

type Ctx = { params: Promise<{ id: string }> };

const querySchema = z.object({
  category: z.nativeEnum(CostCategory).optional(),
  supplierId: z.coerce.number().int().positive().optional(),
  kind: z.enum(["INVOICE", "PAYMENT"]).optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

// spec-029-v1: GET /api/v1/projects/:id/cost-entries.csv — actual-costs
// ledger export; same read gate and filters as the JSON list.
export const GET = apiHandler<Ctx>(async (request, ctx) => {
  await requireAuth(request);
  const { id } = await ctx.params;
  if (!/^\d+$/.test(id)) throw new HttpApiError(404, "NOT_FOUND", "Project not found");
  const parsed = querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) {
    throw new HttpApiError(422, "VALIDATION_ERROR", "Invalid query", parsed.error.flatten().fieldErrors);
  }
  const f = parsed.data;
  const where = {
    projectId: Number(id),
    ...(f.category ? { category: f.category } : {}),
    ...(f.supplierId ? { supplierId: f.supplierId } : {}),
    ...(f.kind ? { kind: f.kind } : {}),
    ...(f.from || f.to
      ? { entryDate: { ...(f.from ? { gte: new Date(f.from) } : {}), ...(f.to ? { lte: new Date(`${f.to}T23:59:59Z`) } : {}) } }
      : {}),
  };
  const entries = await prisma.costEntry.findMany({
    where,
    orderBy: [{ entryDate: "asc" }, { id: "asc" }],
    include: { supplier: { select: { name: true } }, lpo: { select: { refNo: true } } },
    take: 5000,
  });

  const body = toCsv(
    ["entryDate", "category", "kind", "amountAED", "description", "reference", "supplier", "lpoRef"],
    entries.map((e) => [
      e.entryDate.toISOString().slice(0, 10),
      e.category,
      e.kind,
      formatMoney(e.amountFils),
      e.description ?? "",
      e.reference ?? "",
      e.supplier?.name ?? "",
      e.lpo?.refNo ?? "",
    ]),
  );
  return csvResponse(`cost-entries-${id}.csv`, body);
});
