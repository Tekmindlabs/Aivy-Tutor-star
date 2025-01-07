// lib/memory/bridge.ts
interface ApiResponse {
  success: boolean;
  error?: string;
  results?: any;
}

export class Mem0Bridge {
  private async callApi(command: string, args: any): Promise<ApiResponse> {
    try {
      const response = await fetch('/api/memory', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ command, args }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'API request failed');
      }

      return response.json();
    } catch (error) {
      console.error('Bridge error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async addMemory(content: string, userId: string, metadata?: Record<string, any>): Promise<ApiResponse> {
    if (!content || !userId) {
      throw new Error('Content and userId are required');
    }
    return this.callApi('add', { content, userId, metadata });
  }

  async searchMemories(query: string, userId: string): Promise<ApiResponse> {
    if (!query || !userId) {
      throw new Error('Query and userId are required');
    }
    return this.callApi('search', { query, userId });
  }

  async deleteMemory(userId: string, memoryId: string): Promise<ApiResponse> {
    if (!userId || !memoryId) {
      throw new Error('UserId and memoryId are required');
    }
    return this.callApi('delete', { userId, memoryId });
  }
}