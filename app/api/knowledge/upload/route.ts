import { NextRequest } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { processDocument } from "@/lib/knowledge/document-processor";
import { prisma } from "@/lib/prisma"; // Add this import for prisma

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return new Response("Unauthorized", { status: 401 });
    }

    // Verify user exists in database
    const user = await prisma.user.findUnique({
      where: { id: session.user.id }
    });

    if (!user) {
      return Response.json({
        success: false,
        error: "User not found"
      }, { status: 404 });
    }

    const formData = await req.formData();
    const uploadedFile = formData.get("file") as File;
    
    if (!uploadedFile) {
      return Response.json({
        success: false,
        error: "No file provided"
      }, { status: 400 });
    }

    // File validation
    const allowedTypes = [
      'application/pdf', 
      'text/plain', 
      'application/msword', 
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];
    
    if (!allowedTypes.includes(uploadedFile.type)) {
      return Response.json({
        success: false,
        error: "Invalid file type. Allowed types: PDF, TXT, DOC, DOCX"
      }, { status: 400 });
    }

    // File size validation (e.g., 10MB limit)
    const maxSize = 10 * 1024 * 1024; // 10MB in bytes
    if (uploadedFile.size > maxSize) {
      return Response.json({
        success: false,
        error: `File size exceeds 10MB limit. Current size: ${formatFileSize(uploadedFile.size)}`
      }, { status: 400 });
    }

    console.log('Processing document for user ID:', session.user.id);
    const document = await processDocument(uploadedFile, session.user.id);
    
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

// Helper function for file size formatting
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}