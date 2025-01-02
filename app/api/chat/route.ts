import { NextRequest } from "next/server";
import { getSession } from "lib/auth/session";
import { StreamingTextResponse, LangChainStream } from 'ai';
import { prisma } from "lib/prisma";
import { GoogleGenerativeAI } from "@google/generative-ai";

// Verify API key
if (!process.env.GOOGLE_AI_API_KEY) {
  throw new Error("GOOGLE_AI_API_KEY is not set");
}

interface ChatCompletionMessage {
  content: string;
  role: 'user' | 'assistant' | 'system';
}

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY);

const getGreeting = (userName: string) => {
  const hour = new Date().getHours();
  let timeBasedGreeting = "";
  
  if (hour < 12) timeBasedGreeting = "Good morning";
  else if (hour < 18) timeBasedGreeting = "Good afternoon";
  else timeBasedGreeting = "Good evening";

  const emoji = hour < 12 ? "🌅" : hour < 18 ? "☀️" : "🌙";
  
  const greetingParts = [
    `${timeBasedGreeting}, ${userName}! ${emoji}`,
    "I'm Aivy, your personal AI companion here to guide and support you.",
    "What's on your mind today? Let's explore together!",
    "Ask me anything—whether it's learning something new or tackling a tricky question!"
  ];

  return {
    role: 'assistant',
    content: greetingParts.join(" ")
  };
};

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    console.log("Session data:", session);

    if (!session?.user?.email) {
      console.error("No session or user found");
      return new Response("Unauthorized", { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    });

    if (!user?.id) {
      return new Response("User not found", { status: 404 });
    }

    const { messages }: { messages: ChatCompletionMessage[] } = await req.json();
    
    // For initial greeting
    if (!messages?.length) {
      const userName = session.user.name 
        ? session.user.name.split(' ')[0]
        : session.user.email?.split('@')[0] 
        ?? 'there';
      
      const greetingMessage = getGreeting(userName);
      
      try {
        const chatRecord = await prisma.chat.create({
          data: {
            userId: user.id,
            message: "Initial greeting",
            response: greetingMessage.content,
          },
        });

        return new Response(
          JSON.stringify({
            id: chatRecord.id,
            role: "assistant",
            content: greetingMessage.content,
          }),
          { 
            headers: { 'Content-Type': 'application/json' }
          }
        );
      } catch (error) {
        console.error("Error storing greeting:", error);
        return new Response("Failed to store greeting", { status: 500 });
      }
    }

    const lastMessage = messages[messages.length - 1].content;
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

        // Format the stream chunks properly
        const chunks = text.split(' ').map(word => ({
          id: crypto.randomUUID(),
          role: 'assistant',
          content: word + ' ',
          createdAt: new Date().toISOString()
        }));

        for (const chunk of chunks) {
          await handlers.handleLLMNewToken(JSON.stringify(chunk));
        }

        // Update chat record
        await prisma.chat.update({
          where: { id: chat.id },
          data: { response: text },
        });

        await handlers.handleLLMEnd();
      } catch (error) {
        console.error("Generation error:", error);
        await handlers.handleLLMError(error as Error);
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