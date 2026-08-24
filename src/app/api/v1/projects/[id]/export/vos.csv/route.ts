import { apiHandler, HttpApiError } from "@/lib/http-error";
import { requireAuth } from "@/server/auth/guards";
import { listVos } from "@/server/services/vos";
import { formatMoney } from "@/lib/money";
import { jsonSafe } from "@/lib/bigint-json";
import { csvResponse, toCsv, type CsvCell } from "@/lib/csv";

type Ctx = { params: Promise<{ id: string }> };

// spec-018-v1: GET /api/v1/projects/:id/export/vos.csv — same read gate as
// the JSON list.
export const GET = apiHandler<Ctx>(async (request, ctx) => {
  await requireAuth(request);
  const { id } = await ctx.params;
  if (!/^\d+$/.test(id)) throw new HttpApiError(404, "NOT_FOUND", "Project not found");
  const vos = jsonSafe(await listVos(Number(id))) as Record<string, unknown>[];
  const body = toCsv(
    ["voNumber", "title", "status", "submittedValueAED", "approvedValueAED", "approvedAt", "approvalRef", "linkedLpos"],
    vos.map((v: Record<string, unknown>): CsvCell[] => [
      v.voNumber as CsvCell,
      String(v.title),
      String(v.status),
      v.submittedValueFils == null ? "" : formatMoney(BigInt(v.submittedValueFils as string)),
      v.approvedValueFils == null ? "" : formatMoney(BigInt(v.approvedValueFils as string)),
      (v.approvedAt ?? "") as CsvCell,
      (v.approvalRef ?? "") as CsvCell,
      (v as { _count?: { lpos?: number } })._count?.lpos ?? 0,
    ]),
  );
  return csvResponse(`vos-${id}.csv`, body);
});
