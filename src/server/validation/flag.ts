import { z } from "zod";

// spec-016-v1: triage actions on a DataFlag. Status transitions are
// OPEN → RESOLVED | WONT_FIX only; both demand a resolutionNote (enforced in
// the service where the transition context is known). assigneeId may be sent
// alone to (re)assign, or null to unassign.
export const patchFlagSchema = z.object({
  assigneeId: z.coerce.number().int().positive().nullish(),
  status: z.enum(["RESOLVED", "WONT_FIX"]).optional(),
  resolutionNote: z.string().trim().max(500).nullish(),
});

export type PatchFlagInput = z.infer<typeof patchFlagSchema>;
