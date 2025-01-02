import { NextRequest } from "next/server";
import { getSession } from "lib/auth/session";
import { StreamingTextResponse, LangChainStream } from 'ai';
import { prisma } from "lib/prisma";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createHybridAgent } from '@/lib/ai/hybrid-agent';
import { AgentState, ReActStep, EmotionalState } from '@/lib/ai/agents';

if (!process.env.GOOGLE_AI_API_KEY) {
  throw new Error("GOOGLE_AI_API_KEY is not set");
}

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY);

export async function POST(req: NextRequest) {
  const runId = crypto.randomUUID();
  
  try {
    // Session validation and user data retrieval code remains the same...

    const model = genAI.getGenerativeModel({ model: "gemini-pro" });
    const { stream, handlers } = LangChainStream({
      experimental_streamData: true
    });

    try {
      const hybridAgent = createHybridAgent(model);
      
      // Create initial state with required HybridState properties
      const initialState = {
        messages: messages.map(m => m.content),
        currentStep: "initial",
        emotionalState: { 
          mood: "neutral", 
          confidence: "medium" 
        } as EmotionalState,
        context: {
          role: "tutor",
          analysis: {},
          recommendations: ""
        },
        reactSteps: [] as ReActStep[] // Add this to make it compatible with HybridState
      };

      // Process with hybrid agent
      const response = await hybridAgent.process(initialState);

      if (!response.success) {
        throw new Error(response.error || "Processing failed");
      }

      // Personalization layer with correct Gemini API structure
      const personalizedResponse = await model.generateContent({
        role: "user",
        parts: [{
          text: `
            Given this response: "${response.response}"
            
            Please adapt it for a ${user.learningStyle || 'general'} learner 
            with ${user.difficultyPreference || 'moderate'} difficulty preference.
            Consider their interests: ${user.interests?.join(', ') || 'general topics'}.
            Current emotional state: ${response.emotionalState?.mood}, 
            Confidence: ${response.emotionalState?.confidence}
          `
        }]
      });

      const finalResponse = personalizedResponse.response.text();

      // Save to database
      try {
        await prisma.chat.create({
          data: {
            userId: user.id,
            message: messages[messages.length - 1].content,
            response: finalResponse,
            metadata: {
              emotionalState: response.emotionalState,
              reactSteps: response.reactSteps,
              personalization: {
                learningStyle: user.learningStyle,
                difficulty: user.difficultyPreference,
                interests: user.interests
              }
            }
          },
        });
      } catch (dbError) {
        console.error("Error saving chat to database:", dbError);
      }

      // Handle streaming response
      const messageData = {
        id: runId,
        role: 'assistant',
        content: finalResponse,
        createdAt: new Date().toISOString()
      };

      await handlers.handleLLMNewToken(finalResponse);
      await handlers.handleLLMEnd(messageData);

      return new StreamingTextResponse(stream);

    } catch (error) {
      console.error("Error in chat processing:", error);
      handlers.handleLLMError(error as Error);
      return new Response(JSON.stringify({ 
        error: "AI processing error",
        details: error instanceof Error ? error.message : "Unknown error"
      }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

  } catch (error) {
    console.error("Error in request processing:", error);
    return new Response(JSON.stringify({ 
      error: "Request processing error",
      details: error instanceof Error ? error.message : "Unknown error"
    }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}