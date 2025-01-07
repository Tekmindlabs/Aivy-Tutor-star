import { DataType } from '@zilliz/milvus2-sdk-node';
import { getMilvusClient } from './client';
import { ShowCollectionsResponse } from '@zilliz/milvus2-sdk-node/dist/milvus/types/Collection';

export const VECTOR_DIM = 1024; // GTE-Base dimension

export async function setupCollections() {
  try {
    const client = await getMilvusClient();

    // Content vectors collection (existing)
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

    // Memory vectors collection (new)
    await client.createCollection({
      collection_name: 'memory_vectors',
      fields: [
        { name: 'id', data_type: DataType.VARCHAR, is_primary_key: true, max_length: 36 },
        { name: 'user_id', data_type: DataType.VARCHAR, max_length: 36 },
        { name: 'content_type', data_type: DataType.VARCHAR, max_length: 20 },
        { name: 'memory_id', data_type: DataType.VARCHAR, max_length: 36 },
        { name: 'embedding', data_type: DataType.FLOAT_VECTOR, dim: VECTOR_DIM },
        { name: 'content', data_type: DataType.VARCHAR, max_length: 65535 },
        { name: 'timestamp', data_type: DataType.VARCHAR, max_length: 30 },
        { name: 'metadata', data_type: DataType.JSON }
      ],
      enable_dynamic_field: true
    });

    // User memories collection (new)
    await client.createCollection({
      collection_name: 'user_memories',
      fields: [
        { name: 'id', data_type: DataType.VARCHAR, is_primary_key: true, max_length: 36 },
        { name: 'user_id', data_type: DataType.VARCHAR, max_length: 36 },
        { name: 'memory_id', data_type: DataType.VARCHAR, max_length: 36 },
        { name: 'content_type', data_type: DataType.VARCHAR, max_length: 20 },
        { name: 'content', data_type: DataType.VARCHAR, max_length: 65535 },
        { name: 'timestamp', data_type: DataType.VARCHAR, max_length: 30 },
        { name: 'version', data_type: DataType.VARCHAR, max_length: 10 },
        { name: 'metadata', data_type: DataType.JSON }
      ],
      enable_dynamic_field: true
    });

    // Create indices for content_vectors
    await client.createIndex({
      collection_name: 'content_vectors',
      field_name: 'embedding',
      index_type: 'IVF_FLAT',
      metric_type: 'COSINE',
      params: { nlist: 1024 }
    });

    // Create indices for memory_vectors
    await client.createIndex({
      collection_name: 'memory_vectors',
      field_name: 'embedding',
      index_type: 'IVF_FLAT',
      metric_type: 'COSINE',
      params: { nlist: 1024 }
    });

    // Load collections into memory
    await Promise.all([
      client.loadCollectionSync({ collection_name: 'content_vectors' }),
      client.loadCollectionSync({ collection_name: 'memory_vectors' }),
      client.loadCollectionSync({ collection_name: 'user_memories' })
    ]);

    console.log('Collections setup completed successfully');
  } catch (error) {
    console.error('Error setting up collections:', error);
    throw error;
  }
}

// Check if collection exists
export async function collectionExists(collectionName: string): Promise<boolean> {
  try {
    const client = await getMilvusClient();
    const response = await client.listCollections();
    
    if (Array.isArray(response)) {
      return response.some(collection => collection.name === collectionName);
    }
    
    return false;
  } catch (error) {
    console.error('Error checking collection existence:', error);
    return false;
  }
}

// Initialize collections if they don't exist
export async function initializeCollections() {
  try {
    const collectionsToCheck = [
      'content_vectors',
      'memory_vectors',
      'user_memories'
    ];

    const client = await getMilvusClient();
    const existingCollections = new Set((await client.listCollections()).map(c => c.name));

    const missingCollections = collectionsToCheck.filter(
      name => !existingCollections.has(name)
    );

    if (missingCollections.length > 0) {
      console.log(`Setting up missing collections: ${missingCollections.join(', ')}`);
      await setupCollections();
      console.log('Collections initialized successfully');
    } else {
      console.log('All collections already exist');
    }
  } catch (error) {
    console.error('Error initializing collections:', error);
    throw error;
  }
}