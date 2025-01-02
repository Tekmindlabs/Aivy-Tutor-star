import { NextRequest } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getEmbedding } from "@/lib/knowledge/embeddings";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return new Response("Unauthorized", { status: 401 });
    }

    const { title, content } = await req.json();
    
    if (!title || !content) {
      return new Response("Title and content are required", { status: 400 });
    }

    const embedding = await getEmbedding(content);

    const note = await prisma.notes.create({
      data: {
        userId: session.user.id,
        title,
        content,
      },
    });

    await prisma.vectors.create({
      data: {
        contentType: "note",
        contentId: note.id,
        embedding,
      },
    });
    
    return Response.json(note);
  } catch (error) {
    console.error("Note creation error:", error);
    return new Response("Internal error", { status: 500 });
  }
}