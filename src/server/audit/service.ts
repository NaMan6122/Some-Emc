import { Prisma, type PrismaClient } from "@prisma/client";

// spec-004-v1: audit service. Callers pass their transaction client so the
// audit write is atomic with the business mutation it describes.

type Tx = Prisma.TransactionClient | PrismaClient;

export type AuditInput = {
  actorId: number;
  entity: string;
  entityId: string | number;
  action: string;
  before?: unknown;
  after?: unknown;
};

/** Deterministic deep normalization: sorted keys, undefined values dropped. */
export function normalizeForAudit(value: unknown): unknown {
  if (value === null || typeof value !== "object" || value instanceof Date) return value ?? null;
  if (Array.isArray(value)) return value.map(normalizeForAudit);
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(value as Record<string, unknown>).sort()) {
    const v = (value as Record<string, unknown>)[k];
    if (v !== undefined) out[k] = normalizeForAudit(v);
  }
  return out;
}

function deepEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(normalizeForAudit(a)) === JSON.stringify(normalizeForAudit(b));
}

/**
 * Reduce before/after to changed top-level keys only.
 * null before/after is preserved verbatim (CREATE / DELETE semantics).
 * Non-object payloads are passed through unchanged.
 */
export function diffChangedKeys(
  before: unknown,
  after: unknown,
): { before: unknown; after: unknown } {
  const bIsObj = before !== null && typeof before === "object" && !Array.isArray(before);
  const aIsObj = after !== null && typeof after === "object" && !Array.isArray(after);
  if (!bIsObj || !aIsObj) return { before: normalizeForAudit(before), after: normalizeForAudit(after) };

  const bRec = before as Record<string, unknown>;
  const aRec = after as Record<string, unknown>;
  const keys = new Set([...Object.keys(bRec), ...Object.keys(aRec)]);
  const nb: Record<string, unknown> = {};
  const na: Record<string, unknown> = {};
  let changed = false;
  for (const k of keys) {
    if (!deepEqual(bRec[k], aRec[k])) {
      changed = true;
      if (bRec[k] !== undefined) nb[k] = normalizeForAudit(bRec[k]);
      if (aRec[k] !== undefined) na[k] = normalizeForAudit(aRec[k]);
    }
  }
  // No changes → empty objects signal a no-op diff deterministically.
  return changed ? { before: nb, after: na } : { before: {}, after: {} };
}

export async function audit(tx: Tx, input: AuditInput): Promise<void> {
  const { before, after } =
    input.action === "CREATE"
      ? { before: null, after: input.after ?? null }
      : input.action === "DELETE"
        ? { before: input.before ?? null, after: null }
        : diffChangedKeys(input.before, input.after);

  await tx.auditLog.create({
    data: {
      actorId: input.actorId,
      entity: input.entity,
      entityId: String(input.entityId),
      action: input.action,
      before: (before ?? Prisma.JsonNull) as Prisma.InputJsonValue,
      after: (after ?? Prisma.JsonNull) as Prisma.InputJsonValue,
    },
  });
}
