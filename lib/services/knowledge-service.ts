import { getEmbedding } from '@/lib/knowledge/embeddings';
import { insertVector, searchSimilarContent } from '@/lib/milvus/vectors';
import { Document, Note, URL, Vector, VectorResult } from '@/lib/knowledge/types';
import { handleMilvusError } from '@/lib/milvus/error-handler';
import { createRelationship, findRelatedContent } from '@/lib/milvus/knowledge-graph';
import { getMilvusClient } from '@/lib/milvus/client';
import { GraphRelationship } from '../services/knowledge-graph';

interface GraphNode {
  id: string;
  type: string;
  label: string;
  metadata: any;
}


interface GraphData {
  nodes: GraphNode[];
  relationships: any[];
}

export class KnowledgeService {
  async addDocument(userId: string, document: Document): Promise<void> {
    try {
      // Generate embedding for document content
      const embedding = await getEmbedding(document.content);
      console.log('Generated embedding:', embedding?.length);

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

      console.log('Vector inserted:', vectorResult);

      // Find similar content to create relationships
      const similarContent = await searchSimilarContent({
        userId,
        embedding: Array.from(embedding),
        limit: 5
      });

      console.log('Similar content found:', similarContent);

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

          console.log('Relationship created:', relationship);
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
    
    // Get content nodes
    const contentResults = await client.query({
      collection_name: 'content',
      filter: `user_id == "${userId}"`,
      output_fields: ['content_id', 'content_type', 'metadata']
    });

    // Ensure contentResults is an array and has data
    if (!contentResults || !Array.isArray(contentResults.data)) {
      console.log('No content results found or invalid format:', contentResults);
      return { nodes: [], relationships: [] };
    }

    // Transform content into nodes
    const nodes = contentResults.data.map((content: VectorResult) => ({
      id: content.content_id,
      type: content.content_type,
      label: JSON.parse(content.metadata).title || content.content_id,
      metadata: JSON.parse(content.metadata)
    }));

    if (nodes.length === 0) {
      return { nodes: [], relationships: [] };
    }

    // Get relationships between nodes
    const relationships = await findRelatedContent({
      userId,
      contentId: nodes[0]?.id || '',
      maxDepth: 3,
    });

    return { nodes, relationships };
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