import { z } from "zod";
import { parseMoney } from "@/lib/money";

// spec-005-v1: shared project schemas (API + admin UI).
// contractValueFils arrives as a human decimal string and is stored as fils (ADR-002).

const moneyString = z
  .string()
  .trim()
  .min(1, "required")
  .transform((s, ctx) => {
    try {
      return parseMoney(s);
    } catch {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "must be a decimal amount like 18786625.00" });
      return z.NEVER;
    }
  })
  .refine((fils) => fils >= 0n, "must not be negative");

export const createProjectSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1, "required")
    .max(20)
    .regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/, "letters, digits, dot, dash, underscore only"),
  name: z.string().trim().min(1, "required").max(200),
  mainContractor: z.string().trim().min(1, "required").max(200),
  contractValueFils: moneyString,
  vatRate: z.number().min(0).max(1).default(0.05),
  status: z.enum(["ACTIVE", "ON_HOLD", "CLOSED"]).default("ACTIVE"),
  startedAt: z.string().datetime().nullish(),
  endedAt: z.string().datetime().nullish(),
});

export const updateProjectSchema = createProjectSchema.partial();

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
