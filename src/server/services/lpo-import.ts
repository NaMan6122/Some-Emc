import { z } from "zod";
import { prisma } from "@/server/db";
import { audit } from "@/server/audit/service";
import { HttpApiError } from "@/lib/http-error";
import { moneyString } from "@/server/validation/money";
import { normalizeSupplierName } from "./suppliers";
import { allocateNextRef } from "./lpos";

// spec-021-v1: bulk LPO CSV import. Dry-run validates without writing;
// commit re-validates inside ONE transaction — all rows succeed or nothing
// is written. Suppliers must already exist by normalized name (no
// auto-creation: phantom vendors are exactly what FR-9 fights).

export const IMPORT_HEADERS = ["supplierName", "trade", "description", "issueDate", "amountAED"] as const;
const OPTIONAL_HEADERS = ["vatRate", "kind", "remark"] as const;
export const IMPORT_ROW_CAP = 1000;

const TRADES = ["ELECTRICAL", "PLUMBING", "HVAC", "FIRE_FIGHTING", "GENERAL", "HSE", "OTHER"] as const;
const KINDS = ["STANDARD", "VARIATION", "INTERNAL_TRANSFER"] as const;

const dateOnly = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "issueDate must be YYYY-MM-DD")
  .refine((s) => !Number.isNaN(new Date(`${s}T00:00:00Z`).getTime()), "issueDate is not a real date");

const rowSchema = z.object({
  supplierName: z.string().trim().min(1, "supplierName is required").max(200),
  trade: z.enum(TRADES),
  description: z.string().trim().min(1).max(500),
  issueDate: dateOnly,
  amountAED: moneyString,
  vatRate: z.coerce.number().min(0).max(1).default(0.05),
  kind: z.enum(KINDS).default("STANDARD"),
  remark: z.string().trim().max(500).optional(),
});

type ValidRow = z.infer<typeof rowSchema> & { supplierId: number };

export type ImportFailure = { row: number; field: string; message: string };
export type ImportReport = {
  rowsTotal: number;
  valid: number;
  invalid: number;
  failures: ImportFailure[];
};

function fieldFailures(row: number, error: z.ZodError): ImportFailure[] {
  return error.issues.map((issue) => ({
    row,
    field: issue.path.join(".") || "row",
    message: issue.message,
  }));
}

