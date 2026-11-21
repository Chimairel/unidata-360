import { unstable_rethrow } from "next/navigation";
import { fetchDummyJsonCatalog } from "@/backend/data/dummyJsonCatalog";
import { AuthenticationRequired, session } from "@/backend/session";
import { canManageOps } from "@/shared/access";

export async function GET() {
  try {
    const s = await session();
    if (!canManageOps(s.role)) {
      return Response.json({ error: "Catalog access is limited to Operations." }, { status: 403 });
    }
    const result = await fetchDummyJsonCatalog();
    return Response.json(result, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e) {
    unstable_rethrow(e);
    if (e instanceof AuthenticationRequired) {
      return Response.json(
        { error: e.message },
        { status: 401, headers: { "Cache-Control": "no-store" } },
      );
    }
    console.error(e);
    return Response.json(
      { error: "Unable to load DummyJSON catalog right now." },
      { status: 500 },
    );
  }
}
