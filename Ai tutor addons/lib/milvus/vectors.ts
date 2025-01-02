import { getMilvusClient } from './client';
import { v4 as uuidv4 } from 'uuid';

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
}) {
  const client = await getMilvusClient();
  
  await client.insert({
    collection_name: 'content_vectors',
    data: [{
      id: uuidv4(),
      user_id: userId,
      content_type: contentType,
      content_id: contentId,
      embedding,
      metadata: JSON.stringify(metadata)
    }]
  });
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
    params: { nprobe: 10 }
  });

  return results;
}