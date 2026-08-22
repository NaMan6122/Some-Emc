import { PrismaClient } from "@prisma/client";

// Singleton per Next.js dev-hot-reload convention. spec-002 formalizes src/server/db.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
export const prisma = globalForPrisma.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
