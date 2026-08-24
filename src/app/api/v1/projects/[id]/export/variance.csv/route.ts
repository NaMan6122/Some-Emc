import { apiHandler, HttpApiError } from "@/lib/http-error";
import { requireAuth } from "@/server/auth/guards";
import { computeVariance } from "@/server/services/budgets";
import { formatMoney } from "@/lib/money";
import { csvResponse, toCsv } from "@/lib/csv";

type Ctx = { params: Promise<{ id: string }> };

// spec-018-v1: GET /api/v1/projects/:id/export/variance.csv — one row per
// trade, figures byte-identical to GET /variance (v1 committed semantics:
// all non-cancelled latest-revision LPOs in trade).
export const GET = apiHandler<Ctx>(async (request, ctx) => {
  await requireAuth(request);
  const { id } = await ctx.params;
  if (!/^\d+$/.test(id)) throw new HttpApiError(404, "NOT_FOUND", "Project not found");
  const rows = await computeVariance(Number(id));
  const body = toCsv(
    ["trade", "budgetAED", "committedAED", "utilizationPct", "status"],
    rows.map((r) => [r.trade, formatMoney(r.budgetFils), formatMoney(r.committedFils), r.utilizationPct, r.status]),
  );
  return csvResponse(`variance-${id}.csv`, body);
});
