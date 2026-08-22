import { apiError } from "@/lib/api-envelope";

// Catch-all for undefined /api/v1/* paths — TDD §8 envelope contract (spec-001).
// Specific routes added by later specs take precedence over this handler.
export async function GET() {
  return Response.json(apiError("NOT_FOUND", "Unknown API route"), { status: 404 });
}

export const POST = GET;
export const PATCH = GET;
export const PUT = GET;
export const DELETE = GET;
