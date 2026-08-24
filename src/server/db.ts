import { PrismaClient } from "@prisma/client";

// Singleton per Next.js dev-hot-reload convention. spec-002 formalizes src/server/db.
// NOTE (T-031): deliberately NO eager env validation here — route modules are
// evaluated during `next build`, and throwing without DATABASE_URL at import
// time would break env-less CI builds. Config problems instead surface as
// named envelopes (SERVER_CONFIG / DB_UNAVAILABLE 503) via lib/http-error.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
export const prisma = globalForPrisma.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
