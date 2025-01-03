import { getMilvusClient } from './client';
import { v4 as uuidv4 } from 'uuid';
import { VectorResult } from '../knowledge/types';

// In /lib/milvus/vectors.ts
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
  const client = await getMilvusClient();
  
  // Verify embedding dimension
  if (embedding.length !== 768) {
    throw new Error('Invalid embedding dimension');
  }

  const vectorId = uuidv4();
  
  await client.insert({
    collection_name: 'content_vectors',
    data: [{
      id: vectorId,
      user_id: userId,
      content_type: contentType,
      content_id: contentId,
      embedding: embedding,
      metadata: JSON.stringify(metadata)
    }]
  });

  return {
    id: vectorId,
    user_id: userId,
    content_type: contentType,
    content_id: contentId,
    metadata: JSON.stringify(metadata)
  };
}

export async function searchSimilarContent({
  userId,
  embedding,
  limit = 5,
  contentTypes = ['document', 'url', 'note']
}: {
  userId: string;
  embedding: number[];
  limit?: number;
  contentTypes?: string[];
}) {
  const client = await getMilvusClient();

  const results = await client.search({
    collection_name: 'content_vectors',
    vector: embedding,
    filter: `user_id == "${userId}" && content_type in ${JSON.stringify(contentTypes)}`,
    limit,
    output_fields: ['content_type', 'content_id', 'metadata'],
    params: { 
      nprobe: 10,
      metric_type: 'L2' // or 'COSINE' depending on your needs
    }
  });

  return results;
}