import { apiHandler, HttpApiError } from "@/lib/http-error";
import { requireAuth } from "@/server/auth/guards";
import { listBudgetLines } from "@/server/services/budgets";
import { formatMoney } from "@/lib/money";
import { csvResponse, toCsv } from "@/lib/csv";

type Ctx = { params: Promise<{ id: string }> };

// spec-018-v1: GET /api/v1/projects/:id/export/budget-lines.csv — same read
// gate as the JSON list (any authenticated role).
export const GET = apiHandler<Ctx>(async (request, ctx) => {
  await requireAuth(request);
  const { id } = await ctx.params;
  if (!/^\d+$/.test(id)) throw new HttpApiError(404, "NOT_FOUND", "Project not found");
  const lines = await listBudgetLines(Number(id));
  const body = toCsv(
    ["trade", "category", "amountAED", "sourceLabel", "refDate", "note"],
    lines.map((l) => [
      l.trade,
      l.category,
      formatMoney(l.amountFils),
      l.sourceLabel,
      l.refDate?.toISOString().slice(0, 10) ?? "",
      l.note ?? "",
    ]),
  );
  return csvResponse(`budget-lines-${id}.csv`, body);
});
