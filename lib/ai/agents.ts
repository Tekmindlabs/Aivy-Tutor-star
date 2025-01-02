import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY!);

export type AgentRole = 'master' | 'emotional' | 'tutor' | 'researcher' | 'validator';

export type AgentState = {
  messages: string[];
  currentStep: string;
  emotionalState: { mood: string; confidence: string };
  context: {
    role: AgentRole;
    analysis: {
      emotional?: string;
      research?: string;
      validation?: string;
    };
    recommendations?: string;
  };
};

export interface AgentResponse extends AgentState {
  success: boolean;
  timestamp: string;
  metadata?: {
    processingTime?: number;
    confidence?: number;
    source?: string;
    error?: string; // Added error property
  };
}

export const createEmotionalAgent = (model: any) => async (state: AgentState): Promise<AgentResponse> => {
  const startTime = Date.now();
  const latestMessage = state.messages[state.messages.length - 1];

  try {
    const result = await model.generateContent(`
      Analyze the emotional state and learning mindset of the student based on this message:
      "${latestMessage}"

      Consider these nuanced emotional states (choose the most fitting):
      - Joyful 😄
      - Curious 🤔
      - Confused 😕
      - Frustrated 😠
      - Anxious 😟
      - Engaged 🤓
      - Unmotivated 😴
      - Excited 🎉
      - Uncertain 🤷‍♀️

      Also, determine the student's confidence level regarding the topic (high, medium, low).

      Respond concisely with the identified emotion and a brief indication of confidence, using a maximum of two relevant emojis.

      Example format: "The student seems [emotion] [emoji] and shows [confidence] confidence [emoji]."
    `);

    const analysis = result.response.text();

    return {
      ...state,
      emotionalState: {
        mood: analysis.split("and")[0].trim(),
        confidence: analysis.split("and shows")[1]?.trim() || "uncertain",
      },
      context: {
        ...state.context,
        analysis: { ...state.context.analysis, emotional: analysis },
      },
      success: true,
      timestamp: new Date().toISOString(),
      metadata: {
        processingTime: Date.now() - startTime,
        confidence: 0.8,
        source: 'emotional-agent'
      }
    };
  } catch (error) {
    console.error("Emotional agent error:", error);
    return {
      ...state,
      success: false,
      timestamp: new Date().toISOString(),
      metadata: {
        processingTime: Date.now() - startTime,
        confidence: 0,
        source: 'emotional-agent',
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    };
  }
};

export const createResearcherAgent = (model: any) => async (state: AgentState): Promise<AgentResponse> => {
  const startTime = Date.now();
  const latestMessage = state.messages[state.messages.length - 1];
  const emotionalContext = state.emotionalState.mood;
  const confidenceLevel = state.emotionalState.confidence;

  try {
    const result = await model.generateContent(`
      Considering the student's emotional state: "${emotionalContext}" and confidence level: "${confidenceLevel}",
      research educational content for: "${latestMessage}".

      Provide information that is:
      - **Emotionally appropriate:** Tailor the tone (e.g., more encouraging if frustrated, more engaging if bored).
      - **Contextually relevant:** Focus on the specific request.
      - **Actionable:** Include clear steps or suggestions.

      Include:
      - Key learning concepts 📚
      - Helpful, relatable examples ✨
      - Practical practice suggestions 💪
      - Relevant learning resources 📖

      Keep the tone supportive and adapt the complexity based on the student's confidence.
    `);

    return {
      ...state,
      context: {
        ...state.context,
        analysis: { ...state.context.analysis, research: result.response.text() },
      },
      success: true,
      timestamp: new Date().toISOString(),
      metadata: {
        processingTime: Date.now() - startTime,
        confidence: 0.9,
        source: 'researcher-agent'
      }
    };
  } catch (error) {
    console.error("Researcher agent error:", error);
    return {
      ...state,
      success: false,
      timestamp: new Date().toISOString(),
      metadata: {
        processingTime: Date.now() - startTime,
        confidence: 0,
        source: 'researcher-agent',
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    };
  }
};

export const createValidatorAgent = (model: any) => async (state: AgentState): Promise<AgentResponse> => {
  const startTime = Date.now();
  const emotionalAnalysis = state.context.analysis?.emotional;
  const researchContent = state.context.analysis?.research;

  try {
    const result = await model.generateContent(`
      Review and validate the response considering:
      Emotional state identified: "${emotionalAnalysis}"
      Research content: "${researchContent}"

      Ensure:
      - Content accuracy ✅
      - Emotional appropriateness 🤔
      - Clarity of explanations 🎯
      - Encouraging and supportive tone 🌟
      - Balanced emoji usage 🧐

      Provide validation feedback with suggestions for improvements if needed.
    `);

    return {
      ...state,
      context: {
        ...state.context,
        recommendations: result.response.text(),
      },
      success: true,
      timestamp: new Date().toISOString(),
      metadata: {
        processingTime: Date.now() - startTime,
        confidence: 0.95,
        source: 'validator-agent'
      }
    };
  } catch (error) {
    console.error("Validator agent error:", error);
    return {
      ...state,
      success: false,
      timestamp: new Date().toISOString(),
      metadata: {
        processingTime: Date.now() - startTime,
        confidence: 0,
        source: 'validator-agent',
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    };
  }
};

export const createMasterAgent = (model: any) => async (state: AgentState): Promise<AgentResponse> => {
  const startTime = Date.now();
  const emotionalUnderstanding = state.context.analysis?.emotional;
  const educationalContent = state.context.analysis?.research;
  const qualityCheck = state.context.recommendations;

  try {
    const result = await model.generateContent(`
      As a caring and supportive tutor, create a response that combines:

      Emotional understanding: "${emotionalUnderstanding}"
      Educational content: "${educationalContent}"
      Quality check feedback: "${qualityCheck}"

      Guidelines:
      - Start with a warm and empathetic greeting 👋
      - Acknowledge the student's emotional state
      - Present information clearly and concisely 📝
      - Use encouraging language ✨
      - Include relevant emojis thoughtfully
      - End with a motivational note 🚀

      Create a response that feels like a supportive friend who's helping them learn.
    `);

    return {
      ...state,
      messages: [...state.messages, result.response.text()],
      success: true,
      timestamp: new Date().toISOString(),
      metadata: {
        processingTime: Date.now() - startTime,
        confidence: 0.95,
        source: 'master-agent'
      }
    };
  } catch (error) {
    console.error("Master agent error:", error);
    return {
      ...state,
      success: false,
      timestamp: new Date().toISOString(),
      metadata: {
        processingTime: Date.now() - startTime,
        confidence: 0,
        source: 'master-agent',
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    };
  }
};

class AgentGraph {
  private nodes: Map<string, (state: AgentState) => Promise<AgentResponse>>;
  private edges: Map<string, string[]>;
  private entryPoint: string;

  constructor() {
    this.nodes = new Map();
    this.edges = new Map();
    this.entryPoint = '';
  }

  addNode(name: string, fn: (state: AgentState) => Promise<AgentResponse>) {
    this.nodes.set(name, fn);
    return this;
  }

  addEdge(from: string, to: string) {
    if (!this.edges.has(from)) {
      this.edges.set(from, []);
    }
    this.edges.get(from)?.push(to);
    return this;
  }

  setEntryPoint(name: string) {
    this.entryPoint = name;
    return this;
  }

  async execute(initialState: AgentState): Promise<AgentResponse> {
    let currentNode = this.entryPoint;
    let state = initialState;

    try {
      while (currentNode) {
        const nodeFn = this.nodes.get(currentNode);
        if (nodeFn) {
          const response = await nodeFn(state);
          state = response;
          if (!state.success) {
            throw new Error(`Agent ${currentNode} failed`);
          }
        }

        const nextNodes = this.edges.get(currentNode) || [];
        currentNode = nextNodes[0];
      }

      return state;
    } catch (error) {
      console.error("Agent graph execution error:", error);
      return {
        ...state,
        success: false,
        timestamp: new Date().toISOString(),
        metadata: {
          error: error instanceof Error ? error.message : 'Unknown error',
          source: 'agent-graph'
        }
      };
    }
  }
}

export const createOrchestrationAgent = async () => {
  const model = genAI.getGenerativeModel({ model: "gemini-pro" });

  const workflow = new AgentGraph()
    .addNode("emotional_analysis", createEmotionalAgent(model))
    .addNode("research", createResearcherAgent(model))
    .addNode("validation", createValidatorAgent(model))
    .addNode("master", createMasterAgent(model))
    .setEntryPoint("emotional_analysis")
    .addEdge("emotional_analysis", "research")
    .addEdge("research", "validation")
    .addEdge("validation", "master");

  return workflow;
};