import { getMilvusClient } from '../lib/milvus/client';

async function testConnection() {
  try {
    const client = await getMilvusClient();
    console.log('Testing connection...');
    
    // Test basic operations
    const collections = await client.listCollections();
    console.log('Connected successfully! Available collections:', collections);
    
  } catch (error) {
    console.error('Connection failed:', error);
    process.exit(1);
  }
}

testConnection();