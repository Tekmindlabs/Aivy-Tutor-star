import { NextRequest } from "next/server";
import { auth } from "@/auth";
import { searchKnowledgeBase } from "@/lib/knowledge/search";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return new Response("Unauthorized", { status: 401 });
    }

    const query = req.nextUrl.searchParams.get("q");
    if (!query) {
      return new Response("No query provided", { status: 400 });
    }

    const results = await searchKnowledgeBase(query, session.user.id);
    
    return Response.json(results);
  } catch (error) {
    console.error("Search error:", error);
    return new Response("Internal error", { status: 500 });
  }
}