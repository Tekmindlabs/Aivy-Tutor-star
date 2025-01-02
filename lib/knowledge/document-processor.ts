import { Document } from './types';
import { prisma } from '@/lib/prisma';
import { getEmbedding } from './embeddings';
import { insertVector } from '../milvus/vectors';
import { createRelationship } from '../milvus/knowledge-graph';
import { searchSimilarContent } from '../milvus/vectors';

export async function processDocument(
  file: File,
  userId: string
): Promise<Document> {
  try {
    const content = await extractText(file);
    const embedding = await getEmbedding(content);
    console.log('Document embedding generated:', embedding.length);

    // Store document in Prisma
    const document = await prisma.documents.create({
      data: {
        userId,
        title: file.name,
        content,
        fileType: file.type,
        metadata: {
          size: file.size,
          lastModified: file.lastModified,
        },
      },
    });

    // Store vector in Milvus
    await insertVector({
      userId,
      contentType: 'document',
      contentId: document.id,
      embedding,
      metadata: {
        title: file.name,
        fileType: file.type
      }
    });

    // Create relationships
    await createDocumentRelationships(document.id, content, userId);

    return document;
  } catch (error) {
    console.error('Error processing document:', error);
    throw error;
  }
}

async function createDocumentRelationships(
  documentId: string,
  content: string,
  userId: string
) {
  try {
    const embedding = await getEmbedding(content);
    const similar = await searchSimilarContent({
      userId,
      embedding,
      limit: 3,
      contentTypes: ['document']
    });

    for (const result of similar) {
      if (result.content_id !== documentId) {
        await createRelationship({
          userId,
          sourceId: documentId,
          targetId: result.content_id,
          relationshipType: 'similar_to',
          metadata: {
            similarity_score: result.score
          }
        });
      }
    }
  } catch (error) {
    console.error('Error creating document relationships:', error);
  }
}

async function extractText(file: File): Promise<string> {
  // Implement text extraction based on file type
  // This is a placeholder - implement actual text extraction logic
  return '';
}