import { getMilvusClient } from '../lib/milvus/client';
import { handleMilvusError } from '../lib/milvus/error-handler';

async function testConnection() {
  try {
    console.log('Attempting to connect to Milvus at:', process.env.MILVUS_ADDRESS);
    const client = await getMilvusClient();
    console.log('Successfully connected to Milvus!');
    
    // Try to list collections to verify connection
    const collections = await client.listCollections();
    console.log('Available collections:', collections);
  } catch (error) {
    handleMilvusError(error);
    process.exit(1);
  }
}

testConnection();