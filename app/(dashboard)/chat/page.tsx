"use client";

import { useEffect } from "react";
import { useChat } from "ai/react";
import { useSession } from "next-auth/react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChatMessage } from "@/components/chat/chat-message";
import ErrorBoundary from '@/components/ErrorBoundary';

export default function ChatPage() {
  const { data: session, status } = useSession();

  const { messages, input, handleInputChange, handleSubmit, isLoading, error } = useChat({
    api: "/api/chat",
    initialMessages: [],
    initialInput: "",
    id: session?.user?.email || "default",
    body: {
      messages: []
    },
    onError: (error) => {
      console.error("Chat error:", error);
    }
  });

  useEffect(() => {
    if (messages.length === 0 && !isLoading) {
      handleSubmit(new Event('submit') as any);
    }
  }, [messages.length, isLoading, handleSubmit]);

  // Add loading state handling
  if (status === "loading") {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  // Add error state handling
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <div className="text-red-500 mb-4">Error: {error.message}</div>
        <Button onClick={() => window.location.reload()}>
          Try Again
        </Button>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="container mx-auto max-w-4xl">
        <div className="mb-8">
          <h1 className="text-2xl font-bold">AI Companion Chat</h1>
          {session?.user?.name && (
            <p className="text-gray-600">
              Welcome back, {session.user.name}
            </p>
          )}
        </div>
        
        <Card className="flex h-[600px] flex-col">
          <ScrollArea className="flex-1 p-4" id="chat-container">
            <div className="space-y-4">
              {messages.map((message, index) => (
                <ChatMessage 
                  key={message.id} 
                  message={message}
                  isLoading={isLoading && index === messages.length - 1}
                />
              ))}
              {isLoading && messages.length === 0 && (
                <div className="flex justify-center">
                  <div className="animate-pulse">Loading...</div>
                </div>
              )}
            </div>
          </ScrollArea>

          <div className="border-t p-4">
            <form 
              onSubmit={handleSubmit} 
              className="flex gap-2"
            >
              <Input
                value={input}
                onChange={handleInputChange}
                placeholder="Ask your AI Companion anything..."
                disabled={isLoading}
                className="flex-1"
                autoComplete="off"
              />
              <Button 
                type="submit" 
                disabled={isLoading || !input.trim()}
                className="bg-blue-500 hover:bg-blue-600 text-white"
              >
                {isLoading ? (
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

        {/* Optional: Add a clear chat button */}
        {messages.length > 0 && (
          <div className="mt-4 flex justify-end">
            <Button
              variant="outline"
              onClick={() => window.location.reload()}
              className="text-sm"
            >
              Clear Chat
            </Button>
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
}