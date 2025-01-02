import { NextRequest } from "next/server";
import { auth } from "@/auth";
import { processDocument } from "@/lib/knowledge/document-processor";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return new Response("Unauthorized", { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File;
    
    if (!file) {
      return new Response("No file provided", { status: 400 });
    }

    const document = await processDocument(file, session.user.id);
    
    return Response.json(document);
  } catch (error) {
    console.error("Upload error:", error);
    return new Response("Internal error", { status: 500 });
  }
}