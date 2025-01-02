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
  const { data: session } = useSession();
  
  const { messages, input, handleInputChange, handleSubmit, isLoading } = useChat({
    api: "/api/chat",
    initialMessages: [],
    initialInput: "",
    id: session?.user?.email || "default",
    body: {
      messages: []
    },
    onFinish: (message) => {
      console.log("Chat finished:", message);
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

  return (
    <ErrorBoundary>
      <div className="container mx-auto max-w-4xl">
        <div className="mb-8">
          <h1 className="text-2xl font-bold">AI Companion Chat</h1>
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
            </div>
          </ScrollArea>
          <div className="border-t p-4">
            <form onSubmit={handleSubmit} className="flex gap-2">
              <Input
                value={input}
                onChange={handleInputChange}
                placeholder="Ask your AI Companion anything..."
                disabled={isLoading}
                className="flex-1"
              />
              <Button type="submit" disabled={isLoading}>
                Send
              </Button>
            </form>
          </div>
        </Card>
      </div>
    </ErrorBoundary>
  );
}