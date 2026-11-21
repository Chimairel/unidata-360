import { unstable_rethrow } from "next/navigation";
import { fetchDummyJsonCatalog } from "@/backend/data/dummyJsonCatalog";
import { AuthenticationRequired, session } from "@/backend/session";

export async function GET() {
  try {
    await session();
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
