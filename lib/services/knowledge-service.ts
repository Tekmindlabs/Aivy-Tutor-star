import { insertVector, searchSimilarContent } from '@/lib/milvus/vectors';
import { createRelationship, findRelatedContent } from '@/lib/milvus/knowledge-graph';
import { Document, Note, URL, Vector } from '@/lib/knowledge/types';
import { handleMilvusError } from '@/lib/milvus/error-handler';

export class KnowledgeService {
  async addDocument(userId: string, document: Document): Promise<void> {
    try {
      // Insert document vector
      await insertVector({
        userId,
        contentType: 'document',
        contentId: document.id,
        embedding: document.embedding,
        metadata: {
          title: document.title,
          fileType: document.fileType,
          version: document.version
        }
      });
    } catch (error) {
      handleMilvusError(error);
    }
  }

  async searchRelatedContent(userId: string, query: number[]): Promise<Vector[]> {
    try {
      const results = await searchSimilarContent({
        userId,
        embedding: query,
        limit: 5,
        contentTypes: ['document', 'note', 'url']
      });
      return results;
    } catch (error) {
      handleMilvusError(error);
      return [];
    }
  }

  async createContentRelationship(
    userId: string,
    sourceId: string,
    targetId: string,
    type: string
  ): Promise<void> {
    try {
      await createRelationship({
        userId,
        sourceId,
        targetId,
        relationshipType: type,
        metadata: {
          createdAt: new Date().toISOString()
        }
      });
    } catch (error) {
      handleMilvusError(error);
    }
  }
}