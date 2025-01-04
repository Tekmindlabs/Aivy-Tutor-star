import { NextRequest } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { processDocument } from "@/lib/knowledge/document-processor";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return new Response("Unauthorized", { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id }
    });

    if (!user) {
      return new Response("User not found", { status: 404 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File;
    
    if (!file) {
      return new Response("No file provided", { status: 400 });
    }

    const document = await processDocument(file, session.user.id);
    
    return Response.json({
      success: true,
      document,
      message: "Document uploaded successfully"
    });
  } catch (error) {
    console.error("Upload error:", error);
    return Response.json({
      success: false,
      error: "Failed to upload document"
    }, { status: 500 });
  }
}