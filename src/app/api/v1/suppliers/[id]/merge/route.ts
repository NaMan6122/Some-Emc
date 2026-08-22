import { z } from "zod";
import { apiHandler } from "@/lib/http-error";
import { requireRole } from "@/server/auth/guards";
import { mergeSupplier } from "@/server/services/suppliers";
import { parseJsonBody } from "@/server/validation/parse";
import { jsonSafe } from "@/lib/bigint-json";

type Ctx = { params: Promise<{ id: string }> };

const mergeSchema = z.object({
  targetId: z.number().int().positive(),
});

// spec-006-v1: POST /api/v1/suppliers/:id/merge — ADMIN only.
export const POST = apiHandler<Ctx>(async (request, ctx) => {
  const session = await requireRole(request, "ADMIN");
  const { id } = await ctx.params;
  const { targetId } = await parseJsonBody(mergeSchema, request);
  const target = await mergeSupplier(session.id, id, targetId);
  return Response.json(jsonSafe(target));
});
