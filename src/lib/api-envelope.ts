export type ApiErrorBody = {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};

// TDD §8: single error envelope for all /api/v1 responses.
export function apiError(code: string, message: string, details?: unknown): ApiErrorBody {
  const error: ApiErrorBody["error"] = { code, message };
  if (details !== undefined) error.details = sanitizeDetails(details);
  return { error };
}

function sanitizeDetails(details: unknown): unknown {
  if (details instanceof Error) return { name: details.name, message: details.message };
  return details;
}
