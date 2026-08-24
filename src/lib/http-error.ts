import { apiError } from "@/lib/api-envelope";

/** Error carrying an HTTP status + envelope code; caught by apiHandler. */
export class HttpApiError extends Error {
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
 * Overloads let dynamic-route handlers declare a required context (Next's
 * typed-routes validation demands it) while static ones stay single-arg.
 *
 * T-031: configuration problems get distinct non-500 envelopes so ops sees
 * "what" immediately from the client side too (details stay in server logs).
 */
export function apiHandler(fn: (request: Request) => Promise<Response>): (request: Request) => Promise<Response>;
export function apiHandler<C>(
  fn: (request: Request, ctx: C) => Promise<Response>,
): (request: Request, ctx: C) => Promise<Response>;
export function apiHandler(
  fn: (request: Request, ctx?: unknown) => Promise<Response>,
): (request: Request, ctx?: unknown) => Promise<Response> {
  return async (request: Request, ctx?: unknown) => {
    try {
      return await fn(request, ctx);
    } catch (e) {
      if (e instanceof HttpApiError) {
        return Response.json(apiError(e.code, e.message, e.details), { status: e.status });
      }
      const name = (e as { name?: string })?.name;
      if (name === "ConfigError") {
        console.error("[api] configuration error:", (e as Error).message);
        return Response.json(apiError("SERVER_CONFIG", "Server configuration error"), { status: 503 });
      }
      if (name === "PrismaClientInitializationError") {
        console.error("[api] database unreachable:", (e as Error).message);
        return Response.json(apiError("DB_UNAVAILABLE", "Database unavailable"), { status: 503 });
      }
      console.error("[api] unhandled error", e);
      return Response.json(apiError("INTERNAL", "Unexpected server error"), { status: 500 });
    }
  };
}
