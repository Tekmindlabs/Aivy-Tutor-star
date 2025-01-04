// /app/api/knowledge/graph/route.ts

import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { KnowledgeService } from '@/lib/services/knowledge-service';
import { handleMilvusError } from '@/lib/milvus/error-handler';

const knowledgeService = new KnowledgeService();

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log('Fetching graph data for user:', session.user.id);
    const graphData = await knowledgeService.getKnowledgeGraph(session.user.id);
    
    return Response.json(graphData);
  } catch (error) {
    console.error('Error fetching graph data:', error);
    handleMilvusError(error);
    return Response.json({ error: "Failed to fetch graph data" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }


    const { sourceId, targetId, type } = await req.json();
    
    if (!sourceId || !targetId || !type) {
      return Response.json(
        { error: "Missing required parameters" }, 
        { status: 400 }
      );
    }

    await knowledgeService.createContentRelationship(
      session.user.id,
      sourceId,
      targetId,
      type
    );

    return Response.json({ success: true });
  } catch (error) {
    console.error('Error creating relationship:', error);
    handleMilvusError(error);
    return Response.json({ error: "Failed to create relationship" }, { status: 500 });
  }
}