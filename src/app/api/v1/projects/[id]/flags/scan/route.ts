import { apiHandler, HttpApiError } from "@/lib/http-error";
import { requireRole } from "@/server/auth/guards";
import { scanProjectFlags } from "@/server/services/flags-scan";
import { jsonSafe } from "@/lib/bigint-json";

type Ctx = { params: Promise<{ id: string }> };

// spec-017-v1: POST /api/v1/projects/:id/flags/scan — evaluates FR-9 rules
// (NO_BUDGET_LINE, DUPLICATE_SUPPLIER_SUSPECT) and reconciles their flags.
// Governance operators only per spec; MANAGEMENT/VIEWER 403.
export const POST = apiHandler<Ctx>(async (request, ctx) => {
  await requireRole(request, "ADMIN", "PROCUREMENT", "COMMERCIAL", "FINANCE");
  const { id } = await ctx.params;
  if (!/^\d+$/.test(id)) throw new HttpApiError(404, "NOT_FOUND", "Project not found");
  const result = await scanProjectFlags(Number(id));
  return Response.json(jsonSafe(result));
});
