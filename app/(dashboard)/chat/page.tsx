"use client";

import { useEffect, useRef, useState } from "react";
import { useChat } from "ai/react";
import { useSession } from "next-auth/react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChatMessage } from "@/components/chat/chat-message";
import ErrorBoundary from '@/components/ErrorBoundary';
import { toast } from "@/components/ui/use-toast";
import { Message } from "ai";

const RETRY_DELAY = 1000;
const MAX_RETRIES = 3;

interface ValidatedMessage extends Message {
  content: string;
  role: 'user' | 'assistant';
  id: string; // Remove optional modifier to match Message interface
  createdAt: Date; // Change type to Date to match Message interface
}

export default function ChatPage() {
  const { data: session, status } = useSession();
  const scrollRef = useRef<HTMLDivElement>(null);
  const initialMessageSent = useRef(false);
  const [retryCount, setRetryCount] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validateMessage = (message: any): message is ValidatedMessage => {
    return (
      typeof message === 'object' &&
      message !== null &&
      typeof message.content === 'string' &&
      message.content.trim().length > 0 &&
      (message.role === 'user' || message.role === 'assistant')
    );
  };

  const {
    messages,
    input,
    handleInputChange,
    handleSubmit: originalHandleSubmit,
    isLoading,
    error,
    reload,
    setMessages
  } = useChat({
    api: "/api/chat",
    initialMessages: [{
      role: 'assistant',
      content: 'Hello! How can I help you today?',
      id: crypto.randomUUID(),
      createdAt: new Date() // Change from toISOString() to Date object
    }],
    id: session?.user?.email || 'default',
    body: {
      userId: session?.user?.email,
    },
    onError: (error) => {
      console.error("Chat error:", error);
      
      let errorMessage = "Connection interrupted. Please try again.";
  if (error.message.includes("Tensor processing failed")) {
    errorMessage = "Error processing your message. Please try rephrasing.";
  } else if (error.message.includes("unauthorized")) {
        errorMessage = "Session expired. Please log in again.";
      } else if (error.message.includes("Invalid message format")) {
        errorMessage = "Invalid message format. Please try again.";
      }

      toast({
        title: "Chat Error",
        description: errorMessage,
        variant: "destructive",
        duration: 5000,
      });
      setIsSubmitting(false);
    },
    onFinish: () => {
      if (scrollRef.current) {
        scrollRef.current.scrollIntoView({ behavior: 'smooth' });
      }
      setIsSubmitting(false);
    }
  });



const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
  e.preventDefault();
  setIsSubmitting(true);
  
  const MAX_RETRIES = 3;
  const RETRY_DELAY = 1000;

  const trySubmit = async (attempt: number) => {
    try {
      // Save current messages state
      const currentMessages = [...messages];
      
      // Add optimistic message
      const newMessage = {
        id: crypto.randomUUID(),
        content: input,
        role: 'user' as const,
        createdAt: new Date().toISOString(),
      };

      setMessages(prev => [...prev, newMessage]);
      setInput('');

      // Make API call with proper error handling
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [...currentMessages, newMessage],
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(JSON.stringify(errorData));
      }

      // Handle successful response
      const data = response.body;
      if (!data) {
        throw new Error('No response data');
      }

      // Process the stream
      const reader = data.getReader();
      const decoder = new TextDecoder();
      let done = false;

      while (!done) {
        const { value, done: doneReading } = await reader.read();
        done = doneReading;
        const chunkValue = decoder.decode(value);
        if (chunkValue) {
          setMessages(prev => {
            const lastMessage = prev[prev.length - 1];
            if (lastMessage.role === 'assistant') {
              return [
                ...prev.slice(0, -1),
                { ...lastMessage, content: lastMessage.content + chunkValue }
              ];
            }
            return [
              ...prev,
              {
                id: crypto.randomUUID(),
                content: chunkValue,
                role: 'assistant' as const,
                createdAt: new Date().toISOString(),
              }
            ];
          });
        }
      }

      setIsSubmitting(false);

    } catch (error) {
      console.error(`Submit error (attempt ${attempt}):`, error);
      
      if (attempt < MAX_RETRIES) {
        toast({
          title: "Retrying...",
          description: `Attempt ${attempt + 1} of ${MAX_RETRIES}`,
          duration: 2000,
        });
        
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
        return trySubmit(attempt + 1);
      }
      
      toast({
        title: "Error",
        description: "Failed to send message. Please try again later.",
        variant: "destructive",
        duration: 5000,
      });
      
      setIsSubmitting(false);
    }
  };

  await trySubmit(0);
};

  useEffect(() => {
    const scrollContainer = document.getElementById('chat-container');
    if (scrollContainer) {
      scrollContainer.scrollTop = scrollContainer.scrollHeight;
    }
  }, [messages]);

  if (status === "loading") {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="container mx-auto max-w-4xl p-4">
        <Card className="flex h-[600px] flex-col">
          <ScrollArea className="flex-1 p-4" id="chat-container">
            <div className="space-y-4" ref={scrollRef}>
              {messages.map((message, index) => (
                <ChatMessage 
                  key={message.id || index} 
                  message={message}
                  isLoading={isLoading && index === messages.length - 1}
                />
              ))}
              {retryCount > 0 && (
                <div className="text-sm text-gray-500 text-center">
                  Retrying... Attempt {retryCount} of {MAX_RETRIES}
                </div>
              )}
            </div>
          </ScrollArea>

          <div className="border-t p-4">
            <form onSubmit={handleSubmit} className="flex gap-2">
              <Input
                value={input}
                onChange={handleInputChange}
                placeholder="Type your message..."
                disabled={isLoading || isSubmitting}
                className="flex-1"
                autoComplete="off"
                minLength={2}
              />
              <Button 
                type="submit" 
                disabled={isLoading || isSubmitting || !input.trim() || input.length < 2}
                className="bg-blue-500 hover:bg-blue-600 text-white disabled:bg-blue-300"
              >
                {(isLoading || isSubmitting) ? (
                  <div className="flex items-center">
                    <div className="animate-spin mr-2 h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                    Sending...
                  </div>
                ) : (
                  'Send'
                )}
              </Button>
            </form>
          </div>
        </Card>

        {error && (
          <div className="mt-4 p-4 bg-red-50 text-red-600 rounded-md">
            <p className="font-semibold">Error occurred:</p>
            <p>{error.message}</p>
            <Button
              onClick={() => {
                setIsSubmitting(false);
                reload();
              }}
              className="mt-2 text-sm"
              variant="outline"
            >
              Try Again
            </Button>
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
}