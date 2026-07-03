"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";
import { Sparkles, User } from "lucide-react";
import { ToolCallCard } from "./tool-call-card";
import type { Message } from "@ai-sdk/react";

interface MessageBubbleProps {
  message: Message;
  projectId: string;
}

export function MessageBubble({ message, projectId }: MessageBubbleProps) {
  const isUser = message.role === "user";
  const isAssistant = message.role === "assistant";

  if (!isUser && !isAssistant) return null;

  const hasParts = Array.isArray((message as { parts?: unknown }).parts);
  const parts = hasParts
    ? ((message as { parts: unknown[] }).parts ?? [])
    : [{ type: "text", text: message.content as string }];

  return (
    <div
      className={cn(
        "flex gap-3 px-1",
        isUser ? "flex-row-reverse" : "flex-row"
      )}
    >
      <div
        className={cn(
          "size-7 rounded-full flex items-center justify-center shrink-0 mt-0.5",
          isUser
            ? "bg-brand/20 border border-brand/30"
            : "bg-violet-500/10 border border-violet-500/20"
        )}
      >
        {isUser ? (
          <User className="size-3.5 text-brand" />
        ) : (
          <Sparkles className="size-3.5 text-violet-400" />
        )}
      </div>

      <div
        className={cn(
          "flex-1 min-w-0 max-w-[85%]",
          isUser ? "flex justify-end" : ""
        )}
      >
        {isUser ? (
          <div className="inline-block px-3.5 py-2.5 rounded-2xl rounded-tr-sm bg-brand text-white text-sm leading-relaxed">
            {typeof message.content === "string" ? message.content : null}
          </div>
        ) : (
          <div className="space-y-1">
            {parts.map((part, i) => {
              const p = part as { type: string; text?: string; toolName?: string; args?: Record<string, unknown>; result?: unknown; state?: string };

              if (p.type === "text" && p.text) {
                return (
                  <div
                    key={i}
                    className="prose prose-sm prose-invert max-w-none text-foreground/90 [&>*:first-child]:mt-0 [&>*:last-child]:mb-0"
                  >
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {p.text}
                    </ReactMarkdown>
                  </div>
                );
              }

              if (p.type === "tool-invocation" && p.toolName) {
                return (
                  <ToolCallCard
                    key={i}
                    toolName={p.toolName}
                    args={p.args}
                    result={p.result}
                    state={(p.state ?? "result") as "call" | "result" | "partial-call"}
                    projectId={projectId}
                  />
                );
              }

              return null;
            })}
          </div>
        )}
      </div>
    </div>
  );
}
