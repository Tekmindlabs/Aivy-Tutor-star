import { getMem0Client } from './mem0-client';
import { v4 as uuidv4 } from 'uuid';

// Define interfaces for API responses
interface SearchResponse {
  results: Array<{
    id?: string;
    content_id?: string;
    user_id: string;
    content?: string;
    metadata?: Record<string, any>;
    score?: number;
  }>;
  success: boolean;
  error?: string;
}

interface MemoryContent {
  userId: string;
  contentType: string;
  content: string;
  metadata?: Record<string, any>;
}

interface SearchResult {
  id: string;
  userId: string;
  contentType?: string;
  content?: string;
  score?: number;
  timestamp: string;
  metadata: Record<string, any>;
}

export class MemoryService {
  private memory = getMem0Client();

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
      // Create search parameters object according to v2 API
      const searchParams = {
        query,
        filters: {
          AND: [
            { user_id: userId },
            ...(filters ? [filters] : [])
          ]
        },
        limit,
        version: 'v2'
      };

      // Call the search endpoint with proper typing
      const result = await this.memory.search<SearchResponse>(searchParams);

      if (!result?.results) {
        return [];
      }

      // Map the response to our internal format
      return result.results.map((entry): SearchResult => ({
        id: entry.content_id || entry.id || uuidv4(),
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
}