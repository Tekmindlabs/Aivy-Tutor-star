import { StructuredTool } from 'langchain/tools';
import { z } from 'zod';
import { MemoryService } from './memory-service';

export class MemoryTools {
  constructor(private memoryService: MemoryService) {}

  createAddMemoryTool() {
    return new StructuredTool({
      name: 'add_memory',
      description: 'Add new messages to memory with associated metadata',
      schema: z.object({
        messages: z.array(z.object({
          content: z.string(),
          role: z.enum(['user', 'assistant'])
        })),
        userId: z.string(),
        metadata: z.record(z.any()).optional()
      }),
      func: async ({ messages, userId, metadata }) => {
        return await this.memoryService.addMemory(messages, userId, metadata);
      }
    });
  }

  createSearchMemoryTool() {
    return new StructuredTool({
      name: 'search_memory',
      description: 'Search through memories with a query',
      schema: z.object({
        query: z.string(),
        userId: z.string(),
        limit: z.number().optional()
      }),
      func: async ({ query, userId, limit }) => {
        return await this.memoryService.searchMemories(query, userId, limit);
      }
    });
  }
}