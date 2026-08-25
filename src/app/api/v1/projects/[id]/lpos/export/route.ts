import { apiHandler, HttpApiError } from "@/lib/http-error";
import { requireAuth } from "@/server/auth/guards";
import { listLpos } from "@/server/services/lpos";
import { listQuerySchema } from "@/server/validation/lpo";
import { formatMoney } from "@/lib/money";

type Ctx = { params: Promise<{ id: string }> };

function csvEscape(v: string): string {
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

// spec-007-v1 AC7: CSV export matches the filtered API result exactly.
export const GET = apiHandler<Ctx>(async (request, ctx) => {
  await requireAuth(request);
  const { id } = await ctx.params;
  if (!/^\d+$/.test(id)) throw new HttpApiError(404, "NOT_FOUND", "Project not found");

  // Collect every matching page (bounded).
  const rows: Awaited<ReturnType<typeof listLpos>>["items"] = [];
  let cursor: string | undefined;
  for (let page = 0; page < 100; page++) {
    const search = new URL(request.url).searchParams;
    if (cursor) search.set("cursor", cursor);
    const parsed = listQuerySchema.safeParse(Object.fromEntries(search));
    if (!parsed.success) {
      throw new HttpApiError(422, "VALIDATION_ERROR", "Invalid query", parsed.error.flatten().fieldErrors);
    }
    const res = await listLpos(Number(id), parsed.data);
    rows.push(...res.items);
    if (!res.nextCursor) break;
    cursor = res.nextCursor;
  }

  const header = [
    "refNo",
    "revisionNo",
    "supplier",
    "trade",
    "description",
    "issueDate",
    "amountAED",
    "vatRate",
    "status",
    "verification",
    "kind",
    "remark",
    "indentDate",
    "deliveryDate",
  ].join(",");
  const lines = rows.map((r) =>
    [
      r.refNo,
      String(r.revisionNo),
      r.supplier.name,
      r.trade,
      r.description,
      r.issueDate.toISOString().slice(0, 10),
      formatMoney(r.amountFils),
      String(r.vatRate),
      r.status,
      r.verification,
      r.kind,
      r.remark ?? "",
      r.indentDate ? r.indentDate.toISOString().slice(0, 10) : "",
      r.deliveryDate ? r.deliveryDate.toISOString().slice(0, 10) : "",
    ]
      .map((c) => csvEscape(String(c)))
      .join(","),
  );
  const body = [header, ...lines].join("\n");
  return new Response(body, {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="lpos-${id}.csv"`,
    },
  });
});
