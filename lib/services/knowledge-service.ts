import { getEmbedding } from '@/lib/knowledge/embeddings';
import { insertVector, searchSimilarContent } from '@/lib/milvus/vectors';
import { Document, Note, URL, Vector, VectorResult } from '@/lib/knowledge/types';
import { handleMilvusError } from '@/lib/milvus/error-handler';
import { createRelationship, findRelatedContent } from '@/lib/milvus/knowledge-graph';
import { getMilvusClient } from '@/lib/milvus/client';

export class KnowledgeService {
  async addDocument(userId: string, document: Document): Promise<void> {
    try {
      // Generate embedding for document content
      const embedding = await getEmbedding(document.content);
      
      // Insert vector into Milvus
      const vectorResult = await insertVector({
        userId,
        contentType: 'document',
        contentId: document.id,
        embedding: Array.from(embedding),
        metadata: {
          title: document.title,
          fileType: document.fileType,
          version: document.version,
          createdAt: new Date().toISOString()
        }
      });

      // Find similar content to create relationships
      const similarContent = await searchSimilarContent({
        userId,
        embedding: Array.from(embedding),
        limit: 5
      });

      // Create relationships with similar content
      for (const content of similarContent) {
        if (content.content_id !== document.id) {
          await createRelationship({
            userId,
            sourceId: document.id,
            targetId: content.content_id,
            relationshipType: 'related',
            metadata: {
              similarity: content.score,
              createdAt: new Date().toISOString()
            }
          });
        }
      }
    } catch (error) {
      handleMilvusError(error);
      throw error;
    }
  }

  async getKnowledgeGraph(userId: string) {
    try {
      const client = await getMilvusClient();
      
      // Get all content vectors for user
      const contentResults = await client.query({
        collection_name: 'content_vectors',
        filter: `user_id == "${userId}"`,
        output_fields: ['id', 'content_type', 'content_id', 'metadata']
      });

      // Transform content results into nodes
      const nodes = contentResults.map((content: VectorResult) => ({
        id: content.content_id,
        type: content.content_type,
        label: JSON.parse(content.metadata).title || content.content_id,
        metadata: JSON.parse(content.metadata)
      }));

      // Get relationships between nodes
      const relationships = await findRelatedContent({
        userId,
        contentId: nodes[0]?.id || '',
        maxDepth: 3,
        relationshipTypes: ['related', 'references']
      });

      // Transform relationships into edges
      const edges = relationships.map(rel => ({
        source: rel.source_id,
        target: rel.target_id,
        type: rel.relationship_type,
        metadata: JSON.parse(rel.metadata)
      }));

      return { nodes, edges };
    } catch (error) {
      handleMilvusError(error);
      throw error;
    }
  }

  async createContentRelationship(
    userId: string,
    sourceId: string,
    targetId: string,
    relationshipType: string
  ) {
    try {
      await createRelationship({
        userId,
        sourceId,
        targetId,
        relationshipType,
        metadata: {
          createdAt: new Date().toISOString()
        }
      });
    } catch (error) {
      handleMilvusError(error);
      throw error;
    }
  }
}