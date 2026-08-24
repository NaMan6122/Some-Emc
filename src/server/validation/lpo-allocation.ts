import { z } from "zod";

// spec-022-v1: allocation entries on an LPO. pct is an integer percentage
// 1..100; Σ across rows per LPO must stay ≤100 (service-checked).
export const createAllocationSchema = z.object({
  targetProjectId: z.coerce.number().int().positive(),
  pct: z.coerce.number().int().min(1, "pct must be at least 1").max(100),
  note: z.string().trim().max(300).nullish(),
});

export type CreateAllocationInput = z.infer<typeof createAllocationSchema>;
