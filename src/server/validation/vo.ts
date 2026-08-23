import { z } from "zod";
import { moneyString } from "@/server/validation/money";

const isoDate = z.string().datetime();

export const createVoSchema = z.object({
  voNumber: z.coerce.number().int().min(1),
  title: z.string().trim().min(1).max(200),
  submittedValueFils: moneyString,
  status: z.enum(["DRAFT", "SUBMITTED", "APPROVED", "REJECTED"]).default("DRAFT"),
  approvedAt: isoDate.nullish(),
  approvalRef: z.string().trim().max(100).nullish(),
});

export const patchVoSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  submittedValueFils: moneyString.optional(),
  approvedValueFils: moneyString.nullish(),
  status: z.enum(["DRAFT", "SUBMITTED", "APPROVED", "REJECTED"]).optional(),
  approvedAt: isoDate.nullish(),
  approvalRef: z.string().trim().max(100).nullish(),
});

export type CreateVoInput = z.infer<typeof createVoSchema>;
export type PatchVoInput = z.infer<typeof patchVoSchema>;
