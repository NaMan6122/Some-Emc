import { apiHandler, HttpApiError } from "@/lib/http-error";
import { z } from "zod";
import { requireAuth, requireRole } from "@/server/auth/guards";
import { parseJsonBody } from "@/server/validation/parse";
import { jsonSafe } from "@/lib/bigint-json";
import { COST_CATEGORIES, createCostLine, costOverview, parseCategory } from "@/server/services/cost-overviews";
import { moneyString } from "@/server/validation/money";

type Ctx = { params: Promise<{ id: string }> };

const querySchema = z.object({ category: z.enum(COST_CATEGORIES) });
const bodySchema = z.object({
  category: z.enum(COST_CATEGORIES),
  amountFils: moneyString.refine((f) => f > 0n, { message: "amountFils must be greater than zero" }),
  sourceLabel: z.string().trim().min(1).max(120),
  note: z.string().trim().max(300).nullish(),
});

// spec-028-v1: GET (any auth, ?category= required) | POST (ADMIN+COMMERCIAL)
// /api/v1/projects/:id/cost-lines
export const GET = apiHandler<Ctx>(async (request, ctx) => {
  await requireAuth(request);
  const { id } = await ctx.params;
  if (!/^\d+$/.test(id)) throw new HttpApiError(404, "NOT_FOUND", "Project not found");
  const parsed = querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) throw new HttpApiError(422, "VALIDATION_ERROR", "category query parameter required");
  const ov = await costOverview(Number(id), parseCategory(parsed.data.category));
  return Response.json(jsonSafe({ lines: ov.lines, budgetFils: ov.budgetFils }));
});

export const POST = apiHandler<Ctx>(async (request, ctx) => {
  const session = await requireRole(request, "ADMIN", "COMMERCIAL");
  const { id } = await ctx.params;
  if (!/^\d+$/.test(id)) throw new HttpApiError(404, "NOT_FOUND", "Project not found");
  const body = await parseJsonBody(bodySchema, request);
  const created = await createCostLine(session.id, Number(id), parseCategory(body.category), {
    amountFils: BigInt(body.amountFils),
    sourceLabel: body.sourceLabel,
    note: body.note ?? null,
  });
  return Response.json(jsonSafe(created), { status: 201 });
});
