import { NextRequest } from "next/server";
import { auth } from "@/auth"; // Updated to use auth instead of getSession
import { StreamingTextResponse, LangChainStream } from 'ai';
import { prisma } from "@/lib/prisma";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createHybridAgent, HybridState } from '@/lib/ai/hybrid-agent';
import { AgentState, ReActStep, EmotionalState } from '@/lib/ai/agents';
import { Message } from '@/types/chat';
import { MemoryService } from '@/lib/memory/memory-service';
import { EmbeddingModel } from '@/lib/knowledge/embeddings';

// Type definitions remain the same
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
  [key: string]: any;
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

// Process steps for better error tracking
const STEPS = {
  INIT: 'Initializing request',
  AUTH: 'Authenticating user',
  PROCESS: 'Processing messages',
  EMBED: 'Generating embeddings',
  AGENT: 'Processing with hybrid agent',
  RESPONSE: 'Generating response',
  STREAM: 'Streaming response'
};

if (!process.env.GOOGLE_AI_API_KEY) {
  throw new Error("GOOGLE_AI_API_KEY is not set");
}

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY);

export async function POST(req: NextRequest) {
  const runId = crypto.randomUUID();
  let currentStep = STEPS.INIT;
  
  try {
    // Authentication
    currentStep = STEPS.AUTH;
    const session = await auth();
    if (!session?.user?.id) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }), 
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Message validation
    const { messages }: { messages: Message[] } = await req.json();
    if (!messages?.length || !messages[messages.length - 1]?.content) {
      return new Response(
        JSON.stringify({ error: "Invalid message format - content is required" }), 
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Get user data
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
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const model = genAI.getGenerativeModel({ model: "gemini-pro" });
    const { stream, handlers } = LangChainStream({
      experimental_streamData: true
    });

    // Initialize services
    currentStep = STEPS.PROCESS;
    const memoryService = new MemoryService();
    const hybridAgent = createHybridAgent(model, memoryService);

    // Process messages
    const processedMessages = messages.map(msg => ({
      ...msg,
      content: msg.content.trim()
    }));

    // Generate embeddings
    currentStep = STEPS.EMBED;
    const lastMessage = processedMessages[processedMessages.length - 1];
    const { data, dimensions } = await EmbeddingModel.generateEmbedding(lastMessage.content);
    const embedding = Array.from(data);
    
    const processedTensors = {
      embedding,
      input_ids: new Float32Array(dimensions),
      attention_mask: new Float32Array(dimensions).fill(1),
      token_type_ids: new Float32Array(dimensions).fill(0)
    };

    // Process with hybrid agent
    currentStep = STEPS.AGENT;
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

    const response = await hybridAgent.process(initialState);
    if (!response.success) {
      throw new Error(response.error || "Processing failed");
    }

    // Parallel operations for better performance
    currentStep = STEPS.RESPONSE;
    const [personalizedResponse, memoryResult] = await Promise.all([
      model.generateContent({
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
      }),
      memoryService.addMemory(
        processedMessages,
        user.id,
        {
          emotionalState: response.emotionalState,
          learningStyle: user.learningStyle,
          difficultyPreference: user.difficultyPreference,
          interests: user.interests
        }
      )
    ]);

    const finalResponse = personalizedResponse.response.text();

    // Store chat in database without blocking
    const dbOperation = prisma.chat.create({
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
    }).catch(dbError => {
      console.error("Error saving chat to database:", dbError);
    });

    // Stream response
    currentStep = STEPS.STREAM;
    try {
      const messageData = {
        id: runId,
        role: 'assistant' as const,
        content: finalResponse,
        createdAt: new Date().toISOString()
      };

      await handlers.handleLLMNewToken(finalResponse);
      await handlers.handleLLMEnd(messageData, runId);

      return new StreamingTextResponse(stream);
    } catch (streamError) {
      console.error("Streaming error:", streamError);
      throw new Error("Failed to stream response");
    }

  } catch (error) {
    console.error(`Failed at step: ${currentStep}`, error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        details: `Failed during ${currentStep}`,
        stack: error instanceof Error ? error.stack : undefined
      }),
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}