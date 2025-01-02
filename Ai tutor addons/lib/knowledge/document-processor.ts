import { Document } from './types';
import { prisma } from '@/lib/prisma';
import { getEmbedding } from './embeddings';
import { insertVector } from '../milvus/vectors';
import { createRelationship } from '../milvus/knowledge-graph';

export async function processDocument(
  file: File,
  userId: string
): Promise<Document> {
  const content = await extractText(file);
  const embedding = await getEmbedding(content);

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

  // Create relationships based on content analysis
  await createDocumentRelationships(document.id, content, userId);

  return document;
}

async function createDocumentRelationships(
  documentId: string,
  content: string,
  userId: string
) {
  // Example: Create relationships with similar documents
  const embedding = await getEmbedding(content);
  const similar = await searchSimilarContent({
    userId,
    embedding,
    limit: 3,
    contentTypes: ['document']
  });

  // Create relationships for similar documents
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
}