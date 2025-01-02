import { Message } from "ai";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Bot, User } from "lucide-react";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import 'highlight.js/styles/github-dark.css';

interface ChatMessageProps {
  message: Message;
  isLoading?: boolean;
}

interface CodeProps {
  className?: string;
  children: React.ReactNode;
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
          message.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"
        )}
      >
        <div className="prose dark:prose-invert max-w-none">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[rehypeHighlight]}
            components={{
              code: ({ className, children }: CodeProps) => {
                const isInline = !className;
                return (
                  <code
                    className={cn(
                      "bg-secondary/50 rounded px-1.5 py-0.5",
                      isInline ? "text-sm" : "block p-4 text-sm"
                    )}
                  >
                    {children}
                  </code>
                );
              },
            }}
          >
            {message.content}
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

      {message.role === "user" && (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary">
          <User className="h-4 w-4 text-primary-foreground" />
        </div>
      )}
    </div>
  );
}