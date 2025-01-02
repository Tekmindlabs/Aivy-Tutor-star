"use client";

import { useChat } from "ai/react";
import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChatMessage } from "@/components/chat/chat-message";
import { useSession } from "next-auth/react";

export default function ChatPage() {
  const { data: session } = useSession();
  const { messages, input, handleInputChange, handleSubmit, isLoading, setMessages } = useChat({
    api: "/api/chat",
    onResponse(response) {
      const chatContainer = document.getElementById('chat-container');
      if (chatContainer) {
        chatContainer.scrollTop = chatContainer.scrollHeight;
      }
    }
  });

  // Function to get greeting based on time of day
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  };

  // Generate initial greeting message
  useEffect(() => {
    if (messages.length === 0 && session?.user?.name) {
      const greeting = getGreeting();
      const initialMessage = {
        id: "initial-greeting",
        role: "assistant",
        content: `${greeting} ${session.user.name}! 👋 How is your day going? I'm your AI Tutor, ready to help you learn and answer any questions you might have. What would you like to learn about today?`
      };
      setMessages([initialMessage]);
    }
  }, [session, setMessages, messages.length]);

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
              Send
            </Button>
          </form>
        </div>
      </Card>
    </div>
  );
}