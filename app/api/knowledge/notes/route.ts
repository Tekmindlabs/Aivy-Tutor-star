import { NextRequest } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getEmbedding } from "@/lib/knowledge/embeddings";
import { insertVector } from "@/lib/milvus/vectors";

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
    console.log('Note content embedding generated:', embedding.length);

    // Create note in database
    const note = await prisma.notes.create({
      data: {
        userId: session.user.id,
        title,
        content,
      },
    });

    // Store vector in Milvus
    await insertVector({
      userId: session.user.id,
      contentType: 'note',
      contentId: note.id,
      embedding,
      metadata: {
        title,
        createdAt: new Date()
      }
    });
    
    return Response.json(note);
  } catch (error) {
    console.error("Note creation error:", error);
    return new Response(
      JSON.stringify({ error: 'Failed to create note' }), 
      { status: 500 }
    );
  }
}