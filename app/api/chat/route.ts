import { NextRequest } from "next/server";
import { getSession } from "lib/auth/session";
import { StreamingTextResponse, LangChainStream } from 'ai';
import { prisma } from "lib/prisma";
import { GoogleGenerativeAI } from "@google/generative-ai";

// Message type definition
interface ChatCompletionMessage {
  content: string;
  role: 'user' | 'assistant' | 'system';
}

// Initialize Google AI
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY!);

export async function POST(req: NextRequest) {
  try {
    // Authentication
    const session = await getSession();
    if (!session?.user?.email) {
      return new Response("Unauthorized", { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    });

    if (!user?.id) {
      return new Response("User not found", { status: 404 });
    }

    // Parse request
    const { messages }: { messages: ChatCompletionMessage[] } = await req.json();
    
    if (!messages?.length) {
      return new Response("No messages provided", { status: 400 });
    }

    const lastMessage = messages[messages.length - 1].content;
    
    // Setup streaming
    const { stream, handlers } = LangChainStream();

    // Create chat record
    const chat = await prisma.chat.create({
      data: {
        userId: user.id,
        message: lastMessage,
        response: "",
      },
    });

    // Process in background
    (async () => {
      try {
        const model = genAI.getGenerativeModel({ model: "gemini-pro" });

        const response = await model.generateContent({
          contents: [{ role: "user", parts: [{ text: lastMessage }]}],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 1000,
          }
        });

        const result = await response.response;
        const text = result.text();

        // Stream response in chunks
        const chunks = text.split(/(\n\n|\n(?=[#-]))/);
        for (const chunk of chunks) {
          if (chunk.trim()) {
            await handlers.handleLLMNewToken(chunk);
          }
        }

        // Update chat record with complete response
        await prisma.chat.update({
          where: { id: chat.id },
          data: { response: text },
        });

        await handlers.handleLLMEnd();

      } catch (error) {
        console.error("Generation error:", error);
        
        const errorMessage = error instanceof Error 
          ? `Error: ${error.message}`
          : "An unexpected error occurred";

        await handlers.handleLLMNewToken(errorMessage);
        await handlers.handleLLMEnd();

        await prisma.chat.update({
          where: { id: chat.id },
          data: { response: errorMessage },
        });
      }
    })();

    return new StreamingTextResponse(stream);
    
  } catch (error) {
    console.error("API error:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Internal server error" 
      }), 
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.user?.email) {
      return new Response("Unauthorized", { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: {
        chats: {
          orderBy: { createdAt: 'desc' },
          take: 50,
        },
      },
    });

    if (!user) {
      return new Response("User not found", { status: 404 });
    }

    return new Response(
      JSON.stringify({ chats: user.chats }), 
      { 
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error("Get chats error:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Internal server error" 
      }), 
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}