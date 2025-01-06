// memory-service.ts
import { getMem0Client } from './mem0-client';
import { v4 as uuidv4 } from 'uuid';

export interface MemoryContent {
  userId: string;
  contentType: string;
  content: string;
  metadata?: Record<string, any>;
}

export interface SearchParams {
  userId: string;
  query: string;
  limit: number;
  contentTypes: string[];
}

export interface MemoryResult {
  id: string;
  userId: string;
  contentType: string;
  metadata: Record<string, any>;
}

export interface SearchResult {
  content_id?: string;
  user_id: string;
  metadata?: {
    content_type?: string;
    [key: string]: any;
  };
  score?: number;
}

export class MemoryService {
  private memory = getMem0Client();

  async addMemory({
    userId,
    contentType,
    content,
    metadata = {}
  }: MemoryContent): Promise<MemoryResult> {
    try {
      // Align metadata structure with mem0_bridge.py
      const enrichedMetadata = {
        ...metadata,
        content_type: contentType,
        content_id: uuidv4(),
        timestamp: new Date().toISOString()
      };

      const result = await this.memory.add(
        content,
        userId,
        enrichedMetadata
      );

      if (!result.success) {
        throw new Error(result.error || 'Failed to add memory');
      }

      return {
        id: enrichedMetadata.content_id,
        userId,
        contentType,
        metadata: enrichedMetadata
      };
    } catch (error) {
      console.error('Error adding memory:', error);
      throw new Error('Failed to add memory');
    }
  }

  async searchMemories(query: string, userId: string, limit: number = 5) {
    if (!query || !userId) {
      throw new Error('Query and userId are required for searching memories');
    }

    try {
      const result = await this.memory.search(query, userId, limit);
      
      if (!result.success || !result.results) {
        return [];
      }

      // Align with mem0_bridge.py response format
      return result.results.map(entry => ({
        id: entry.metadata?.content_id || entry.id,
        userId: entry.user_id,
        contentType: entry.metadata?.content_type,
        content: entry.content,
        score: entry.score,
        timestamp: entry.metadata?.timestamp || new Date().toISOString(),
        metadata: entry.metadata || {}
      }));
    } catch (error) {
      console.error('Error searching memories:', error);
      throw new Error('Failed to search memories');
    }
  }

  // Add new method to align with mem0_bridge.py delete functionality
  async deleteMemory(userId: string, memoryId: string) {
    if (!userId || !memoryId) {
      throw new Error('UserId and memoryId are required for deleting memory');
    }

    try {
      const result = await this.memory.delete(userId, memoryId);

      if (!result.success) {
        throw new Error(result.error || 'Failed to delete memory');
      }

      return result;
    } catch (error) {
      console.error('Error deleting memory:', error);
      throw new Error('Failed to delete memory');
    }
  }
}