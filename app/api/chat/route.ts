import { NextRequest } from "next/server";
import { getSession } from "lib/auth/session";
import { StreamingTextResponse, LangChainStream } from 'ai';
import { prisma } from "lib/prisma";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createHybridAgent } from '@/lib/ai/hybrid-agent';

if (!process.env.GOOGLE_AI_API_KEY) {
  throw new Error("GOOGLE_AI_API_KEY is not set");
}

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY);

export async function POST(req: NextRequest) {
  const runId = crypto.randomUUID();
  
  try {
    // Session validation
    const session = await getSession();
    if (!session?.user?.email) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { 
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // User data retrieval
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: {
        id: true,
        age: true,
        interests: true,
        educationLevel: true,
        learningStyle: true,
        difficultyPreference: true,
      }
    });

    if (!user?.id) {
      return new Response(JSON.stringify({ error: "User not found" }), { 
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const { messages } = await req.json();

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: "Invalid messages format" }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const model = genAI.getGenerativeModel({ model: "gemini-pro" });
    const { stream, handlers } = LangChainStream({
      experimental_streamData: true
    });

    try {
      const hybridAgent = createHybridAgent(model);
      
      // Process with hybrid agent
      const response = await hybridAgent.process({
        messages,
        currentStep: "initial",
        reactSteps: [],
        emotionalState: { 
          mood: "neutral", 
          confidence: "medium" 
        },
        context: {
          role: "tutor",
          analysis: {},
          recommendations: ""
        }
      });

      // Personalization layer
      const personalizedResponse = await model.generateContent({
        contents: [
          { 
            role: "model", 
            parts: [{ text: `
              Adapt this response for a ${user.learningStyle || 'general'} learner 
              with ${user.difficultyPreference || 'moderate'} difficulty preference.
              Consider their interests: ${user.interests?.join(', ') || 'general topics'}.
              Current emotional state: ${response.emotionalState.mood}, 
              Confidence: ${response.emotionalState.confidence}
            `}]
          },
          { role: "user", parts: [{ text: response.response }]}
        ]
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
        id: crypto.randomUUID(),
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
    console.error("Error in chat route:", error);
    return new Response(JSON.stringify({ 
      error: "Internal server error",
      details: error instanceof Error ? error.message : "Unknown error"
    }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}