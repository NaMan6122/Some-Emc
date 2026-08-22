import type { ZodType } from "zod";
import { HttpApiError } from "@/lib/http-error";

// Shared body-parsing helper: throws a 422 VALIDATION_ERROR envelope on
// malformed JSON or schema failure, with field-level details.
export async function parseJsonBody<T>(schema: ZodType<T>, request: Request): Promise<T> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    throw new HttpApiError(422, "VALIDATION_ERROR", "Invalid JSON body");
  }
  const res = schema.safeParse(raw);
  if (!res.success) {
    const flat = res.error.flatten().fieldErrors as Record<string, string[]>;
    throw new HttpApiError(422, "VALIDATION_ERROR", "Invalid payload", flat);
  }
  return res.data;
}
