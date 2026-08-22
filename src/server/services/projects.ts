import { Prisma } from "@prisma/client";
import { prisma } from "@/server/db";
import { audit } from "@/server/audit/service";
import { HttpApiError } from "@/lib/http-error";
import type { CreateProjectInput, UpdateProjectInput } from "@/server/validation/project";

// spec-005-v1 project service. All mutations are audited inside the same
// transaction as the change itself (spec-004).

function idOrThrow(rawId: string): number {
  if (!/^\d+$/.test(rawId)) throw new HttpApiError(404, "NOT_FOUND", "Project not found");
  const id = Number(rawId);
  return id;
}

export async function listProjects() {
  return prisma.project.findMany({ orderBy: { code: "asc" } });
}

export async function getProject(rawId: string) {
  const id = idOrThrow(rawId);
  const p = await prisma.project.findUnique({ where: { id } });
  if (!p) throw new HttpApiError(404, "NOT_FOUND", "Project not found");
  return p;
}

function onUniqueCode(e: unknown) {
  if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
    return new HttpApiError(409, "CODE_TAKEN", "A project with this code already exists");
  }
  return undefined;
}

export async function createProject(actorId: number, input: CreateProjectInput) {
  try {
    return await prisma.$transaction(async (tx) => {
      const created = await tx.project.create({ data: input });
      await audit(tx, {
        actorId,
        entity: "Project",
        entityId: created.id,
        action: "CREATE",
        after: input,
      });
      return created;
    });
  } catch (e) {
    throw onUniqueCode(e) ?? e;
  }
}

export async function updateProject(actorId: number, rawId: string, patch: UpdateProjectInput) {
  const id = idOrThrow(rawId);
  try {
    return await prisma.$transaction(async (tx) => {
      const row = await tx.project.findUnique({ where: { id } });
      if (!row) throw new HttpApiError(404, "NOT_FOUND", "Project not found");
      // Volatile bookkeeping field — excluded from audit snapshots.
      /* eslint-disable @typescript-eslint/no-unused-vars */
      const { updatedAt: _ignored, ...before } = row;
      const updatedRow = await tx.project.update({ where: { id }, data: patch });
      const { updatedAt: __ignored, ...after } = updatedRow;
      /* eslint-enable @typescript-eslint/no-unused-vars */
      await audit(tx, {
        actorId,
        entity: "Project",
        entityId: id,
        action: "UPDATE",
        before,
        after,
      });
      return updatedRow;
    });
  } catch (e) {
    throw onUniqueCode(e) ?? e;
  }
}

export async function deleteProject(actorId: number, rawId: string) {
  const id = idOrThrow(rawId);
  try {
    return await prisma.$transaction(async (tx) => {
      const before = await tx.project.findUnique({ where: { id } });
      if (!before) throw new HttpApiError(404, "NOT_FOUND", "Project not found");
      const deleted = await tx.project.delete({ where: { id } });
      await audit(tx, {
        actorId,
        entity: "Project",
        entityId: id,
        action: "DELETE",
        before,
      });
      return deleted;
    });
  } catch (e) {
    // Restrict from dependent financial rows (LPOs, PCs, budgets, VOs).
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2003") {
      throw new HttpApiError(409, "HAS_DEPENDENTS", "Project has dependent records and cannot be deleted");
    }
    throw e;
  }
}
