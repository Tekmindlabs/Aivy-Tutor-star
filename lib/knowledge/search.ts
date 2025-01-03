import { getEmbedding } from './embeddings';
import { searchSimilarContent } from '../milvus/vectors';
import { findRelatedContent } from '../milvus/knowledge-graph';
import { prisma } from '@/lib/prisma';

export async function searchKnowledgeBase(
  query: string,
  userId: string,
  limit: number = 10
): Promise<any[]> {
  try {
    const { data } = await EmbeddingModel.generateEmbedding(query);
    console.log('Search query embedding generated:', data.length);

    const similarContent = await searchSimilarContent({
      userId,
      embedding: Array.from(data),
      limit
    });

    // Get content details from Prisma
    const contentIds = similarContent.map(result => result.content_id);
    const contents = await prisma.documents.findMany({
      where: {
        id: { in: contentIds },
        userId
      },
      select: {
        id: true,
        title: true,
        content: true,
        createdAt: true
      }
    });

    // Find related content
    const relatedContent = await Promise.all(
      contentIds.map(id => findRelatedContent({ 
        userId, 
        contentId: id, 
        maxDepth: 1 
      }))
    );

    return similarContent.map((result, index) => ({
      id: result.content_id,
      type: result.content_type,
      title: contents[index]?.title || '',
      excerpt: contents[index]?.content?.substring(0, 200) + '...',
      createdAt: contents[index]?.createdAt,
      score: result.score,
      related: relatedContent[index]
    }));
  } catch (error) {
    console.error('Error searching knowledge base:', error);
    throw error;
  }
}