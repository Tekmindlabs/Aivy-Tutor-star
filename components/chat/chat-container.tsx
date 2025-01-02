import React from 'react';
import { useChat } from 'ai/react';
import { ChatMessage } from './chat-message';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { Send } from 'lucide-react';
import { Card } from '../ui/card';

export function ChatContainer() {
  const { messages, input, handleInputChange, handleSubmit, isLoading } = useChat();

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] max-w-4xl mx-auto p-4">
      <Card className="flex-1 overflow-hidden flex flex-col">
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((message) => (
            <ChatMessage 
              key={message.id} 
              message={message}
              isLoading={isLoading && message.role === 'assistant'}
            />
          ))}
        </div>
        
        <form
          onSubmit={handleSubmit}
          className="border-t p-4 flex gap-2 items-center"
        >
          <Input
            value={input}
            onChange={handleInputChange}
            placeholder="Type your message..."
            className="flex-1"
            disabled={isLoading}
          />
          <Button 
            type="submit" 
            size="icon"
            disabled={isLoading || !input.trim()}
          >
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </Card>
    </div>
  );
}

// components/chat/chat-message.tsx
import { Message } from "ai";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Bot, User } from "lucide-react";
import ReactMarkdown from 'react-markdown';

interface ChatMessageProps {
  message: Message;
  isLoading?: boolean;
}

export function ChatMessage({ message, isLoading }: ChatMessageProps) {
  return (
    <div
      className={cn(
        "flex items-start gap-4 p-4",
        message.role === "user" ? "justify-end" : "justify-start"
      )}
    >
      {message.role === "assistant" && (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
          <Bot className="h-4 w-4" />
        </div>
      )}
      <Card 
        className={cn(
          "max-w-[80%] p-4",
          message.role === "user" 
            ? "bg-primary text-primary-foreground" 
            : "bg-muted"
        )}
      >
        <div className="prose dark:prose-invert">
          <ReactMarkdown>
            {message.content}
          </ReactMarkdown>
        </div>
        
        {isLoading && (
          <div className="animate-pulse mt-2">
            <div className="h-4 bg-primary/20 rounded w-3/4" />
          </div>
        )}
      </Card>
      {message.role === "user" && (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary">
          <User className="h-4 w-4 text-primary-foreground" />
        </div>
      )}
    </div>
  );
}