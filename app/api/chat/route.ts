import { NextRequest } from "next/server";
import { getSession } from "lib/auth/session";
import { StreamingTextResponse, LangChainStream } from 'ai';
import { prisma } from "lib/prisma";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { 
  createEmotionalAgent, 
  createResearcherAgent, 
  createValidatorAgent,
  AgentState 
} from "lib/ai/agents";

if (!process.env.GOOGLE_AI_API_KEY) {
  throw new Error("GOOGLE_AI_API_KEY is not set");
}

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY);

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.user?.email) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { 
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Update select to only include existing fields
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

    // Validate messages
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

    // Start processing in background
    (async () => {
      try {
        const userContext = `User Profile:
          - Age: ${user.age || 'Not specified'}
          - Education Level: ${user.educationLevel || 'Not specified'}
          - Learning Style: ${user.learningStyle || 'Not specified'}
          - Difficulty: ${user.difficultyPreference || 'Not specified'}
          - Interests: ${user.interests?.join(', ') || 'None specified'}`;

        const initialState: AgentState = {
          messages,
          currentStep: "initial",
          emotionalState: { mood: "neutral", confidence: "medium" },
          context: {
            role: "tutor",
            analysis: {},
            recommendations: ""
          }
        };

        // Add timeout handling for agent calls
        const timeoutDuration = 30000; // 30 seconds
        const withTimeout = <T>(promise: Promise<T>) => {
          return Promise.race([
            promise,
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Request timeout')), timeoutDuration)
            )
          ]);
        };

        const emotionalState = await withTimeout(createEmotionalAgent(model)(initialState));
        const researchState = await withTimeout(createResearcherAgent(model)(emotionalState));
        const validatedState = await withTimeout(createValidatorAgent(model)(researchState));

        const response = await withTimeout(model.generateContent({
          contents: [
            { role: "system", parts: [{ text: userContext }]},
            { role: "system", parts: [{ text: JSON.stringify(validatedState.context.analysis) }]},
            { role: "user", parts: [{ text: messages[messages.length - 1].content }]}
          ],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 1000,
          }
        }));

        const result = await response.response;
        const text = result.text();

        // Create chat record with error handling
        try {
          await prisma.chat.create({
            data: {
              userId: user.id,
              message: messages[messages.length - 1].content,
              response: text,
              metadata: {
                emotionalState: validatedState.emotionalState,
                analysis: validatedState.context.analysis
              }
            },
          });
        } catch (dbError) {
          console.error("Error saving chat to database:", dbError);
          // Continue with response even if DB save fails
        }

        // Send response tokens
        const messageData = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: text,
          createdAt: new Date().toISOString()
        };

        await handlers.handleLLMNewToken(text, messageData);
        await handlers.handleLLMEnd(messageData);

      } catch (error) {
        console.error("Error in chat processing:", error);
        handlers.handleLLMError(error as Error);
      }
    })();

    return new StreamingTextResponse(stream);
    
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