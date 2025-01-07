// /lib/ai/memory-aware-agent.ts

import { GoogleGenerativeAI } from '@google/generative-ai';
import { MemoryService, SearchResult } from '../memory/memory-service';
import { MemoryTools } from '../memory/memory-tools';
import { Message } from '@/types/chat';

interface MemoryAgentConfig {
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  memoryLimit?: number;
  googleApiKey?: string;
  modelName?: string;
}

interface MemoryContext {
  recentMemories: SearchResult[];
  relevantMemories: SearchResult[];
}

interface AgentResponse {
  content: string;
  memories?: SearchResult[];
  emotionalState?: string;
  metadata?: Record<string, any>;
}

export class MemoryAwareAgent {
  private genAI: GoogleGenerativeAI;
  private model: any; // Google AI model instance
  private memoryService: MemoryService;
  private memoryTools: MemoryTools;
  private config: MemoryAgentConfig;

  constructor(
    memoryService: MemoryService,
    config: MemoryAgentConfig = {}
  ) {
    if (!config.googleApiKey) {
      throw new Error('Google API key is required');
    }

    this.memoryService = memoryService;
    this.memoryTools = new MemoryTools(memoryService);
    this.config = {
      systemPrompt: config.systemPrompt || DEFAULT_SYSTEM_PROMPT,
      temperature: config.temperature || 0.7,
      maxTokens: config.maxTokens || 1000,
      memoryLimit: config.memoryLimit || 5,
      modelName: config.modelName || 'gemini-pro'
    };

    // Initialize Google AI
    this.genAI = new GoogleGenerativeAI(config.googleApiKey);
    this.model = this.genAI.getGenerativeModel({ 
      model: this.config.modelName ?? 'gemini-pro',
      generationConfig: {
        temperature: this.config.temperature,
        maxOutputTokens: this.config.maxTokens,
      }
    });
  }

  private async retrieveMemoryContext(
    message: string,
    userId: string
  ): Promise<MemoryContext> {
    try {
      const memories = await this.memoryService.searchMemories(
        message,
        userId,
        this.config.memoryLimit
      );

      const recentMemories = memories.slice(0, 3);
      const relevantMemories = memories.filter(m => m.score && m.score > 0.7);

      return {
        recentMemories,
        relevantMemories
      };
    } catch (error) {
      console.error('Error retrieving memory context:', error);
      return {
        recentMemories: [],
        relevantMemories: []
      };
    }
  }

  private buildPromptWithMemories(
    message: string,
    memoryContext: MemoryContext
  ): string {
    let prompt = `${this.config.systemPrompt}\n\n`;
    
    if (memoryContext.relevantMemories.length > 0) {
      prompt += 'Relevant memories:\n';
      memoryContext.relevantMemories.forEach(memory => {
        prompt += `- ${memory.content}\n`;
      });
    }

    if (memoryContext.recentMemories.length > 0) {
      prompt += '\nRecent interactions:\n';
      memoryContext.recentMemories.forEach(memory => {
        prompt += `- ${memory.content}\n`;
      });
    }

    prompt += `\nCurrent message: ${message}`;
    return prompt;
  }

  async processMessage(
    message: Message,
    userId: string
  ): Promise<AgentResponse> {
    try {
      const memoryContext = await this.retrieveMemoryContext(
        message.content,
        userId
      );

      const prompt = this.buildPromptWithMemories(message.content, memoryContext);

      // Generate response using Google AI
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const content = response.text();

      // Store interaction in Mem0
      const memoryResult = await this.memoryService.addMemory({
        userId,
        contentType: 'interaction',
        content: `User: ${message.content}\nAssistant: ${content}`,
        metadata: {
          messageId: message.id,
          timestamp: new Date().toISOString(),
          type: 'conversation'
        }
      });

      return {
        content,
        memories: memoryContext.relevantMemories,
        metadata: {
          memoryId: memoryResult.id,
          memoryContext: {
            recentCount: memoryContext.recentMemories.length,
            relevantCount: memoryContext.relevantMemories.length
          }
        }
      };
    } catch (error) {
      console.error('Error processing message:', error);
      throw error;
    }
  }

  async searchMemories(
    query: string,
    userId: string,
    limit?: number
  ): Promise<SearchResult[]> {
    return this.memoryService.searchMemories(query, userId, limit);
  }
}

const DEFAULT_SYSTEM_PROMPT = `You are an AI assistant with access to past memories and interactions. 
Use these memories to provide more contextual and personalized responses.
When relevant memories are available, incorporate them naturally into your responses.
Always maintain a helpful, friendly, and professional tone.`;

export function createMemoryAwareAgent(
  memoryService: MemoryService,
  config?: MemoryAgentConfig
): MemoryAwareAgent {
  return new MemoryAwareAgent(memoryService, config);
}