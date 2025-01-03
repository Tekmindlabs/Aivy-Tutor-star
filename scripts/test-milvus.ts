import { getMilvusClient } from '../lib/milvus/client';

async function testConnection() {
    try {
      const client = await getMilvusClient();
      console.log('Successfully connected to Milvus!');
      
      // Try to list collections to verify connection
      const collections = await client.listCollections();
      console.log('Available collections:', collections);
    } catch (error) {
      console.error('Failed to connect to Milvus:', error);
    }
}
  
testConnection();