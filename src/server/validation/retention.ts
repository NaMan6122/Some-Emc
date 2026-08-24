import { z } from "zod";
import { moneyString } from "@/server/validation/money";

const isoDate = z.string().datetime();

// spec-019-v1: retention release entries. amountFils must be a positive money
// string; releasedAt ISO; optional PC linkage + reference/note.
export const createRetentionReleaseSchema = z.object({
  pcId: z.coerce.number().int().positive().nullish(),
  amountFils: moneyString.refine((fils) => fils > 0n, { message: "amountFils must be greater than zero" }),
  releasedAt: isoDate,
  reference: z.string().trim().max(100).nullish(),
  note: z.string().trim().max(500).nullish(),
});

export type CreateRetentionReleaseInput = z.infer<typeof createRetentionReleaseSchema>;
