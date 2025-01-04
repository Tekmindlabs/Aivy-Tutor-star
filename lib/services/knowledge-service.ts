import { getEmbedding } from '@/lib/knowledge/embeddings';
import { insertVector, searchSimilarContent } from '@/lib/milvus/vectors';
import { Document, Note, URL, Vector, VectorResult } from '@/lib/knowledge/types';
import { handleMilvusError } from '@/lib/milvus/error-handler';
import { createRelationship, findRelatedContent } from '@/lib/milvus/knowledge-graph';
import { getMilvusClient } from '@/lib/milvus/client';

export class KnowledgeService {
  async getKnowledgeGraph(userId: string) {
    try {
      if (!userId) {
        throw new Error('User ID is required');
      }

      const client = await getMilvusClient();
      
      const contentResults = await client.query({
        collection_name: 'content_vectors',
        filter: `user_id == "${userId}"`,
        output_fields: ['id', 'content_type', 'content_id', 'metadata']
      });

      const nodes = contentResults.map((content: VectorResult) => ({
        id: content.content_id,
        type: content.content_type,
        metadata: JSON.parse(content.metadata)
      }));

      const relationships = await findRelatedContent({
        userId,
        contentId: nodes[0]?.id || '',
        maxDepth: 3,
        relationshipTypes: []
      });

      const edges = relationships.map(rel => ({
        source: rel.source_id,
        target: rel.target_id,
        type: rel.relationship_type,
        metadata: JSON.parse(rel.metadata)
      }));

      return {
        nodes,
        edges
      };
    } catch (error) {
      handleMilvusError(error);
      throw error;
    }
  }

  async addDocument(userId: string, document: Document): Promise<void> {
    try {
      const embedding = await getEmbedding(document.content);
      
      await insertVector({
        userId,
        contentType: 'document',
        contentId: document.id,
        embedding: Array.from(embedding),
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

  async searchRelatedContent(userId: string, query: string): Promise<Vector[]> {
    try {
      const embedding = await getEmbedding(query);
      const results = await searchSimilarContent({
        userId,
        embedding: Array.from(embedding),
        limit: 5,
        contentTypes: ['document', 'note', 'url']
      });
      return results;
    } catch (error) {
      handleMilvusError(error);
      return [];
    }
  }

  async addNote(userId: string, note: Note): Promise<void> {
    try {
      const embedding = await getEmbedding(note.content);
      await insertVector({
        userId,
        contentType: 'note',
        contentId: note.id,
        embedding: Array.from(embedding),
        metadata: {
          title: note.title,
          tags: note.tags,
          format: note.format
        }
      });
    } catch (error) {
      handleMilvusError(error);
    }
  }

  async addURL(userId: string, url: URL): Promise<void> {
    try {
      const embedding = await getEmbedding(url.content);
      await insertVector({
        userId,
        contentType: 'url',
        contentId: url.id,
        embedding: Array.from(embedding),
        metadata: {
          url: url.url,
          title: url.title,
          lastAccessed: url.lastAccessed.toISOString()
        }
      });
    } catch (error) {
      handleMilvusError(error);
    }
  }

  async createContentRelationship(
    userId: string,
    sourceId: string,
    targetId: string,
    type: string
  ): Promise<void> {
    try {
      if (!userId || !sourceId || !targetId || !type) {
        throw new Error('Missing required parameters for relationship creation');
      }

      await createRelationship({
        userId,
        sourceId,
        targetId,
        relationshipType: type,
        metadata: {
          createdAt: new Date().toISOString(),
          relationshipType: type
        }
      });
    } catch (error) {
      handleMilvusError(error);
      throw error;
    }
  }
}