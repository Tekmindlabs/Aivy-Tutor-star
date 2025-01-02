import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY!);

export async function getAvailableModels() {
  try {
    const models = await genAI.getGenerativeModel({ model: "models" }).generateContent("List available models");
    return models.response.candidates.map(candidate => ({
      id: candidate.model,
      name: candidate.displayName || candidate.model,
      description: candidate.description || "",
      capabilities: candidate.capabilities || []
    }));
  } catch (error) {
    console.error("Error fetching models:", error);
    // Fallback models if API fails
    return [
      { id: "gemini-pro", name: "Gemini Pro", description: "Text generation model" },
      { id: "gemini-pro-vision", name: "Gemini Pro Vision", description: "Multimodal model" }
    ];
  }
}