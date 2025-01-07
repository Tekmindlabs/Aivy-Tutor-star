import { getMem0Client } from './mem0-client';
import { v4 as uuidv4 } from 'uuid';

// Define interfaces for memory content and results
export interface MemoryContent {
  userId: string;
  contentType: string;
  content: string;
  metadata?: Record<string, any>;
}

export interface MemoryResult {
  id: string;
  userId: string;
  contentType: string;
  metadata: Record<string, any>;
}

export interface SearchResult {
  id: string;
  userId: string;
  contentType?: string;
  content?: string;
  score?: number;
  timestamp: string;
  metadata: Record<string, any>;
}

// Define interface for search response from mem0
interface SearchResponse {
  success: boolean;
  error?: string;
  results?: Array<{
    id?: string;
    content_id?: string;
    user_id: string;
    content?: string;
    metadata?: Record<string, any>;
    score?: number;
  }>;
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
      const enrichedMetadata = {
        ...metadata,
        content_type: contentType,
        content_id: uuidv4(),
        timestamp: new Date().toISOString(),
        version: 'v2'
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

  async searchMemories(
    query: string,
    userId: string,
    limit: number = 5,
    filters?: Record<string, any>
  ): Promise<SearchResult[]> {
    if (!query || !userId) {
      throw new Error('Query and userId are required for searching memories');
    }

    try {
      // Call the search method with the correct parameters
      const result = await this.memory.search(query, userId, limit);

      if (!result.success || !result.results?.results) {
        return [];
      }

      // Map the response to our internal format
      return result.results.results.map((entry): SearchResult => ({
        id: entry.content_id || entry.id || uuidv4(),
        userId: entry.user_id,
        contentType: entry.metadata?.content_type,
        content: entry.metadata?.content,
        score: entry.score,
        timestamp: entry.metadata?.timestamp || new Date().toISOString(),
        metadata: entry.metadata || {}
      }));

    } catch (error) {
      console.error('Error searching memories:', error);
      throw new Error('Failed to search memories');
    }
  }

  async deleteMemory(userId: string, memoryId: string): Promise<{ success: boolean; error?: string }> {
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

  async getAllMemories(userId: string): Promise<SearchResult[]> {
    if (!userId) {
      throw new Error('UserId is required for getting all memories');
    }

    try {
      // Use an empty query to get all memories
      return await this.searchMemories('', userId, 100);
    } catch (error) {
      console.error('Error getting all memories:', error);
      throw new Error('Failed to get all memories');
    }
  }
}