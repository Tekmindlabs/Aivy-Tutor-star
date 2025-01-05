import { Mem0Bridge } from './bridge';
import { Message } from '@/types/chat';
import { VectorResult } from '@/lib/knowledge/types';
import { getEmbedding } from '@/lib/knowledge/embeddings';
import { insertVector, searchSimilarContent } from '@/lib/milvus/vectors';
import { GoogleGenerativeAI } from "@google/generative-ai";

interface MemoryEntry {
  id: string;
  messages: Message[];
  metadata: Record<string, any>;
  userId: string;
  timestamp: Date;
}

interface Mem0Result {
  metadata?: {      
    messageId?: string;    
    messages?: string;   
    [key: string]: any;      
  };     
  user_id: string;     
  created_at: string;     
}

export class MemoryService {
  private mem0Bridge: Mem0Bridge;
  private genAI: GoogleGenerativeAI;
  private model: any;

  constructor() {
    // Initialize Mem0Bridge instead of direct Memory
    this.mem0Bridge = new Mem0Bridge();
    this.genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY!);
    this.model = this.genAI.getGenerativeModel({ model: "gemini-pro" });
  }

  // Add the new utility methods here, after constructor
  private parseJSON(str: string, defaultValue: any = null): any {
    try {
      return JSON.parse(str);
    } catch (e) {
      console.error('JSON parse error:', e);
      return defaultValue;
    }
  }

  private validateMemoryEntry(entry: MemoryEntry): boolean {
    return !!(
      entry.id &&
      Array.isArray(entry.messages) &&
      entry.userId &&
      entry.timestamp instanceof Date
    );
  }

  private getCustomPrompt(): string {
    return `
    Please extract key information from the interaction that includes:
    - User's emotional state and mood
    - Personal interests and preferences
    - Current concerns or challenges
    - Communication style
    - Social context and needs
    - Goals and aspirations
    
    Example:
    Input: "I've been feeling overwhelmed lately with work, and I prefer having someone to talk to about my day. I really enjoy photography but haven't had time for it."
    Output: {
      "facts": [
        "Emotional state: overwhelmed",
        "Communication preference: conversational",
        "Personal interest: photography",
        "Challenge: work-life balance",
        "Social need: seeking emotional support",
        "Context: work stress"
      ]
    }
    
    Additional context to extract:
    - Long-term patterns in user's behavior
    - Preferred interaction style
    - Support preferences
    - Personal values and beliefs
    - Daily routines and habits
    
    Return the facts in JSON format as shown above.
    `;
  }

  async addMemory(
    messages: Message[], 
    userId: string, 
    metadata: Record<string, any> = {}
  ): Promise<MemoryEntry> {
    try {
      console.log('Starting memory addition process:', {
        userId,
        messageCount: messages.length,
        metadataKeys: Object.keys(metadata)
      });
  
      const lastMessage = messages[messages.length - 1];
      
      // Generate embedding
      const embedding = await getEmbedding(lastMessage.content);
  
      // Create memory entry
      const memoryEntry: MemoryEntry = {
        id: crypto.randomUUID(),
        messages,
        metadata,
        userId,
        timestamp: new Date()
      };
  
      // Add to Mem0Bridge
      const mem0Result = await this.mem0Bridge.addMemory(
        lastMessage.content,
        userId,
        {
          ...metadata,
          messageId: memoryEntry.id,
          timestamp: memoryEntry.timestamp.toISOString(),
          messages: JSON.stringify(messages)
        }
      );
  
      if (!mem0Result || !mem0Result.success) {
        throw new Error('Failed to add memory to Mem0Bridge');
      }
  
      // Store in Milvus
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
  
      console.log('Memory added successfully:', {
        id: memoryEntry.id,
        userId,
        timestamp: memoryEntry.timestamp
      });
  
      return memoryEntry;
  
    } catch (error) {
      console.error('Error adding memory:', error);
      throw error;
    }
  }

  async searchMemories(
    query: string,
    userId: string,
    limit: number = 5
  ): Promise<MemoryEntry[]> {
    try {
      console.log('Starting memory search:', { query, userId, limit });
  
      // Search using Mem0Bridge
      const mem0Results = await this.mem0Bridge.searchMemories(query, userId, limit);
  
      // Search using Milvus
      const embedding = await getEmbedding(query);
      const milvusResults = await searchSimilarContent({
        userId,
        embedding: Array.from(embedding),
        limit,
        contentTypes: ['memory']
      });
  
      // Initialize combined results map
      const combinedResults = new Map<string, MemoryEntry>();
  
      // Process Mem0Bridge results
      if (mem0Results && mem0Results.success && Array.isArray(mem0Results.results)) {
        mem0Results.results.forEach((result: Mem0Result) => {
          if (result.metadata?.messageId) {
            try {
              combinedResults.set(result.metadata.messageId, {
                id: result.metadata.messageId,
                messages: JSON.parse(result.metadata.messages || '[]'),
                metadata: result.metadata,
                userId: result.user_id,
                timestamp: new Date(result.created_at)
              });
            } catch (e) {
              console.error('Error parsing Mem0 result:', e);
            }
          }
        });
      }
  
      // Process Milvus results
      if (Array.isArray(milvusResults)) {
        milvusResults.forEach((result: VectorResult) => {
          if (!combinedResults.has(result.content_id)) {
            try {
              const parsedMetadata = JSON.parse(result.metadata || '{}');
              combinedResults.set(result.content_id, {
                id: result.content_id,
                messages: JSON.parse(parsedMetadata.messages || '[]'),
                metadata: JSON.parse(parsedMetadata.metadata || '{}'),
                userId: result.user_id,
                timestamp: new Date()
              });
            } catch (e) {
              console.error('Error parsing Milvus result:', e);
            }
          }
        });
      }
  
      // Convert to array, sort, and limit results
      const results = Array.from(combinedResults.values())
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
        .slice(0, limit);
  
      console.log(`Found ${results.length} memories`);
      return results;
  
    } catch (error) {
      console.error('Error searching memories:', error);
      return []; // Return empty array instead of throwing
    }
  }

  async deleteMemory(userId: string, memoryId: string) {
  try {
    const deleteResult = await this.mem0Bridge.deleteMemory(userId, memoryId); // Using the new public method

    if (!deleteResult || !deleteResult.success) {
      throw new Error('Failed to delete memory from Mem0Bridge');
    }

    // Delete from Milvus
    // TODO: Implement Milvus deletion
    // await deleteMilvusVector(memoryId);

    console.log('Memory deleted successfully:', {
      userId,
      memoryId,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error deleting memory:', error);
    throw error;
  }
}
}