import { NextRequest } from "next/server";
import { getSession } from "lib/auth/session";
import { StreamingTextResponse, LangChainStream } from 'ai';
import { prisma } from "lib/prisma";
import { GoogleGenerativeAI } from "@google/generative-ai";

// Validate environment variables
if (!process.env.GOOGLE_AI_API_KEY) {
  throw new Error("GOOGLE_AI_API_KEY is not set");
}

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY);

export async function POST(req: NextRequest) {
  try {
    // 1. Session Validation with detailed error messages
    const session = await getSession();
    if (!session) {
      return new Response(JSON.stringify({ error: "No session found" }), { 
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (!session.user?.email) {
      return new Response(JSON.stringify({ error: "No user email found in session" }), { 
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 2. User Validation
    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    }).catch(error => {
      console.error("Database error:", error);
      throw new Error("Database connection failed");
    });

    if (!user?.id) {
      return new Response(JSON.stringify({ error: "User not found in database" }), { 
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 3. Request Body Validation
    let messages;
    try {
      const body = await req.json();
      messages = body.messages;
    } catch (error) {
      return new Response(JSON.stringify({ error: "Invalid request body" }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 4. Message Processing with Timeout
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error("Request timeout")), 30000)
    );

    const processMessagePromise = async () => {
      const { stream, handlers } = LangChainStream();

      // Start processing in background
      (async () => {
        try {
          const model = genAI.getGenerativeModel({ model: "gemini-pro" });
          const response = await model.generateContent({
            contents: [{ role: "user", parts: [{ text: messages[messages.length - 1].content }]}],
            generationConfig: {
              temperature: 0.7,
              maxOutputTokens: 1000,
            }
          });

          const result = await response.response;
          const text = result.text();

          // Store chat in database
          await prisma.chat.create({
            data: {
              userId: user.id,
              message: messages[messages.length - 1].content,
              response: text,
            },
          });

          // Stream response
          await handlers.handleLLMNewToken(JSON.stringify({
            id: crypto.randomUUID(),
            role: 'assistant',
            content: text,
            createdAt: new Date().toISOString()
          }));

          await handlers.handleLLMEnd();
        } catch (error) {
          console.error("Generation error:", error);
          await handlers.handleLLMError(error as Error);
        }
      })();

      return new StreamingTextResponse(stream);
    };

    // Race between timeout and processing
    return await Promise.race([
      processMessagePromise(),
      timeoutPromise
    ]);

  } catch (error) {
    console.error("API error:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Internal server error",
        details: process.env.NODE_ENV === 'development' ? error : undefined
      }), 
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}