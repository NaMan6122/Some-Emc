import { z } from "zod";

// spec-024-v1: user administration payloads. Passwords are optional on create
// (server generates a one-time value when omitted) and NEVER accepted on patch
// (reset is a dedicated action that returns a fresh one-time password).

export const ROLES = ["ADMIN", "MANAGEMENT", "PROCUREMENT", "COMMERCIAL", "FINANCE", "VIEWER"] as const;

const email = z.string().trim().toLowerCase().email().max(200);
const name = z.string().trim().min(1).max(100);
const role = z.enum(ROLES);

export const createUserSchema = z.object({
  email,
  name,
  role,
  password: z.string().min(10).max(200).optional(),
});

export const patchUserSchema = z
  .object({
    role: role.optional(),
    active: z.boolean().optional(),
    resetPassword: z.boolean().optional(),
  })
  .refine((p) => Object.keys(p).length > 0, { message: "Empty patch" });

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type PatchUserInput = z.infer<typeof patchUserSchema>;
