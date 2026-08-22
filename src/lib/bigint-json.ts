/**
 * Serialize API payloads safely: BigInt → decimal string, recursively.
 * Convention (spec-002): BigInt values NEVER appear raw in JSON — they are
 * emitted as exact decimal strings. Guarded by bigint-json.test.ts.
 * Objects exposing toJSON (Prisma Decimal, Date) are converted via it;
 * everything else passes through unchanged.
 */
export function jsonSafe<T>(value: T): T {
  if (typeof value === "bigint") return value.toString() as unknown as T;
  if (value === null || typeof value !== "object") return value;
  const maybeToJSON = value as { toJSON?: () => unknown };
  if (typeof maybeToJSON.toJSON === "function") {
    return jsonSafe(maybeToJSON.toJSON()) as unknown as T;
  }
  if (Array.isArray(value)) return value.map((v) => jsonSafe(v)) as unknown as T;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = jsonSafe(v);
  return out as T;
}
