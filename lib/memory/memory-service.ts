import { getEmbedding } from '@/lib/knowledge/embeddings';
import { Message } from '@/types/chat';
import { insertVector, searchSimilarContent } from '@/lib/milvus/vectors';

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
    // Generate embedding from the last message
    const lastMessage = messages[messages.length - 1];
    const embedding = await getEmbedding(lastMessage.content);

    const memoryEntry: MemoryEntry = {
      id: crypto.randomUUID(),
      messages,
      metadata,
      userId,
      timestamp: new Date()
    };

    // Store vector in Milvus
    await insertVector(
      userId,
      'memory',
      memoryEntry.id,
      embedding,
      {
        messages: JSON.stringify(messages),
        metadata: JSON.stringify(metadata)
      }
    );

    return memoryEntry;
  }

  async searchMemories(
    query: string,
    userId: string,
    limit: number = 5
  ): Promise<MemoryEntry[]> {
    const queryEmbedding = await getEmbedding(query);
    
    const results = await searchSimilarContent({
      userId,
      embedding: queryEmbedding,
      limit,
      contentTypes: ['memory']
    });

    return results.map(result => ({
      id: result.content_id,
      messages: JSON.parse(result.metadata.messages),
      metadata: JSON.parse(result.metadata.metadata),
      userId,
      timestamp: new Date(result.metadata.timestamp)
    }));
  }
}