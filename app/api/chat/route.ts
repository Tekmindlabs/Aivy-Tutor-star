import { NextRequest, NextResponse } from "next/server";
import { getSession } from "lib/auth/session";
import { StreamingTextResponse, LangChainStream } from 'ai';
import { prisma } from "lib/prisma";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createHybridAgent, HybridState } from '@/lib/ai/hybrid-agent'; // Added HybridState import
import { AgentState, ReActStep, EmotionalState } from '@/lib/ai/agents';
import { Message } from '@/types/chat';
import { MemoryService } from '@/lib/memory/memory-service';
import { getEmbedding } from "@/lib/knowledge/embeddings";

// Type definitions
interface SuccessResponse {
  success: true;
  emotionalState: EmotionalState;
  reactSteps: ReActStep[];
  response: string;
  timestamp: string;
  currentStep: string;
  userId: string;
}

interface ErrorResponse {
  success: false;
  error: string;
  reactSteps: ReActStep[];
  currentStep: string;
  userId: string;
}

type AgentResponse = SuccessResponse | ErrorResponse;

interface ChatMetadata {
  [key: string]: any; // Add index signature
  emotionalState: EmotionalState | null;
  reactSteps: Array<{
    thought: string;
    action: string;
    observation: string;
    response?: string;
  }>;
  personalization: {
    learningStyle: string | null;
    difficulty: string | null;
    interests: string[];
  };
}

if (!process.env.GOOGLE_AI_API_KEY) {
  throw new Error("GOOGLE_AI_API_KEY is not set");
}

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY);

export async function POST(req: NextRequest) {
  const runId = crypto.randomUUID();
  
  try {
    const session = await getSession();
    if (!session?.user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }), 
        { status: 401 }
      );
    }

    const { messages }: { messages: Message[] } = await req.json();
    if (!messages?.length || !messages[messages.length - 1]?.content) {
      return new Response(
        JSON.stringify({ error: "Invalid message format - content is required" }), 
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        learningStyle: true,
        difficultyPreference: true,
        interests: true
      }
    });

    if (!user) {
      return new Response(
        JSON.stringify({ error: "User not found" }), 
        { status: 404 }
      );
    }

    const model = genAI.getGenerativeModel({ model: "gemini-pro" });
    const { stream, handlers } = LangChainStream({
      experimental_streamData: true
    });

    try {
      const memoryService = new MemoryService();
      const hybridAgent = createHybridAgent(model, memoryService);

      // Clean and process messages
      const processedMessages = messages.map(msg => ({
        ...msg,
        content: msg.content.trim()
      }));

      // Generate embedding for the last message
      const lastMessage = processedMessages[processedMessages.length - 1];
let processedTensors;
try {
  const { data, dimensions } = await EmbeddingModel.generateEmbedding(lastMessage.content);
  
  // Convert BigInt64Array to Float32Array
  const convertedData = Array.from(data).map(Number);
  
  processedTensors = {
    embedding: convertedData,
    input_ids: new Float32Array(convertedData),
    attention_mask: new Float32Array(dimensions).fill(1),
    token_type_ids: new Float32Array(dimensions).fill(0)
  };

} catch (error) {
  console.error("Error:", error instanceof Error ? error.message : String(error));
  throw new Error(`Embedding generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
}

      // Create initial state for hybrid agent
      const initialState: HybridState = {
        userId: user.id,
        messages: processedMessages,
        currentStep: "initial",
        emotionalState: {
          mood: "neutral",
          confidence: "medium"
        },
        context: {
          role: "tutor",
          analysis: {},
          recommendations: ""
        },
        reactSteps: [],
        processedTensors
      };

      // Process with hybrid agent
      const response = await hybridAgent.process(initialState);

      if (!response.success) {
        throw new Error(response.error || "Processing failed");
      }

      // Store interaction in memory
      await memoryService.addMemory(
        processedMessages,
        user.id,
        {
          emotionalState: response.emotionalState,
          learningStyle: user.learningStyle,
          difficultyPreference: user.difficultyPreference,
          interests: user.interests
        }
      );

      // Generate personalized response
      const prompt = {
        contents: [{
          role: 'user',
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
        }]
      };

      const personalizedResponse = await model.generateContent(prompt);
      const finalResponse = personalizedResponse.response.text();

      // Store chat in database
      try {
        await prisma.chat.create({
          data: {
            userId: user.id,
            message: lastMessage.content,
            response: finalResponse,
            metadata: {
              emotionalState: response.emotionalState || null,
              reactSteps: response.reactSteps?.map(step => ({
                thought: step.thought,
                action: step.action,
                observation: step.observation,
                response: step.response
              })) || [],
              personalization: {
                learningStyle: user.learningStyle || null,
                difficulty: user.difficultyPreference || null,
                interests: user.interests || []
              }
            } as ChatMetadata,
          },
        });
      } catch (dbError) {
        console.error("Error saving chat to database:", dbError);
      }

      // Stream response
      const messageData = {
        id: runId,
        role: 'assistant' as const,
        content: finalResponse,
        createdAt: new Date().toISOString()
      };

      await handlers.handleLLMNewToken(finalResponse);
      await handlers.handleLLMEnd(messageData, runId);

      return new StreamingTextResponse(stream);

    } catch (error) {
      console.error("Error in chat processing:", error);
      return new Response(
        JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
          details: "Failed during tensor processing or agent execution"
        }),
        { 
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

  } catch (error) {
    console.error("Error in request processing:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        details: "Failed during request processing"
      }),
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}