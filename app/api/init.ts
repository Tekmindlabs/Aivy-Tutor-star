import { setupCollections } from '@/lib/milvus/collections';
import { handleMilvusError } from '@/lib/milvus/error-handler';

export async function initializeMilvus() {
  try {
    await setupCollections();
    console.log('Milvus collections initialized successfully');
  } catch (error) {
    handleMilvusError(error);
  }
}