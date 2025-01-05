import { getMilvusClient } from './client';
import { v4 as uuidv4 } from 'uuid';
import { VectorResult } from '../knowledge/types';

/**
 * Inserts a vector into the Milvus database with enhanced logging and error handling
 */
export async function insertVector({
  userId,
  contentType,
  contentId,
  embedding,
  metadata = {}
}: {
  userId: string;
  contentType: string;
  contentId: string;
  embedding: number[];
  metadata?: Record<string, any>;
}): Promise<VectorResult> {
  try {
    // Initial logging of vector insertion attempt
    console.log('Starting vector insertion:', {
      userId,
      contentType,
      contentId,
      embeddingDimension: embedding.length,
      metadataKeys: Object.keys(metadata)
    });

    // Get Milvus client
    const client = await getMilvusClient();
    console.log('Milvus client connected successfully');

    // Verify embedding dimension
    if (embedding.length !== 1024) {
      const error = new Error(`Invalid embedding dimension: ${embedding.length}, expected 1024`);
      console.error('Embedding dimension validation failed:', error);
      throw error;
    }

    // Generate vector ID
    const vectorId = uuidv4();
    console.log('Generated vector ID:', vectorId);

    // Prepare insertion data
    const insertData = {
      id: vectorId,
      user_id: userId,
      content_type: contentType,
      content_id: contentId,
      embedding: embedding,
      metadata: JSON.stringify(metadata)
    };

    console.log('Preparing to insert vector data:', {
      vectorId,
      userId,
      contentType,
      contentId,
      metadataSize: JSON.stringify(metadata).length
    });

    // Perform insertion
    const insertResult = await client.insert({
      collection_name: 'content_vectors',
      data: [insertData]
    });

    console.log('Vector inserted successfully:', {
      vectorId,
      status: insertResult.status,
      timestamp: new Date().toISOString()
    });

    // Return vector result
    return {
      id: vectorId,
      user_id: userId,
      content_type: contentType,
      content_id: contentId,
      metadata: JSON.stringify(metadata)
    };

  } catch (error: unknown) {
    console.error('Vector insertion failed:', {
      error: error instanceof Error ? error.message : String(error),
      userId,
      contentId,
      timestamp: new Date().toISOString()
    });
    throw error;
  }
}

/**
 * Searches for similar content in the Milvus database with enhanced logging
 */
export async function searchSimilarContent({
  userId,
  embedding,
  limit,
  contentTypes
}: {
  userId: string;
  embedding: number[];
  limit: number;
  contentTypes: string[];
}): Promise<{ data: VectorResult[], timestamp: string }> {
  try {
    // Log search attempt
    console.log('Starting vector search:', {
      userId,
      embeddingDimension: embedding.length,
      limit,
      contentTypes
    });

    // Get Milvus client
    const client = await getMilvusClient();
    console.log('Milvus client connected successfully');

    // Verify embedding dimension
    if (embedding.length !== 1024) {
      throw new Error(`Invalid embedding dimension: ${embedding.length}, expected 1024`);
    }

    const searchParams = {
      collection_name: 'memories',
      search_params: {
        anns_field: 'embedding',
        topk: limit,
        metric_type: 'L2',
        params: { nprobe: 10 },
      },
      vector_field: embedding,
      output_fields: ['content', 'user_id', 'timestamp', 'metadata', 'content_type'],
      expression: `user_id == "${userId}" && content_type in ["${contentTypes.join('","')}"]`
    };

    // Execute search
    const searchResult = await client.search(searchParams);
    
    // Transform results to VectorResult format
    const transformedResults = Array.isArray(searchResult.results) 
      ? searchResult.results.map((result: any) => ({
          content_id: result.id || uuidv4(),
          user_id: result.user_id,
          content_type: result.content_type,
          metadata: result.metadata,
          timestamp: result.timestamp || new Date().toISOString(),
          score: result.score
        }))
      : [];

    return {
      data: transformedResults,
      timestamp: new Date().toISOString()
    };

  } catch (error) {
    console.error('Error in searchSimilarContent:', error);
    return { 
      data: [], 
      timestamp: new Date().toISOString() 
    };
  }
}

/**
 * Utility function to validate embedding dimension
 */
function validateEmbedding(embedding: number[]): boolean {
  if (!Array.isArray(embedding)) {
    console.error('Invalid embedding format: not an array');
    return false;
  }
  
  if (embedding.length !== 1024) {
    console.error(`Invalid embedding dimension: ${embedding.length}`);
    return false;
  }
  
  return true;
}