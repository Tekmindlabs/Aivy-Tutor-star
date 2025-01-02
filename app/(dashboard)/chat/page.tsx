"use client";

import { useChat } from "ai/react";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChatMessage } from "@/components/chat/chat-message";

export default function ChatPage() {
  const { messages, input, handleInputChange, handleSubmit, isLoading } = useChat({
    api: "/api/chat",
    onResponse(response) {
      // Scroll to bottom when new message starts
      const chatContainer = document.getElementById('chat-container');
      if (chatContainer) {
        chatContainer.scrollTop = chatContainer.scrollHeight;
      }
    }
  });

  return (
    <div className="container mx-auto max-w-4xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">AI Tutor Chat</h1>
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
              placeholder="Ask your tutor anything..."
              disabled={isLoading}
              className="flex-1"
            />
            <Button type="submit" disabled={isLoading}>
              {isLoading ? (
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  <span>Thinking...</span>
                </div>
              ) : (
                "Send"
              )}
            </Button>
          </form>
        </div>
      </Card>
    </div>
  );
}