import { db } from "~/server/db";

export const dynamic = "force-dynamic";

/** Liveness/readiness probe used by Docker healthchecks and uptime monitors. */
export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`;
    return Response.json({ status: "ok", db: "up" });
  } catch {
    return Response.json({ status: "error", db: "down" }, { status: 503 });
  }
}
