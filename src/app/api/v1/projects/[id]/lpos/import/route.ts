import { apiHandler, HttpApiError } from "@/lib/http-error";
import { z } from "zod";
import { requireRole } from "@/server/auth/guards";
import { prisma } from "@/server/db";
import { CsvParseError, parseCsv } from "@/lib/csv";
import { commitImport, dryRunImport } from "@/server/services/lpo-import";
import { jsonSafe } from "@/lib/bigint-json";

type Ctx = { params: Promise<{ id: string }> };

const querySchema = z.object({ dry_run: z.enum(["true", "false"]).default("true") });

// spec-021-v1: POST /api/v1/projects/:id/lpos/import?dry_run=true|false —
// body is text/csv with a header row (column mapping by name). ADMIN+
// PROCUREMENT per TDD §7 LPOs write row. Default is dry-run: no accidental
// writes.
export const POST = apiHandler<Ctx>(async (request, ctx) => {
  const session = await requireRole(request, "ADMIN", "PROCUREMENT");
  const { id } = await ctx.params;
  if (!/^\d+$/.test(id)) throw new HttpApiError(404, "NOT_FOUND", "Project not found");
  const projectId = Number(id);
  const project = await prisma.project.findUnique({ where: { id: projectId }, select: { id: true } });
  if (!project) throw new HttpApiError(404, "NOT_FOUND", "Project not found");

  const parsedQuery = querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsedQuery.success) {
    throw new HttpApiError(422, "VALIDATION_ERROR", "Invalid query", parsedQuery.error.flatten().fieldErrors);
  }

  const text = await request.text();
  let grid: string[][];
  try {
    grid = parseCsv(text);
  } catch (e) {
    if (e instanceof CsvParseError) {
      throw new HttpApiError(422, "VALIDATION_ERROR", `Malformed CSV: ${e.message}`);
    }
    throw e;
  }

  if (parsedQuery.data.dry_run === "true") {
    return Response.json(jsonSafe(await dryRunImport(grid)));
  }
  const created = await commitImport(session.id, projectId, grid);
  return Response.json(jsonSafe({ created, count: created.length }), { status: 201 });
});
