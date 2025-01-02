import { DataType } from '@zilliz/milvus2-sdk-node';
import { getMilvusClient } from './client';

export const VECTOR_DIM = 768; // GTE-Base dimension

export async function setupCollections() {
  const client = await getMilvusClient();

  // Content vectors collection
  await client.createCollection({
    collection_name: 'content_vectors',
    fields: [
      { name: 'id', data_type: DataType.VARCHAR, is_primary_key: true, max_length: 36 },
      { name: 'user_id', data_type: DataType.VARCHAR, max_length: 36 },
      { name: 'content_type', data_type: DataType.VARCHAR, max_length: 20 },
      { name: 'content_id', data_type: DataType.VARCHAR, max_length: 36 },
      { name: 'embedding', data_type: DataType.FLOAT_VECTOR, dim: VECTOR_DIM },
      { name: 'metadata', data_type: DataType.JSON }
    ],
    enable_dynamic_field: true
  });

  // Create index
  await client.createIndex({
    collection_name: 'content_vectors',
    field_name: 'embedding',
    index_type: 'IVF_FLAT',
    metric_type: 'COSINE', // Changed to COSINE for normalized embeddings
    params: { nlist: 1024 }
  });

  await client.loadCollectionSync({ collection_name: 'content_vectors' });
}