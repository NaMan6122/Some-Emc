import { Prisma } from "@prisma/client";
import { prisma } from "@/server/db";
import { audit } from "@/server/audit/service";
import { HttpApiError } from "@/lib/http-error";

// spec-006-v1 supplier service.
// Name invariant (see prisma/schema.prisma header): names stored UPPERCASE with
// collapsed whitespace, so the DB @unique acts as case-insensitive at the
// service boundary. Raw import spellings live in `aliases`.

export function normalizeSupplierName(raw: string): string {
  return raw.trim().replace(/\s+/g, " ").toUpperCase();
}

export async function listSuppliers(q?: string) {
  const namePart = normalizeSupplierName(q ?? "");
  return prisma.supplier.findMany({
    where: q ? { name: { contains: namePart } } : undefined,
    orderBy: { name: "asc" },
    // spec-020-v1: additive LPO-count column for the admin screen (no existing
    // consumer breaks — response shape only gains a field).
    include: { _count: { select: { lpos: true } } },
  });
}

export async function getSupplier(rawId: string) {
  if (!/^\d+$/.test(rawId)) throw new HttpApiError(404, "NOT_FOUND", "Supplier not found");
  const s = await prisma.supplier.findUnique({ where: { id: Number(rawId) } });
  if (!s) throw new HttpApiError(404, "NOT_FOUND", "Supplier not found");
  return s;
}

async function createOrConflict(actorId: number, rawName: string, aliases?: string[]) {
  const name = normalizeSupplierName(rawName);
  try {
    return await prisma.$transaction(async (tx) => {
      const created = await tx.supplier.create({ data: { name, aliases: aliases ?? [] } });
      await audit(tx, { actorId, entity: "Supplier", entityId: created.id, action: "CREATE", after: { name } });
      return created;
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      const existing = await prisma.supplier.findFirst({ where: { name } });
      throw new HttpApiError(409, "SUPPLIER_EXISTS", "A supplier with this name already exists", {
        existingId: existing?.id ? String(existing.id) : null,
      });
    }
    throw e;
  }
}

export { createOrConflict as createSupplier };

export async function updateSupplier(
  actorId: number,
  rawId: string,
  patch: { name?: string; addAlias?: string },
) {
  if (!/^\d+$/.test(rawId)) throw new HttpApiError(404, "NOT_FOUND", "Supplier not found");
  const id = Number(rawId);
  return prisma.$transaction(async (tx) => {
    const row = await tx.supplier.findUnique({ where: { id } });
    if (!row || row.mergedIntoId !== null) {
      throw new HttpApiError(404, "NOT_FOUND", row ? "Supplier merged into another record" : "Supplier not found");
    }
    const data: { name?: string; aliases?: string[] } = {};
    if (patch.name) data.name = normalizeSupplierName(patch.name);
    let afterAliases: string[] | undefined;
    if (patch.addAlias) {
      const current = Array.isArray(row.aliases) ? (row.aliases as string[]) : [];
      const alias = patch.addAlias.trim();
      if (!current.includes(alias)) afterAliases = [...current, alias];
      data.aliases = afterAliases;
    }
    const updated = await tx.supplier.update({ where: { id }, data });
    await audit(tx, {
      actorId,
      entity: "Supplier",
      entityId: id,
      action: "UPDATE",
      before: { name: row.name, aliases: row.aliases },
      after: { name: updated.name, aliases: updated.aliases },
    });
    return updated;
  });
}

// spec-006-v1 merge: re-point LPOs, alias the loser, mark mergedIntoId — atomic + audited.
export async function mergeSupplier(actorId: number, sourceRawId: string, targetRawId: number) {
  if (!/^\d+$/.test(sourceRawId)) throw new HttpApiError(404, "NOT_FOUND", "Supplier not found");
  return prisma.$transaction(async (tx) => {
    const source = await tx.supplier.findUnique({ where: { id: Number(sourceRawId) } });
    const target = await tx.supplier.findUnique({ where: { id: targetRawId } });
    if (!source || !target) throw new HttpApiError(404, "NOT_FOUND", "Supplier not found");
    if (source.id === target.id) {
      throw new HttpApiError(422, "SELF_MERGE", "Cannot merge a supplier into itself");
    }
    if (source.mergedIntoId !== null) {
      throw new HttpApiError(422, "ALREADY_MERGED", "Source supplier is already merged");
    }
    if (target.mergedIntoId !== null) {
      throw new HttpApiError(422, "TARGET_MERGED", "Target supplier is itself merged into another record");
    }

    await tx.lpo.updateMany({ where: { supplierId: source.id }, data: { supplierId: target.id } });

    const currentAliases = Array.isArray(target.aliases) ? (target.aliases as string[]) : [];
    const nextAliases = currentAliases.includes(source.name)
      ? currentAliases
      : [...currentAliases, source.name];

    await tx.supplier.update({ where: { id: source.id }, data: { mergedIntoId: target.id } });
    const updatedTarget = await tx.supplier.update({
      where: { id: target.id },
      data: { aliases: nextAliases },
    });

    await audit(tx, {
      actorId,
      entity: "Supplier",
      entityId: source.id,
      action: "MERGE",
      before: { supplierId: source.id, name: source.name },
      after: { mergedIntoId: target.id, lposRepointedTo: target.id },
    });
    return updatedTarget;
  });
}
