import { connection } from "next/server";
import { ensureDemoUsers } from "@/backend/auth";
import { first } from "@/backend/store";

export async function GET() {
  await connection();
  const headers = { "Cache-Control": "no-store" };
  try {
    await first("SELECT id FROM retail_master LIMIT 1");
    await ensureDemoUsers();
    return Response.json({ status: "ok" }, { headers });
  } catch (error) {
    console.error("Database readiness check failed", error);
    return Response.json({ status: "unavailable" }, { status: 503, headers });
  }
}
