import { Message } from "ai";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Bot, User } from "lucide-react";

interface ChatMessageProps {
  message: Message;
}

export function ChatMessage({ message }: ChatMessageProps) {
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
      <Card className={cn(
        "max-w-[80%] p-4",
        message.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"
      )}>
        {message.content}
      </Card>
      {message.role === "user" && (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary">
          <User className="h-4 w-4 text-primary-foreground" />
        </div>
      )}
    </div>
  );
}