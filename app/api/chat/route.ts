import { NextRequest } from "next/server";
import { getSession } from "lib/auth/session";
import { StreamingTextResponse, LangChainStream } from 'ai';
import { prisma } from "lib/prisma";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { 
  createEmotionalAgent, 
  createResearcherAgent, 
  createValidatorAgent,
  AgentState,
  AgentResponse 
} from "lib/ai/agents";

if (!process.env.GOOGLE_AI_API_KEY) {
  throw new Error("GOOGLE_AI_API_KEY is not set");
}

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY);

export async function POST(req: NextRequest) {
  const runId = crypto.randomUUID();
  
  try {
    const session = await getSession();
    if (!session?.user?.email) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { 
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

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

        const timeoutDuration = 60000;
        const withTimeout = <T>(promise: Promise<T>): Promise<T> => {
          return Promise.race([
            promise,
            new Promise<T>((_, reject) => 
              setTimeout(() => reject(new Error('Request timeout')), timeoutDuration)
            )
          ]);
        };

        // Type-safe agent responses
        const emotionalState = await withTimeout(createEmotionalAgent(model)(initialState)) as AgentResponse;
        const researchState = await withTimeout(createResearcherAgent(model)(emotionalState)) as AgentResponse;
        const validatedState = await withTimeout(createValidatorAgent(model)(researchState)) as AgentResponse;

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

      } catch (error) {
        console.error("AI model error:", error);
        return new Response(JSON.stringify({ 
          error: "AI processing error",
          details: error instanceof Error ? error.message : "Unknown error"
        }), { 
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
        const result = response.response;
        const text = result.text();

        // Personalization layer
        const personalizedResponse = await model.generateContent({
          contents: [
            { role: "system", parts: [{ text: `
              Adapt this response for a ${user.learningStyle || 'general'} learner 
              with ${user.difficultyPreference || 'moderate'} difficulty preference.
              Consider their interests: ${user.interests?.join(', ') || 'general topics'}.
              Current emotional state: ${validatedState.emotionalState.mood}, 
              Confidence: ${validatedState.emotionalState.confidence}
            `}]},
            { role: "user", parts: [{ text }]}
          ]
        });

        const finalResponse = personalizedResponse.response.text();

        try {
          await prisma.chat.create({
            data: {
              userId: user.id,
              message: messages[messages.length - 1].content,
              response: finalResponse,
              metadata: {
                emotionalState: validatedState.emotionalState,
                analysis: validatedState.context.analysis,
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

        const messageData = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: finalResponse,
          createdAt: new Date().toISOString()
        };

        await handlers.handleLLMNewToken(finalResponse, messageData, runId);
        await handlers.handleLLMEnd(messageData, runId);

      } catch (error) {
        console.error("Error in chat processing:", error);
        handlers.handleLLMError(error as Error, runId);
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