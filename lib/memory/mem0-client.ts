// /lib/memory/mem0-client.ts

import { Mem0Bridge } from './bridge';

export interface Mem0Client {
  add(content: string, userId: string, metadata?: Record<string, any>): Promise<any>;
  search(query: string, userId: string, limit?: number): Promise<any>;
  delete(userId: string, memoryId: string): Promise<any>;
}

class DefaultMem0Client implements Mem0Client {
  private bridge: Mem0Bridge;

  constructor() {
    this.bridge = new Mem0Bridge();
  }

  async add(content: string, userId: string, metadata?: Record<string, any>) {
    try {
      return await this.bridge.addMemory(content, userId, metadata);
    } catch (error) {
      console.error('Error adding memory:', error);
      throw error;
    }
  }

  async search(query: string, userId: string, limit: number = 10) {
    try {
      return await this.bridge.searchMemories(query, userId, limit);
    } catch (error) {
      console.error('Error searching memories:', error);
      throw error;
    }
  }

  async delete(userId: string, memoryId: string) {
    try {
      return await this.bridge.deleteMemory(userId, memoryId);
    } catch (error) {
      console.error('Error deleting memory:', error);
      throw error;
    }
  }
}

let mem0Client: Mem0Client | null = null;

export function getMem0Client(): Mem0Client {
  if (!mem0Client) {
    mem0Client = new DefaultMem0Client();
  }
  return mem0Client;
}