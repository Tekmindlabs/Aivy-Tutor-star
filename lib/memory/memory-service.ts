import { Memory } from 'mem0';
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

export class MemoryService {
  private mem0: Memory;
  private genAI: GoogleGenerativeAI;
  private model: any;

  constructor() {
    // Initialize Mem0 with configuration
    const config = {
      "llm": {
        "provider": "google",
        "config": {
          "model": "gemini-pro",
          "temperature": 0.1,
          "max_tokens": 2000,
        }
      },
        "embedder": {
          "provider": "jina",
          "config": {
            "apiKey": process.env.JINA_API_KEY,
            "dimensions": process.env.MEMORY_VECTOR_DIMENSIONS || 1024
          }
        },
        "vector_store": {
          "provider": "milvus",
          "config": {
            "collection_name": "aivy_memories",
            "embedding_model_dims": process.env.MEMORY_VECTOR_DIMENSIONS || 1024,
            "address": process.env.MILVUS_ADDRESS,
            "token": process.env.MILVUS_TOKEN
          }
        },
        "custom_prompt": this.getCustomPrompt(),
        "version": "v1.1"
      }

    this.mem0 = Memory.from_config(config);
    this.genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY!);
    this.model = this.genAI.getGenerativeModel({ model: "gemini-pro" });
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
      
      // Generate embedding using Google's embedding model
      const embedding = await getEmbedding(lastMessage.content);

      // Create memory entry
      const memoryEntry: MemoryEntry = {
        id: crypto.randomUUID(),
        messages,
        metadata,
        userId,
        timestamp: new Date()
      };

      // Add to Mem0
      await this.mem0.add(
        lastMessage.content,
        userId,
        {
          ...metadata,
          messageId: memoryEntry.id,
          timestamp: memoryEntry.timestamp
        }
      );

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
      // Search using Mem0
      const mem0Results = await this.mem0.search(query, userId);

      // Search using Milvus
      const embedding = await getEmbedding(query);
      const milvusResults = await searchSimilarContent({
        userId,
        embedding: Array.from(embedding),
        limit,
        contentTypes: ['memory']
      });

      // Combine and deduplicate results
      const combinedResults = new Map<string, MemoryEntry>();

      // Add Mem0 results
      interface Mem0Result {

        metadata?: {
      
          messageId?: string;
      
          messages?: string;
      
          [key: string]: any;
      
        };
      
        user_id: string;
      
        created_at: string;
      
      }
      
      
      mem0Results.results.forEach((result: Mem0Result) => {
        if (result.metadata?.messageId) {
          combinedResults.set(result.metadata.messageId, {
            id: result.metadata.messageId,
            messages: JSON.parse(result.metadata?.messages || '[]'),
            metadata: result.metadata,
            userId: result.user_id,
            timestamp: new Date(result.created_at)
          });
        }
      });

      // Add Milvus results
      milvusResults.forEach((result: VectorResult) => {
        if (!combinedResults.has(result.content_id)) {
          const parsedMetadata = JSON.parse(result.metadata);
          combinedResults.set(result.content_id, {
            id: result.content_id,
            messages: JSON.parse(parsedMetadata.messages),
            metadata: JSON.parse(parsedMetadata.metadata),
            userId: result.user_id,
            timestamp: new Date()
          });
        }
      });

      return Array.from(combinedResults.values())
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
        .slice(0, limit);

    } catch (error) {
      console.error('Error searching memories:', error);
      throw error;
    }
  }

  async deleteMemory(userId: string, memoryId: string): Promise<void> {
    try {
      // Delete from Mem0
      await this.mem0.delete(memoryId, userId);

      // Implementation for deleting from Milvus would go here
      // This would typically involve removing the vector from Milvus
      // and any associated metadata

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