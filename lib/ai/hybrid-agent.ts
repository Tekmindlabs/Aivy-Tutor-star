import { GoogleGenerativeAI } from "@google/generative-ai";
import { createEmotionalAgent } from "./emotional-agent";
import { MemoryService } from "../memory/memory-service";

interface ReActStep {
  thought: string;
  action: string;
  observation: string;
  response?: string;
}

interface HybridState extends AgentState {
  reactSteps: ReActStep[];
  currentStep: string;
  userId: string; // Added for memory management
}

interface Memory {
  id: string;
  content: string;
  emotionalState: any;
  timestamp: string;
  userId: string;
}

// In-memory storage
class MemorySystem {
  private memories: Memory[] = [];

  async addMemory(userId: string, content: string, emotionalState: any): Promise<void> {
    this.memories.push({
      id: crypto.randomUUID(),
      content,
      emotionalState,
      timestamp: new Date().toISOString(),
      userId
    });
  }

  async getRelevantMemories(userId: string, currentContent: string): Promise<Memory[]> {
    return this.memories
      .filter(memory => memory.userId === userId)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 5); // Get 5 most recent memories
  }
}

export const createHybridAgent = (model: any) => {
  const emotionalAgent = createEmotionalAgent(model);
  const memorySystem = new MemorySystem();
  
  const executeReActStep = async (
    step: string, 
    context: any,
    emotionalState: any,
    memories: Memory[]
  ): Promise<ReActStep> => {
    const prompt = `
      As an emotionally intelligent AI tutor:
      
      Current Context:
      - Emotional State: ${emotionalState.mood}
      - Confidence Level: ${emotionalState.confidence}
      - Previous Steps: ${context.reactSteps?.length || 0}
      
      Previous Interactions:
      ${memories.map(m => `- ${m.content} (Emotional State: ${m.emotionalState.mood})`).join('\n')}
      
      Thought Process:
      1. Consider emotional state and learning needs
      2. Review previous interactions and patterns
      3. Plan appropriate response strategy
      4. Evaluate potential impact
      
      Current Step: ${step}
      
      Provide:
      1. Your thought process
      2. Next action to take
      3. What you observe from the results
    `;

    const result = await model.generateContent(prompt);
    const response = result.response.text();
    
    // Parse response into ReAct format
    const [thought, action, observation] = response.split('\n\n');
    
    return {
      thought: thought.replace('Thought: ', ''),
      action: action.replace('Action: ', ''),
      observation: observation.replace('Observation: ', '')
    };
  };

  return {
    process: async (state: HybridState) => {
      try {
        // Step 1: Retrieve relevant memories
        const relevantMemories = await memorySystem.getRelevantMemories(
          state.userId,
          state.messages[state.messages.length - 1]
        );

        // Step 2: Emotional Analysis
        const emotionalAnalysis = await emotionalAgent({
          ...state,
          context: {
            ...state.context,
            previousMemories: relevantMemories
          }
        });
        
        // Step 3: ReAct Planning
        const reactStep = await executeReActStep(
          state.currentStep,
          state,
          emotionalAnalysis.emotionalState,
          relevantMemories
        );
        
        // Step 4: Generate Response
        const response = await model.generateContent({
          contents: [
            { 
              role: "model", 
              parts: [{ text: `
                Using the emotional analysis: ${JSON.stringify(emotionalAnalysis)}
                And reasoning steps: ${JSON.stringify(reactStep)}
                Considering previous interactions: ${JSON.stringify(relevantMemories)}
                Generate a supportive and personalized response.
              `}]
            },
            { 
              role: "user", 
              parts: [{ text: state.messages[state.messages.length - 1] }]
            }
          ]
        });

        // Step 5: Store interaction in memory
        await memorySystem.addMemory(
          state.userId,
          state.messages[state.messages.length - 1],
          emotionalAnalysis.emotionalState
        );

        return {
          ...state,
          emotionalState: emotionalAnalysis.emotionalState,
          reactSteps: [...(state.reactSteps || []), reactStep],
          response: response.response.text(),
          success: true,
          timestamp: new Date().toISOString()
        };
      } catch (error) {
        console.error("Hybrid agent error:", error);
        return {
          ...state,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    }
  };
};