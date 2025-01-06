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

export class MemoryService {
  private memory = getMem0Client();

  async addMemory({
    userId,
    contentType,
    content,
    metadata = {}
  }: MemoryContent) {
    try {
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

  async searchMemories({
    userId,
    query,
    limit,
    contentTypes
  }: SearchParams) {
    try {
      const searchResults = await this.memory.search(
        query,
        {
          user_id: userId,
          limit,
          filters: {
            content_type: { $in: contentTypes }
          }
        }
      );

      return {
        data: searchResults.map(result => ({
          content_id: result.id,
          user_id: result.user_id,
          content_type: result.metadata.content_type,
          metadata: result.metadata,
          score: result.score
        })),
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error searching memories:', error);
      throw new Error('Failed to search memories');
    }
  }

  async deleteMemories(userId: string, contentIds: string[]) {
    try {
      await Promise.all(
        contentIds.map(id => 
          this.memory.delete({
            user_id: userId,
            filters: {
              content_id: id
            }
          })
        )
      );
      return true;
    } catch (error) {
      console.error('Error deleting memories:', error);
      throw new Error('Failed to delete memories');
    }
  }
}