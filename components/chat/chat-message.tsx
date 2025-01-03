import { Message } from "ai";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Bot, User } from "lucide-react";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import 'highlight.js/styles/github-dark.css';
import React, { useEffect, useState } from 'react';

interface ReActStep {
  thought: string;
  action: string;
  observation: string;
}

interface EnhancedMessage extends Message {
  reactSteps?: ReActStep[];
}

interface ChatMessageProps {
  message: EnhancedMessage;
  isLoading?: boolean;
}

interface CodeProps {
  className?: string;
  children?: React.ReactNode;
  [key: string]: any; // Allow for additional props
}

export function ChatMessage({ message, isLoading }: ChatMessageProps) {
  const [formattedContent, setFormattedContent] = useState('');

  useEffect(() => {
    if (typeof message.content === 'string') {
      try {
        // Split content by JSON objects and process each
        const parts = message.content.match(/\{[^}]+\}/g) || [message.content];
        const processedContent = parts.map(part => {
          try {
            const parsed = JSON.parse(part);
            return parsed.content || '';
          } catch {
            return part;
          }
        }).join('');
        
        setFormattedContent(processedContent);
      } catch {
        setFormattedContent(message.content);
      }
    }
  }, [message.content]);

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

      <div className="flex flex-col gap-2 max-w-[80%]">
        {message.reactSteps && (
          <div className="text-sm text-muted-foreground bg-muted/50 rounded-md p-2 mb-2">
            <div className="font-semibold mb-1">Reasoning Steps:</div>
            {message.reactSteps.map((step, index) => (
              <div key={index} className="mb-2">
                <div className="text-primary">Thought: {step.thought}</div>
                <div className="text-success">Action: {step.action}</div>
                <div className="text-info">Observation: {step.observation}</div>
              </div>
            ))}
          </div>
        )}
        
        <Card
          className={cn(
            "p-4",
            message.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"
          )}
        >
          <div className="prose dark:prose-invert max-w-none">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeHighlight]}
              components={{
                code: ({ className, children, ...props }: CodeProps) => {
                  const isInline = !className;
                  return (
                    <code
                      className={cn(
                        "bg-secondary/50 rounded px-1.5 py-0.5",
                        isInline ? "text-sm" : "block p-4 text-sm"
                      )}
                      {...props}
                    >
                      {children}
                    </code>
                  );
                },
              }}
            >
              {formattedContent}
            </ReactMarkdown>
          </div>

          {isLoading && (
            <div className="mt-2 flex gap-1">
              <span className="h-2 w-2 animate-bounce rounded-full bg-primary/40 delay-0" />
              <span className="h-2 w-2 animate-bounce rounded-full bg-primary/40 delay-150" />
              <span className="h-2 w-2 animate-bounce rounded-full bg-primary/40 delay-300" />
            </div>
          )}
        </Card>
      </div>

      {message.role === "user" && (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary">
          <User className="h-4 w-4 text-primary-foreground" />
        </div>
      )}
    </div>
  );
}