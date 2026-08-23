import { z } from "zod";
import { parseMoney } from "@/lib/money";

const moneyString = z
  .string()
  .trim()
  .min(1, "required")
  .transform((s, ctx) => {
    try {
      return parseMoney(s);
    } catch {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "must be a decimal amount like 7000000.00" });
      return z.NEVER;
    }
  })
  .refine((fils) => fils >= 0n, "must not be negative");

export const createBudgetLineSchema = z.object({
  trade: z.enum(["ELECTRICAL", "PLUMBING", "HVAC", "FIRE_FIGHTING", "GENERAL", "HSE", "OTHER"]),
  category: z.enum(["MATERIALS", "LABOUR", "OTHER"]).default("MATERIALS"),
  amountFils: moneyString,
  sourceLabel: z.string().trim().min(1).max(100),
  refDate: z.string().datetime().nullish(),
  note: z.string().trim().max(500).nullish(),
});

export const updateBudgetLineSchema = createBudgetLineSchema.partial();

export type CreateBudgetLineInput = z.infer<typeof createBudgetLineSchema>;
export type UpdateBudgetLineInput = z.infer<typeof updateBudgetLineSchema>;
