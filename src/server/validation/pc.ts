import { z } from "zod";
import { moneyString } from "@/server/validation/money";

const isoDate = z.string().datetime();

export const createPcSchema = z.object({
  pcNumber: z.coerce.number().int().min(1),
  periodLabel: z.string().trim().min(1).max(100),
  periodStart: isoDate.nullish(),
  periodEnd: isoDate.nullish(),
  invoiceDate: isoDate.nullish(),
  grossFils: moneyString,
  retentionFils: moneyString.default(0n),
  netPayableFils: moneyString,
  variationClaimFils: moneyString.default(0n),
  statedCumulativeFils: moneyString.nullish(),
  status: z.enum(["DRAFT", "SUBMITTED", "CERTIFIED", "PAID"]).default("DRAFT"),
  provenance: z.enum(["SOURCE_DOCUMENT", "OCR_ESTIMATE", "CLIENT_SUMMARY", "DERIVED", "IMPORTED_REPORT"]).default("SOURCE_DOCUMENT"),
  notes: z.string().trim().max(1000).nullish(),
});

export const patchPcSchema = createPcSchema.partial().omit({ pcNumber: true });

export type CreatePcInput = z.infer<typeof createPcSchema>;
export type PatchPcInput = z.infer<typeof patchPcSchema>;