/** Parse-free validation of an already-parsed grid: headers + per-row schemas + supplier resolution. Zero writes. */
export async function validateImportGrid(grid: string[][]): Promise<{ rows: ValidRow[]; report: ImportReport }> {
  if (grid.length === 0) throw new HttpApiError(422, "VALIDATION_ERROR", "Empty CSV body");
  const headers = grid[0].map((h) => h.trim());
  const known = new Set<string>([...IMPORT_HEADERS, ...OPTIONAL_HEADERS]);
  const unknown = headers.filter((h) => h !== "" && !known.has(h));
  if (unknown.length > 0) {
    throw new HttpApiError(422, "VALIDATION_ERROR", `Unknown column(s): ${unknown.join(", ")}`, {
      unknownColumns: unknown,
    });
  }
  for (const required of IMPORT_HEADERS) {
    if (!headers.includes(required)) {
      throw new HttpApiError(422, "VALIDATION_ERROR", `Missing required column: ${required}`, {
        missingColumns: [required],
      });
    }
  }
  const idx = (name: string) => headers.indexOf(name);

  const dataRows = grid.slice(1);
  if (dataRows.length > IMPORT_ROW_CAP) {
    throw new HttpApiError(422, "IMPORT_TOO_LARGE", `Import is capped at ${IMPORT_ROW_CAP} rows per request`);
  }

  const failures: ImportFailure[] = [];
  const parsed: (z.infer<typeof rowSchema> | null)[] = dataRows.map((cells, i) => {
    const raw = {
      supplierName: cells[idx("supplierName")] ?? "",
      trade: (cells[idx("trade")] ?? "").trim().toUpperCase(),
      description: cells[idx("description")] ?? "",
      issueDate: (cells[idx("issueDate")] ?? "").trim(),
      amountAED: (cells[idx("amountAED")] ?? "").trim(),
      ...(idx("vatRate") >= 0 && (cells[idx("vatRate")] ?? "").trim() !== ""
        ? { vatRate: cells[idx("vatRate")].trim() }
        : {}),
      ...(idx("kind") >= 0 && (cells[idx("kind")] ?? "").trim() !== "" ? { kind: cells[idx("kind")].trim().toUpperCase() } : {}),
      ...(idx("remark") >= 0 && (cells[idx("remark")] ?? "").trim() !== "" ? { remark: cells[idx("remark")].trim() } : {}),
    };
    const result = rowSchema.safeParse(raw);
    if (!result.success) {
      failures.push(...fieldFailures(i + 1, result.error));
      return null;
    }
    return result.data;
  });

  // Resolve suppliers company-wide by normalized exact name (merged ones excluded).
  const names = [...new Set(parsed.filter((r): r is z.infer<typeof rowSchema> => r !== null).map((r) => normalizeSupplierName(r.supplierName)))];
  const supplierRows = names.length
    ? await prisma.supplier.findMany({ where: { name: { in: names }, mergedIntoId: null }, select: { id: true, name: true } })
    : [];
  const idByName = new Map(supplierRows.map((s) => [s.name, s.id]));

  const rows: ValidRow[] = [];
  parsed.forEach((r, i) => {
    if (!r) return;
    const supplierId = idByName.get(normalizeSupplierName(r.supplierName));
    if (supplierId == null) {
      failures.push({
        row: i + 1,
        field: "supplierName",
        message: `No active supplier matches "${r.supplierName}" — create it first`,
      });
      return;
    }
    rows.push({ ...r, supplierId });
  });

  return {
    rows,
    report: { rowsTotal: dataRows.length, valid: rows.length, invalid: dataRows.length - rows.length, failures },
  };
}

/** Dry-run entry point: full validation pass, zero writes. */
export async function dryRunImport(grid: string[][]): Promise<ImportReport & { wouldCreate: number }> {
  const { report } = await validateImportGrid(grid);
  return { ...report, wouldCreate: report.valid };
}

/** Commit path: one transaction, all-or-nothing. Rows arrive pre-validated. */
export async function commitImport(actorId: number, projectId: number, grid: string[][]) {
  const { rows, report } = await validateImportGrid(grid);
  if (report.invalid > 0 || rows.length === 0) {
    throw new HttpApiError(422, "IMPORT_REJECTED", "No rows committed — see failures", report);
  }

  return prisma.$transaction(async (tx) => {
    // Re-check suppliers at commit time (state may have moved since validation).
    const ids = [...new Set(rows.map((r) => r.supplierId))];
    const live = await tx.supplier.findMany({ where: { id: { in: ids }, mergedIntoId: null }, select: { id: true } });
    const liveIds = new Set(live.map((s) => s.id));
    if (liveIds.size !== ids.length) {
      throw new HttpApiError(422, "IMPORT_REJECTED", "No rows committed — a referenced supplier is no longer active", report);
    }

    const created: { id: string; refNo: string }[] = [];
    for (const row of rows) {
      const { seq, refNo } = await allocateNextRef(tx, projectId);
      const lpo = await tx.lpo.create({
        data: {
          projectId,
          refNo,
          seq,
          supplierId: row.supplierId,
          trade: row.trade,
          description: row.description,
          issueDate: new Date(`${row.issueDate}T00:00:00Z`),
          amountFils: row.amountAED,
          vatRate: row.vatRate,
          kind: row.kind,
          status: "ISSUED",
          remark: row.remark ?? null,
          provenance: "SOURCE_DOCUMENT",
        },
      });
      await audit(tx, {
        actorId,
        entity: "Lpo",
        entityId: lpo.id,
        action: "CREATE",
        after: {
          refNo,
          supplierId: row.supplierId,
          trade: row.trade,
          amountFils: row.amountAED.toString(),
          via: "bulk-import",
        },
      });
      created.push({ id: String(lpo.id), refNo });
    }
    return created;
  });
}
