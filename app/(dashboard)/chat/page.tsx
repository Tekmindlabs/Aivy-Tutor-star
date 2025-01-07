// app/(dashboard)/chat/page.tsx
'use client';

import { useEffect, useRef, useState } from "react";
import { Message } from "@/types/chat";
import { useSession } from "next-auth/react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChatMessage } from "@/components/chat/chat-message";
import ErrorBoundary from '@/components/ErrorBoundary';
import { toast } from "@/components/ui/use-toast";
import { motion, AnimatePresence } from 'framer-motion';
import { TutorReActAgent, createTutorReActAgent } from '@/lib/ai/reActAgent';
import { MemoryService } from '@/lib/memory/memory-service';

interface ValidatedMessage extends Message {
  reactSteps?: any[];
}

export default function ChatPage() {
  const { data: session, status } = useSession();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [messages, setMessages] = useState<ValidatedMessage[]>([{
    role: 'assistant',
    content: 'Hello! How can I help you today?',
    id: crypto.randomUUID(),
    createdAt: new Date()
  }]);
  const [input, setInput] = useState('');
  const [agent, setAgent] = useState<TutorReActAgent | null>(null);

  // Initialize the agent with existing MemoryService
  useEffect(() => {
    if (session?.user?.email) {
      const memoryService = new MemoryService();
      const newAgent = createTutorReActAgent(
        process.env.NEXT_PUBLIC_GEMINI_API_KEY!, 
        memoryService
      );
      setAgent(newAgent);
    }
  }, [session?.user?.email]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
  };

  const handleChatError = (error: Error): void => {
    console.error("Chat error:", error);
    toast({
      title: "Chat Error",
      description: error.message || "An error occurred while processing your message.",
      variant: "destructive",
      duration: 5000,
    });
    setIsSubmitting(false);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!agent || !input.trim() || isSubmitting || !session?.user?.email) return;

    setIsSubmitting(true);
    
    try {
      // Create user message
      const userMessage: ValidatedMessage = {
        id: crypto.randomUUID(),
        content: input.trim(),
        role: 'user',
        createdAt: new Date()
      };
      
      setMessages(prev => [...prev, userMessage]);
      setInput('');

      // Process with ReAct agent
      const response = await agent.process(userMessage, session.user.email);

      if (response.success) {
        const assistantMessage: ValidatedMessage = {
          id: crypto.randomUUID(),
          content: response.content,
          role: 'assistant',
          createdAt: new Date(),
          reactSteps: response.steps
        };

        setMessages(prev => [...prev, assistantMessage]);
      } else {
        throw new Error(response.error || 'Failed to process message');
      }

    } catch (error) {
      handleChatError(error instanceof Error ? error : new Error('Unknown error'));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: 'smooth' });
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
          <ScrollArea className="flex-1 p-4">
            <AnimatePresence>
              <div className="space-y-4">
                {messages.map((message) => (
                  <motion.div
                    key={message.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.3 }}
                  >
                    <ChatMessage 
                      message={message}
                      isLoading={isSubmitting && message === messages[messages.length - 1]}
                    />
                  </motion.div>
                ))}
                <div ref={scrollRef} />
              </div>
            </AnimatePresence>
          </ScrollArea>

          <div className="border-t p-4">
            <form onSubmit={handleSubmit} className="flex gap-2">
              <Input
                value={input}
                onChange={handleInputChange}
                placeholder="Type your message..."
                disabled={isSubmitting || !agent}
                className="flex-1"
                autoComplete="off"
                minLength={2}
              />
              <Button 
                type="submit" 
                disabled={isSubmitting || !input.trim() || !agent || input.length < 2}
                className="bg-blue-500 hover:bg-blue-600 text-white disabled:bg-blue-300"
              >
                {isSubmitting ? (
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
      </div>
    </ErrorBoundary>
  );
}