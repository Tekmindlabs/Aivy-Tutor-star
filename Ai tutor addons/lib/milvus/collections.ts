import { DataType } from '@zilliz/milvus2-sdk-node';
import { getMilvusClient } from './client';

export const VECTOR_DIM = 1536; // Matches your embedding dimension

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

  // Knowledge graph relationships collection
  await client.createCollection({
    collection_name: 'knowledge_graph',
    fields: [
      { name: 'id', data_type: DataType.VARCHAR, is_primary_key: true, max_length: 36 },
      { name: 'user_id', data_type: DataType.VARCHAR, max_length: 36 },
      { name: 'source_id', data_type: DataType.VARCHAR, max_length: 36 },
      { name: 'target_id', data_type: DataType.VARCHAR, max_length: 36 },
      { name: 'relationship_type', data_type: DataType.VARCHAR, max_length: 50 },
      { name: 'metadata', data_type: DataType.JSON }
    ],
    enable_dynamic_field: true
  });

  // Create indexes
  await client.createIndex({
    collection_name: 'content_vectors',
    field_name: 'embedding',
    index_type: 'IVF_FLAT',
    metric_type: 'L2',
    params: { nlist: 1024 }
  });

  // Load collections into memory
  await client.loadCollectionSync({ collection_name: 'content_vectors' });
  await client.loadCollectionSync({ collection_name: 'knowledge_graph' });
}