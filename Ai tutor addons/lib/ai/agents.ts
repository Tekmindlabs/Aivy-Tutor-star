import { GoogleGenerativeAI } from "@google/generative-ai";
import { AgentGraph } from "langgraph";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY!);

// Define agent types
type AgentState = {
  messages: string[];
  currentStep: string;
  emotionalState: string;
};

// Create the tutor agent
export const createTutorAgent = async () => {
  const model = genAI.getGenerativeModel({ model: "gemini-pro" });

  const emotionalAnalysis = async (state: AgentState) => {
    const lastMessage = state.messages[state.messages.length - 1];
    const result = await model.generateContent(`
      Analyze the emotional state in this message: "${lastMessage}"
      Provide a brief emotional assessment.
    `);
    return {
      ...state,
      emotionalState: result.response.text(),
    };
  };

  const generateResponse = async (state: AgentState) => {
    const prompt = `
      You are an empathetic AI tutor. Based on the student's emotional state: ${state.emotionalState}
      Respond to: "${state.messages[state.messages.length - 1]}"
      Provide a supportive and educational response.
    `;
    
    const result = await model.generateContent(prompt);
    return {
      ...state,
      messages: [...state.messages, result.response.text()],
    };
  };

  // Create agent workflow
  const workflow = new AgentGraph()
    .addNode("emotional_analysis", emotionalAnalysis)
    .addNode("generate_response", generateResponse)
    .setEntryPoint("emotional_analysis")
    .addEdge("emotional_analysis", "generate_response");

  return workflow;
};