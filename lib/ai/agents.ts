import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY!);

export type AgentRole = 'master' | 'emotional' | 'tutor' | 'researcher' | 'validator';

export type AgentState = {
  messages: string[];
  currentStep: string;
  emotionalState: { mood: string; confidence: string }; // More structured emotional state
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

const createEmotionalAgent = (model: any) => async (state: AgentState) => {
  const latestMessage = state.messages[state.messages.length - 1];
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
      mood: analysis.split("and")[0].trim(), // Basic parsing - can be improved with more sophisticated NLP
      confidence: analysis.split("and shows")[1]?.trim() || "uncertain",
    },
    context: {
      ...state.context,
      analysis: { ...state.context.analysis, emotional: analysis },
    }
  };
};

const createResearcherAgent = (model: any) => async (state: AgentState) => {
  const latestMessage = state.messages[state.messages.length - 1];
  const emotionalContext = state.emotionalState.mood;
  const confidenceLevel = state.emotionalState.confidence;

  const result = await model.generateContent(`
    Considering the student's emotional state: "${emotionalContext}" and confidence level: "${confidenceLevel}",
    research educational content for: "${latestMessage}".

    Provide information that is:
    - **Emotionally appropriate:** Tailor the tone (e.g., more encouraging if frustrated, more engaging if bored).
    - **Contextually relevant:** Focus on the specific request.
    - **Actionable:** Include clear steps or suggestions.

    Include:
    - Key learning concepts 📚
    - Helpful, relatable examples ✨ (use emojis sparingly and thoughtfully in examples)
    - Practical practice suggestions 💪
    - Relevant learning resources 📖

    Keep the tone supportive and adapt the complexity based on the student's confidence. Use emojis to enhance engagement but avoid overuse.
  `);

  return {
    ...state,
    context: {
      ...state.context,
      analysis: { ...state.context.analysis, research: result.response.text() },
    }
  };
};

const createValidatorAgent = (model: any) => async (state: AgentState) => {
  const emotionalAnalysis = state.context.analysis?.emotional;
  const researchContent = state.context.analysis?.research;

  const result = await model.generateContent(`
    Review and validate the response considering:
    Emotional state identified: "${emotionalAnalysis}"
    Research content: "${researchContent}"

    Ensure:
    - Content accuracy ✅
    - Emotional appropriateness: Does the research content align with the identified emotion? 🤔
    - Clarity of explanations 🎯
    - Encouraging and supportive tone 🌟
    - **Balanced emoji usage:** Are emojis used effectively to enhance understanding and engagement without being excessive or distracting? Evaluate the number and relevance of emojis. 🧐

    Provide validation feedback, explicitly mentioning if the emotional tone and emoji usage are appropriate. Suggest improvements if needed, using supportive emoji indicators.
  `);

  return {
    ...state,
    context: {
      ...state.context,
      recommendations: result.response.text(),
    }
  };
};

const createMasterAgent = (model: any) => async (state: AgentState) => {
  const emotionalUnderstanding = state.context.analysis?.emotional;
  const educationalContent = state.context.analysis?.research;
  const qualityCheck = state.context.recommendations;

  const result = await model.generateContent(`
    As a caring and supportive tutor, create a response that combines:

    Emotional understanding: "${emotionalUnderstanding}"
    Educational content: "${educationalContent}"
    Quality check feedback: "${qualityCheck}"

    Guidelines:
    - Start with a warm and empathetic greeting 👋 (choose an emoji fitting the student's emotion).
    - Acknowledge the student's likely emotional state directly (e.g., "I see you're feeling a bit confused..."). 💖
    - Present information clearly and concisely 📝, using bullet points or numbered lists where helpful.
    - Use encouraging language and positive reinforcement. ✨
    - Include relevant emojis to enhance engagement and convey emotion, but use them thoughtfully and avoid cluttering the response. Aim for a balanced and natural integration of emojis. 😊👍💡
    - Ensure the emojis directly relate to the content or emotion being conveyed.
    - End with a motivational note and perhaps a question to encourage further interaction.🚀

    Create a response that feels like a supportive friend who's helping them learn and feels understood.
  `);

  return {
    ...state,
    messages: [...state.messages, result.response.text()],
  };
};

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

class AgentGraph {
  private nodes: Map<string, Function>;
  private edges: Map<string, string[]>;
  private entryPoint: string;

  constructor() {
    this.nodes = new Map();
    this.edges = new Map();
    this.entryPoint = '';
  }

  addNode(name: string, fn: Function) {
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

  async execute(initialState: AgentState) {
    let currentNode = this.entryPoint;
    let state = initialState;

    while (currentNode) {
      const nodeFn = this.nodes.get(currentNode);
      if (nodeFn) {
        state = await nodeFn(state);
      }

      const nextNodes = this.edges.get(currentNode) || [];
      currentNode = nextNodes[0];
    }

    return state;
  }
}