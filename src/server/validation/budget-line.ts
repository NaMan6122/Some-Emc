import { z } from "zod";
import { moneyString } from "@/server/validation/money";

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
