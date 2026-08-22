import { prisma } from "@/server/db";

export const dynamic = "force-dynamic";

// spec-001 AC: /health reflects app + database status.
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return Response.json({ status: "ok", db: "ok" });
  } catch {
    return Response.json({ status: "degraded", db: "down" }, { status: 503 });
  }
}
