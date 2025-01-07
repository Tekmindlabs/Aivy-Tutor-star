import { MemoryService, SearchResult } from '../memory/memory-service';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { Message } from '@/types/chat';

interface ReActStep {
  thought: string;
  action: string;
  observation: string;
}

interface TutorResponse {
  success: boolean;
  content: string;
  steps: ReActStep[];
  memories?: SearchResult[];
  error?: string;
}

export class TutorReActAgent {
  private model: any; // GoogleGenerativeAI model instance
  private memoryService: MemoryService;
  private systemPrompt = `You are an AI tutor that uses step-by-step reasoning to help students learn.
    Follow these guidelines:
    1. Break down complex concepts into simpler parts
    2. Use examples to illustrate points
    3. Reference relevant past interactions when helpful
    4. Provide clear explanations
    5. Encourage critical thinking
    
    Format your responses using these steps:
    1. Thought: Analyze what the student needs and how to help
    2. Action: Decide how to respond (explain, give example, ask question, etc.)
    3. Observation: Note the key points to convey
    4. Final Response: Provide the actual tutorial response
    
    Always maintain an encouraging and patient tone.`;

  constructor(apiKey: string, memoryService: MemoryService) {
    const genAI = new GoogleGenerativeAI(apiKey);
    this.model = genAI.getGenerativeModel({ model: 'gemini-pro' });
    this.memoryService = memoryService;
  }

  private async getRelevantMemories(userId: string, query: string): Promise<SearchResult[]> {
    try {
      return await this.memoryService.searchMemories(query, userId, 3);
    } catch (error) {
      console.error('Error retrieving memories:', error);
      return [];
    }
  }

  private buildPrompt(
    userMessage: string,
    memories: SearchResult[],
    previousSteps: ReActStep[] = []
  ): string {
    let prompt = `${this.systemPrompt}\n\nCurrent question: ${userMessage}\n`;

    if (memories.length > 0) {
      prompt += '\nRelevant past interactions:\n';
      memories.forEach((memory, index) => {
        prompt += `${index + 1}. ${memory.content}\n`;
      });
    }

    if (previousSteps.length > 0) {
      prompt += '\nPrevious reasoning steps:\n';
      previousSteps.forEach((step, index) => {
        prompt += `Step ${index + 1}:\nThought: ${step.thought}\nAction: ${step.action}\nObservation: ${step.observation}\n`;
      });
    }

    prompt += '\nProvide your next step in the reasoning process.';
    return prompt;
  }

  private parseStepResponse(response: string): { thought: string; action: string; observation: string } {
    const thoughtMatch = response.match(/Thought:(.*?)(?=Action:|$)/i);
    const actionMatch = response.match(/Action:(.*?)(?=Observation:|$)/i);
    const observationMatch = response.match(/Observation:(.*?)(?=$|\n\n)/i);

    return {
      thought: thoughtMatch?.[1]?.trim() || '',
      action: actionMatch?.[1]?.trim() || '',
      observation: observationMatch?.[1]?.trim() || ''
    };
  }

  private async executeReActStep(prompt: string): Promise<ReActStep> {
    const result = await this.model.generateContent(prompt);
    const response = result.response.text();
    return this.parseStepResponse(response);
  }

  async process(message: Message, userId: string): Promise<TutorResponse> {
    try {
      const steps: ReActStep[] = [];
      const relevantMemories = await this.getRelevantMemories(userId, message.content);
      
      // Execute up to 3 reasoning steps
      for (let i = 0; i < 3; i++) {
        const prompt = this.buildPrompt(message.content, relevantMemories, steps);
        const step = await this.executeReActStep(prompt);
        steps.push(step);

        if (step.observation.includes('FINAL_RESPONSE') || step.observation.includes('COMPLETE')) {
          break;
        }
      }

      // Generate final response
      const finalPrompt = `Based on the following reasoning steps, provide a final tutorial response:
        ${steps.map((step, index) => `
          Step ${index + 1}:
          Thought: ${step.thought}
          Action: ${step.action}
          Observation: ${step.observation}
        `).join('\n')}
        
        Provide the final tutorial response:`;

      const finalResult = await this.model.generateContent(finalPrompt);
      const tutorialResponse = finalResult.response.text();

      // Store the interaction in memory
      await this.memoryService.addMemory({
        userId,
        contentType: 'tutorial',
        content: `Question: ${message.content}\nResponse: ${tutorialResponse}`,
        metadata: {
          type: 'tutorial_interaction',
          steps,
          timestamp: new Date().toISOString()
        }
      });

      return {
        success: true,
        content: tutorialResponse,
        steps,
        memories: relevantMemories
      };

    } catch (error) {
      console.error('Error in TutorReActAgent:', error);
      return {
        success: false,
        content: 'I apologize, but I encountered an error while processing your question.',
        steps: [],
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}

export function createTutorReActAgent(
  apiKey: string,
  memoryService: MemoryService
): TutorReActAgent {
  return new TutorReActAgent(apiKey, memoryService);
}