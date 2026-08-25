import { apiHandler, HttpApiError } from "@/lib/http-error";
import { z } from "zod";
import { requireAuth, requireRole } from "@/server/auth/guards";
import { parseJsonBody } from "@/server/validation/parse";
import { prisma } from "@/server/db";
import { jsonSafe } from "@/lib/bigint-json";
import {
  COST_CATEGORIES,
  createCostEntry,
  ledgerTotals,
  parseCategory,
} from "@/server/services/cost-overviews";
import { moneyString } from "@/server/validation/money";

type Ctx = { params: Promise<{ id: string }> };

const querySchema = z.object({
  category: z.enum(COST_CATEGORIES).optional(),
  supplierId: z.coerce.number().int().positive().optional(),
  kind: z.enum(["INVOICE", "PAYMENT"]).optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});
const bodySchema = z.object({
  category: z.enum(COST_CATEGORIES),
  entryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  amountFils: moneyString.refine((f) => f > 0n, { message: "amountFils must be greater than zero" }),
  description: z.string().trim().min(1).max(300),
  reference: z.string().trim().max(100).nullish(),
  kind: z.enum(["INVOICE", "PAYMENT"]).default("INVOICE"),
  supplierId: z.coerce.number().int().positive().nullish(),
  lpoId: z.string().regex(/^\d+$/).nullish(),
});

// spec-028 + spec-029: GET (any auth; optional category/kind/supplier/from/to
// filters + INVOICE/PAYMENT totals) | POST (ADMIN+FINANCE) on
// /projects/:id/cost-entries.
export const GET = apiHandler<Ctx>(async (request, ctx) => {
  await requireAuth(request);
  const { id } = await ctx.params;
  if (!/^\d+$/.test(id)) throw new HttpApiError(404, "NOT_FOUND", "Project not found");
  const parsed = querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) throw new HttpApiError(422, "VALIDATION_ERROR", "Invalid query", parsed.error.flatten().fieldErrors);
  const f = parsed.data;
  const where = {
    projectId: Number(id),
    ...(f.category ? { category: parseCategory(f.category) } : {}),
    ...(f.supplierId ? { supplierId: f.supplierId } : {}),
    ...(f.kind ? { kind: f.kind } : {}),
    ...(f.from || f.to
      ? { entryDate: { ...(f.from ? { gte: new Date(f.from) } : {}), ...(f.to ? { lte: new Date(`${f.to}T23:59:59Z`) } : {}) } }
      : {}),
  };
  const [entries, invoices, payments] = await Promise.all([
    prisma.costEntry.findMany({ where, orderBy: [{ entryDate: "asc" }, { id: "asc" }] }),
    prisma.costEntry.aggregate({ where: { ...where, kind: "INVOICE" }, _sum: { amountFils: true } }),
    prisma.costEntry.aggregate({ where: { ...where, kind: "PAYMENT" }, _sum: { amountFils: true } }),
  ]);
  return Response.json(
    jsonSafe({
      entries,
      totals: {
        invoicedFils: invoices._sum.amountFils ?? 0n,
        paidFils: payments._sum.amountFils ?? 0n,
      },
    }),
  );
});

export const POST = apiHandler<Ctx>(async (request, ctx) => {
  const session = await requireRole(request, "ADMIN", "FINANCE");
  const { id } = await ctx.params;
  if (!/^\d+$/.test(id)) throw new HttpApiError(404, "NOT_FOUND", "Project not found");
  const body = await parseJsonBody(bodySchema, request);
  const created = await createCostEntry(session.id, Number(id), parseCategory(body.category), body);
  return Response.json(jsonSafe(created), { status: 201 });
});

