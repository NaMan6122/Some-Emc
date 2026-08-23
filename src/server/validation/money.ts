import { z } from "zod";
import { parseMoney } from "@/lib/money";

/** Decimal-string input ("1,234.50" | "1234.5") → exact fils bigint. */
export const moneyString = z
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
