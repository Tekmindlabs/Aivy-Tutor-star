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
        // Only include these if you've added them to your schema
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

        const emotionalState = await createEmotionalAgent(model)(initialState);
        const researchState = await createResearcherAgent(model)(emotionalState);
        const validatedState = await createValidatorAgent(model)(researchState);

        const response = await model.generateContent({
          contents: [
            { role: "system", parts: [{ text: userContext }]},
            { role: "system", parts: [{ text: JSON.stringify(validatedState.context.analysis) }]},
            { role: "user", parts: [{ text: messages[messages.length - 1].content }]}
          ],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 1000,
          }
        });

        const result = await response.response;
        const text = result.text();

        // Update chat creation to match your schema
        await prisma.chat.create({
          data: {
            userId: user.id,
            message: messages[messages.length - 1].content,
            response: text,
            // Only include fields that exist in your Chat model
            metadata: {
              emotionalState: validatedState.emotionalState,
              analysis: validatedState.context.analysis
            }
          },
        });

        // Fix handlers calls
        await handlers.handleLLMNewToken(text, {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: text,
          createdAt: new Date().toISOString()
        });

        await handlers.handleLLMEnd({
          id: crypto.randomUUID(),
          role: 'assistant',
          content: text,
          createdAt: new Date().toISOString()
        });
      } catch (error) {
        console.error("Error in chat processing:", error);
        handlers.handleLLMError(error as Error);
      }
    })();

    return new StreamingTextResponse(stream);
  } catch (error) {
    console.error("Error in chat route:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}