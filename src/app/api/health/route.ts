import { connection } from "next/server";
import { first } from "@/lib/server/store";

export async function GET() {
  await connection();
  const headers = { "Cache-Control": "no-store" };
  try {
    await first("SELECT id FROM master LIMIT 1");
    return Response.json({ status: "ok" }, { headers });
  } catch (error) {
    console.error("Database readiness check failed", error);
    return Response.json({ status: "unavailable" }, { status: 503, headers });
  }
}
