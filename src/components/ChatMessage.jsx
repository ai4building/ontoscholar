import { Bot, User } from "lucide-react";
import { cn } from "@/lib/utils";

export default function ChatMessage({ role, content, pending }) {
  const isUser = role === "user";

  return (
    <div className={cn("flex gap-3 px-4 sm:px-6", isUser && "flex-row-reverse")}>
      <div
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border",
          isUser
            ? "border-border bg-background text-foreground"
            : "border-transparent bg-foreground text-background"
        )}
      >
        {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </div>
      <div
        className={cn(
          "max-w-[78%] rounded-2xl px-4 py-3 text-sm leading-relaxed",
          isUser
            ? "bg-foreground text-background rounded-tr-sm"
            : "bg-muted text-foreground rounded-tl-sm"
        )}
      >
        {pending ? (
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-2 animate-bounce rounded-full bg-current [animation-delay:-0.3s]" />
            <span className="h-2 w-2 animate-bounce rounded-full bg-current [animation-delay:-0.15s]" />
            <span className="h-2 w-2 animate-bounce rounded-full bg-current" />
          </span>
        ) : (
          <p className="whitespace-pre-wrap break-words">{content}</p>
        )}
      </div>
    </div>
  );
}