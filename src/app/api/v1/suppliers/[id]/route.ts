import { z } from "zod";
import { apiHandler } from "@/lib/http-error";
import { requireRole } from "@/server/auth/guards";
import { getSupplier, updateSupplier } from "@/server/services/suppliers";
import { parseJsonBody } from "@/server/validation/parse";
import { jsonSafe } from "@/lib/bigint-json";

type Ctx = { params: Promise<{ id: string }> };

const patchSchema = z
  .object({
    name: z.string().trim().min(2).max(200),
    addAlias: z.string().trim().min(1).max(200),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, { message: "Empty patch" });

// spec-006-v1: GET|PATCH /api/v1/suppliers/:id — mutations ADMIN|PROCUREMENT.
export const GET = apiHandler<Ctx>(async (_request, ctx) => {
  const { id } = await ctx.params;
  return Response.json(jsonSafe(await getSupplier(id)));
});

export const PATCH = apiHandler<Ctx>(async (request, ctx) => {
  const session = await requireRole(request, "ADMIN", "PROCUREMENT");
  const { id } = await ctx.params;
  const patch = await parseJsonBody(patchSchema, request);
  const updated = await updateSupplier(session.id, id, patch);
  return Response.json(jsonSafe(updated));
});
