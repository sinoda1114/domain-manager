import { getDatabaseClient } from "@/infrastructure/db/client";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await getDatabaseClient().execute("SELECT 1");
    return Response.json({ ok: true, database: "connected" });
  } catch (error) {
    console.error("Database health check failed", error instanceof Error ? error.message : error);
    return Response.json({ ok: false, database: "unavailable" }, { status: 503 });
  }
}
