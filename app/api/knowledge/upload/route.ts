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

    const formData = await req.formData();
    const file = formData.get("file") as File;
    
    if (!file) {
      return Response.json({
        success: false,
        error: "No file provided"
      }, { status: 400 });
    }

    // File validation
    const allowedTypes = ['application/pdf', 'text/plain', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (!allowedTypes.includes(file.type)) {
      return Response.json({
        success: false,
        error: "Invalid file type. Allowed types: PDF, TXT, DOC, DOCX"
      }, { status: 400 });
    }

    // File size validation (e.g., 10MB limit)
    const maxSize = 10 * 1024 * 1024; // 10MB in bytes
    if (file.size > maxSize) {
      return Response.json({
        success: false,
        error: "File size exceeds 10MB limit"
      }, { status: 400 });
    }

    const document = await processDocument(file, session.user.id);
    
    return Response.json({
      success: true,
      document,
      message: "Document uploaded successfully"
    });

  } catch (error: unknown) {
    console.error("Upload error:", error);
    
    const errorMessage = error instanceof Error 
      ? error.message 
      : "Failed to upload document";

    return Response.json({
      success: false,
      error: errorMessage
    }, { status: 500 });
  }
}

// Optional: Add file size helper function
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}