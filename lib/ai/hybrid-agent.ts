import { GoogleGenerativeAI } from "@google/generative-ai";

interface ReActStep {
  thought: string;
  action: string;
  observation: string;
  response?: string;
}

interface HybridState extends AgentState {
  reactSteps: ReActStep[];
  currentStep: string;
}

export const createHybridAgent = (model: any) => {
  const emotionalAgent = createEmotionalAgent(model);
  
  const executeReActStep = async (
    step: string, 
    context: any,
    emotionalState: any
  ): Promise<ReActStep> => {
    const prompt = `
      As an emotionally intelligent AI tutor:
      
      Current Context:
      - Emotional State: ${emotionalState.mood}
      - Confidence Level: ${emotionalState.confidence}
      - Previous Steps: ${context.reactSteps?.length || 0}
      
      Thought Process:
      1. Consider emotional state and learning needs
      2. Plan appropriate response strategy
      3. Evaluate potential impact
      
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
        // Step 1: Emotional Analysis
        const emotionalAnalysis = await emotionalAgent(state);
        
        // Step 2: ReAct Planning
        const reactStep = await executeReActStep(
          state.currentStep,
          state,
          emotionalAnalysis.emotionalState
        );
        
        // Step 3: Generate Response
        const response = await model.generateContent({
          contents: [
            { 
              role: "model", 
              parts: [{ text: `
                Using the emotional analysis: ${JSON.stringify(emotionalAnalysis)}
                And reasoning steps: ${JSON.stringify(reactStep)}
                Generate a supportive and personalized response.
              `}]
            },
            { 
              role: "user", 
              parts: [{ text: state.messages[state.messages.length - 1] }]
            }
          ]
        });

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