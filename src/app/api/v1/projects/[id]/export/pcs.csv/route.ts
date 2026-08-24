import { apiHandler, HttpApiError } from "@/lib/http-error";
import { requireAuth } from "@/server/auth/guards";
import { listPcs } from "@/server/services/pcs";
import { formatMoney } from "@/lib/money";
import { csvResponse, toCsv } from "@/lib/csv";

type Ctx = { params: Promise<{ id: string }> };

// spec-018-v1: GET /api/v1/projects/:id/export/pcs.csv — same read gate as
// the JSON list; money columns are fils-exact AED strings (PC03's seeded
// "n/a" retention is stored as 0 and exports as AED 0.00).
export const GET = apiHandler<Ctx>(async (request, ctx) => {
  await requireAuth(request);
  const { id } = await ctx.params;
  if (!/^\d+$/.test(id)) throw new HttpApiError(404, "NOT_FOUND", "Project not found");
  const pcs = await listPcs(Number(id));
  const body = toCsv(
    ["pcNumber", "periodLabel", "invoiceDate", "grossAED", "retentionAED", "netPayableAED", "variationClaimAED", "status", "provenance"],
    pcs.map((p) => [
      p.pcNumber,
      p.periodLabel,
      p.invoiceDate?.toISOString().slice(0, 10) ?? "",
      formatMoney(p.grossFils),
      formatMoney(p.retentionFils),
      formatMoney(p.netPayableFils),
      formatMoney(p.variationClaimFils),
      p.status,
      p.provenance,
    ]),
  );
  return csvResponse(`pcs-${id}.csv`, body);
});
