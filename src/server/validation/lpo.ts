import { z } from "zod";
import { parseMoney } from "@/lib/money";

// spec-007-v1 LPO schemas.

const moneyString = z
  .string()
  .trim()
  .min(1)
  .transform((s, ctx) => {
    try {
      return parseMoney(s);
    } catch {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "must be a decimal amount like 1234.50" });
      return z.NEVER;
    }
  })
  .refine((fils) => fils > 0n, "must be greater than zero");

const isoDate = z.string().datetime();

export const createLpoSchema = z
  .object({
    supplierId: z.number().int().positive(),
    trade: z.enum(["ELECTRICAL", "PLUMBING", "HVAC", "FIRE_FIGHTING", "GENERAL", "HSE", "OTHER"]),
    description: z.string().trim().min(1).max(500),
    issueDate: isoDate,
    amountFils: moneyString,
    vatRate: z.number().min(0).max(1).default(0.05),
    kind: z.enum(["STANDARD", "VARIATION", "INTERNAL_TRANSFER"]).default("STANDARD"),
    status: z.enum(["DRAFT", "ISSUED"]).default("DRAFT"),
    remark: z.string().trim().max(500).optional(),
    refPrefix: z.string().trim().min(1).max(40).default("TEMW/REF/LPO"),
    voId: z.string().regex(/^\d+$/).optional(), // decimal string to survive JSON round-trips
  })
  .strict();

export const patchLpoSchema = z
  .object({
    // Financial fields — trigger a revision on ISSUED records.
    supplierId: z.number().int().positive().optional(),
    trade: createLpoSchema.shape.trade.optional(),
    description: createLpoSchema.shape.description.optional(),
    issueDate: isoDate.optional(),
    amountFils: moneyString.optional(),
    vatRate: z.number().min(0).max(1).optional(),
    voId: z.string().regex(/^\d+$/).nullish(),
    // Descriptive / lifecycle fields — in-place.
    remark: z.string().trim().max(500).nullish(),
    status: z.enum(["ISSUED", "CLOSED", "CANCELLED"]).optional(),
    verification: z.enum(["PENDING", "VERIFIED", "FLAGGED"]).optional(),
    flagNote: z.string().trim().min(3).max(500).optional(),
  })
  .strict()
  .refine(
    (v) => !(v.verification === "FLAGGED" && (v.flagNote === undefined || v.flagNote.length < 3)),
    { message: "flagNote of at least 3 characters is required when flagging" },
  );

export const listQuerySchema = z.object({
  trade: createLpoSchema.shape.trade.optional(),
  status: z.enum(["DRAFT", "ISSUED", "CLOSED", "CANCELLED"]).optional(),
  verification: z.enum(["PENDING", "VERIFIED", "FLAGGED"]).optional(),
  supplierId: z.coerce.number().int().positive().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  q: z.string().trim().max(100).optional(),
  sort: z.enum(["issueDate", "amountFils", "refNo"]).default("issueDate"),
  dir: z.enum(["asc", "desc"]).default("desc"),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  cursor: z.string().regex(/^\d+$/).optional(),
  includeSuperseded: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
});

export type CreateLpoInput = z.infer<typeof createLpoSchema>;
export type PatchLpoInput = z.infer<typeof patchLpoSchema>;
export type ListLpoQuery = z.infer<typeof listQuerySchema>;
