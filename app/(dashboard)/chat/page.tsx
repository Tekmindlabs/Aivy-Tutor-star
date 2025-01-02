"use client";

import { useEffect, useRef } from "react";
import { useChat } from "ai/react";
import { useSession } from "next-auth/react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChatMessage } from "@/components/chat/chat-message";
import ErrorBoundary from '@/components/ErrorBoundary';
import { toast } from "@/components/ui/use-toast";

export default function ChatPage() {
  const { data: session, status } = useSession();
  const scrollRef = useRef<HTMLDivElement>(null);

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
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    const scrollContainer = document.getElementById('chat-container');
    if (scrollContainer) {
      scrollContainer.scrollTop = scrollContainer.scrollHeight;
    }
  }, [messages]);

  // Initial greeting
  useEffect(() => {
    if (messages.length === 0 && !isLoading && session?.user) {
      handleSubmit(new Event('submit') as any);
    }
  }, [messages.length, isLoading, handleSubmit, session]);

  // Loading state
  if (status === "loading") {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <div className="text-red-500 mb-4">Error: {error.message}</div>
        <Button 
          onClick={() => window.location.reload()}
          variant="outline"
          className="hover:bg-red-50"
        >
          Try Again
        </Button>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="container mx-auto max-w-4xl p-4">
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
            <div className="space-y-4" ref={scrollRef}>
              {messages.map((message, index) => (
                <ChatMessage 
                  key={message.id || index} 
                  message={message}
                  isLoading={isLoading && index === messages.length - 1}
                />
              ))}
              {isLoading && messages.length === 0 && (
                <div className="flex justify-center">
                  <div className="animate-pulse">Thinking...</div>
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
                autoFocus
              />
              <Button 
                type="submit" 
                disabled={isLoading || !input.trim()}
                className="bg-blue-500 hover:bg-blue-600 text-white disabled:bg-blue-300"
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

        {messages.length > 0 && (
          <div className="mt-4 flex justify-end">
            <Button
              variant="outline"
              onClick={() => window.location.reload()}
              className="text-sm hover:bg-gray-100"
            >
              Clear Chat
            </Button>
          </div>
        )}

        {/* Optional: Add a typing indicator */}
        {isLoading && (
          <div className="text-sm text-gray-500 mt-2 text-center">
            AI is typing...
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
}