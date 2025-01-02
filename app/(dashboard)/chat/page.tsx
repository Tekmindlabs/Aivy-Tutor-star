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

  // Enhanced greeting function with more personalization
  const getGreeting = () => {
    const hour = new Date().getHours();
    let timeBasedGreeting = "";
    
    if (hour < 12) timeBasedGreeting = "Good morning";
    else if (hour < 18) timeBasedGreeting = "Good afternoon";
    else timeBasedGreeting = "Good evening";

    const emojis = {
      morning: "🌅",
      afternoon: "☀️",
      evening: "🌙"
    };

    const emoji = hour < 12 ? emojis.morning : hour < 18 ? emojis.afternoon : emojis.evening;
    
    return { timeBasedGreeting, emoji };
  };

  // Generate initial greeting message with enhanced personalization
  useEffect(() => {
    if (messages.length === 0 && session?.user?.name) {
      const { timeBasedGreeting, emoji } = getGreeting();
      const userName = session.user.name.split(' ')[0]; // Get first name
      
      const greetingMessages = [
        `${timeBasedGreeting}, ${userName}! ${emoji}`,
        "I'm Aivy, your personal AI companion here to guide and support you.",
        "What’s on your mind today? Let’s explore together!",
        "Ask me anything—whether it’s learning something new or tackling a tricky question!"
      ];

      const initialMessage = {
        id: "initial-greeting",
        role: "assistant",
        content: greetingMessages.join(" ")
      };

      setMessages([initialMessage]);
    }
  }, [session, setMessages, messages.length]);

  return (
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
  );
}