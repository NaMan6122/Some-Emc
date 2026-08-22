import { apiError } from "@/lib/api-envelope";

/** Error carrying an HTTP status + envelope code; caught by apiHandler. */export class HttpApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

/**
 * Wrap a Next.js route handler so HttpApiError becomes a proper envelope
 * response; unknown errors log server-side and emit a generic envelope.
 * The context param (dynamic-route params etc.) is passed through untouched.
 */
export function apiHandler<C = unknown>(
  fn: (request: Request, ctx: C) => Promise<Response>,
): (request: Request, ctx?: C) => Promise<Response> {
  return async (request: Request, ctx?: C) => {
    try {
      return await fn(request, ctx as C);
    } catch (e) {
      if (e instanceof HttpApiError) {
        return Response.json(apiError(e.code, e.message, e.details), { status: e.status });
      }
      console.error("[api] unhandled error", e);
      return Response.json(apiError("INTERNAL", "Unexpected server error"), { status: 500 });
    }
  };
}
