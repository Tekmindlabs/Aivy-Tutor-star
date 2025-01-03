import { Message } from '@/types/chat'; // Update the import path
import { VectorResult } from '@/lib/knowledge/types';
import { getEmbedding } from '@/lib/knowledge/embeddings'; // Update the import path
import { insertVector, searchSimilarContent } from '@/lib/milvus/vectors'; // Use searchSimilarContent instead of searchVectors

interface MemoryEntry {
  id: string;
  messages: Message[];
  metadata: Record<string, any>;
  userId: string;
  timestamp: Date;
}

export class MemoryService {
  async addMemory(
    messages: Message[], 
    userId: string, 
    metadata: Record<string, any> = {}
  ): Promise<MemoryEntry> {
    const lastMessage = messages[messages.length - 1];
    const embedding = await getEmbedding(lastMessage.content);

    const memoryEntry: MemoryEntry = {
      id: crypto.randomUUID(),
      messages,
      metadata,
      userId,
      timestamp: new Date()
    };

    await insertVector({
      userId,
      contentType: 'memory',
      contentId: memoryEntry.id,
      embedding: Array.from(embedding),
      metadata: {
        messages: JSON.stringify(messages),
        metadata: JSON.stringify(metadata)
      }
    });

    return memoryEntry;
  }

  async searchMemories(
    query: string,
    userId: string,
    limit?: number
  ): Promise<MemoryEntry[]> {
    const embedding = await getEmbedding(query);
    const searchEmbedding = Array.from(embedding);

    const results = await searchSimilarContent({ // Changed from searchVectors to searchSimilarContent
      userId,
      embedding: searchEmbedding,
      limit,
      contentTypes: ['memory']
    });

    return results.map((result: VectorResult) => ({
      id: result.content_id,
      messages: JSON.parse(result.metadata).messages,
      metadata: JSON.parse(result.metadata).metadata,
      userId: result.user_id,
      timestamp: new Date()
    }));
  }
}