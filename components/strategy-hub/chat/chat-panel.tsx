"use client";

import { useRef, useEffect, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { Send, Globe, BookOpen, Square, Trash2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useLocalStorageString } from "@/hooks/use-local-storage-string";
import { ModelSelector, type ChatModelId } from "./model-selector";
import { MessageBubble } from "./message-bubble";
import { Badge } from "@/components/ui/badge";
import type { Message } from "@ai-sdk/react";
import { useMapFocusFromChat } from "./use-map-focus-from-chat";

const SUGGESTION_PROMPTS = [
  "Przeczytaj dane projektu i powiedz co warto poprawić w strategii",
  "Zaproponuj 3 cele biznesowe (goals) na najbliższy kwartał",
  "Znajdź w internecie trendy w branży i dostosuj UVP",
  "Przeanalizuj obiekcje klientów i zaproponuj jak je zbijać",
];

interface ChatPanelProps {
  projectId: string;
  projectName: string;
  /**
   * Zewnętrzny "zasiew" wiadomości — gdy zmieni się `nonce`, panel wstawia
   * `text` do inputa, a jeśli `send` jest true — wysyła od razu.
   * Używane przez zakładki Sugestie / Analizy w AI Sidekick.
   */
  seed?: { text: string; send: boolean; nonce: number };
}

export function ChatPanel({ projectId, projectName, seed }: ChatPanelProps) {
  const [model, setModel] = useState<ChatModelId>("claude-sonnet-4-5");
  const [webSearch, setWebSearch] = useState(false);
  const [notionRead, setNotionRead] = useState(false);
  const [aiRules] = useLocalStorageString("strategy-hub-ai-rules");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { messages, input, handleInputChange, handleSubmit, isLoading, error, setMessages, stop, append } =
    useChat({
      api: "/api/strategy-hub/chat",
      body: {
        projectId,
        model,
        tools: { webSearch, notionRead },
        aiRules,
      },
      // Błąd renderowany inline pod wiadomościami (patrz {error && ...} niżej).
    });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useMapFocusFromChat(messages);

  const lastSeedNonce = useRef<number>(0);
  useEffect(() => {
    if (!seed || seed.nonce === 0 || seed.nonce === lastSeedNonce.current) return;
    lastSeedNonce.current = seed.nonce;
    if (seed.send) {
      void append({ role: "user", content: seed.text });
    } else {
      const ev = {
        target: { value: seed.text },
      } as React.ChangeEvent<HTMLTextAreaElement>;
      handleInputChange(ev);
      setTimeout(() => textareaRef.current?.focus(), 0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed?.nonce]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (input.trim() && !isLoading) {
        handleSubmit(e as unknown as React.FormEvent<HTMLFormElement>);
      }
    }
  };

  const handleSuggestion = (text: string) => {
    const syntheticEvent = {
      target: { value: text },
    } as React.ChangeEvent<HTMLTextAreaElement>;
    handleInputChange(syntheticEvent);
    setTimeout(() => textareaRef.current?.focus(), 0);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border/60 bg-card/30 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <div className="text-sm font-medium text-foreground truncate">
            AI Chat
          </div>
          <span className="text-muted-foreground/40 text-xs">·</span>
          <span className="text-xs text-muted-foreground truncate">{projectName}</span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Web search toggle */}
          <button
            type="button"
            onClick={() => setWebSearch((v) => !v)}
            aria-pressed={webSearch}
            aria-label={webSearch ? "Wyłącz wyszukiwanie internetu" : "Włącz wyszukiwanie internetu"}
            className={cn(
              "flex items-center gap-1.5 h-7 px-2 rounded-md text-xs border transition-colors",
              webSearch
                ? "bg-violet-500/15 text-violet-400 border-violet-500/30 hover:bg-violet-500/20"
                : "text-muted-foreground border-border/50 hover:border-border hover:text-foreground"
            )}
          >
            <Globe className="size-3" />
            <span>Web</span>
          </button>

          {/* Notion toggle */}
          <button
            type="button"
            onClick={() => setNotionRead((v) => !v)}
            aria-pressed={notionRead}
            aria-label={notionRead ? "Wyłącz czytanie Notion" : "Włącz czytanie Notion"}
            className={cn(
              "flex items-center gap-1.5 h-7 px-2 rounded-md text-xs border transition-colors",
              notionRead
                ? "bg-orange-500/15 text-orange-400 border-orange-500/30 hover:bg-orange-500/20"
                : "text-muted-foreground border-border/50 hover:border-border hover:text-foreground"
            )}
          >
            <BookOpen className="size-3" />
            <span>Notion</span>
          </button>

          <ModelSelector value={model} onChange={setModel} disabled={isLoading} />

          {messages.length > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-7"
              onClick={() => setMessages([])}
              aria-label="Wyczyść rozmowę"
              title="Wyczyść rozmowę"
            >
              <Trash2 className="size-3.5 text-muted-foreground" />
            </Button>
          )}
        </div>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-6 py-12">
            <div className="text-center space-y-2">
              <div className="size-12 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center mx-auto">
                <Globe className="size-5 text-violet-400" />
              </div>
              <h2 className="text-base font-semibold text-foreground">
                Asystent AI Strategy Hub
              </h2>
              <p className="text-sm text-muted-foreground max-w-sm">
                Czyta i edytuje Twój projekt, przeszukuje internet,
                analizuje dane. Zapytaj o cokolwiek.
              </p>
            </div>

            {/* Active capabilities */}
            <div className="flex items-center gap-2 flex-wrap justify-center">
              <Badge variant="outline" className="text-xs border-sky-500/30 text-sky-400 bg-sky-500/10">
                Czyta projekt
              </Badge>
              <Badge variant="outline" className="text-xs border-sky-500/30 text-sky-400 bg-sky-500/10">
                Edytuje strategię
              </Badge>
              {webSearch && (
                <Badge variant="outline" className="text-xs border-violet-500/30 text-violet-400 bg-violet-500/10">
                  Web search
                </Badge>
              )}
              {notionRead && (
                <Badge variant="outline" className="text-xs border-orange-500/30 text-orange-400 bg-orange-500/10">
                  Notion
                </Badge>
              )}
            </div>

            {/* Suggestions */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-lg">
              {SUGGESTION_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => handleSuggestion(prompt)}
                  className="text-left px-3 py-2.5 rounded-lg border border-border/60 bg-card/50 hover:bg-card hover:border-border transition-colors text-xs text-muted-foreground hover:text-foreground"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg: Message) => (
          <MessageBubble key={msg.id} message={msg} projectId={projectId} />
        ))}

        {isLoading && messages[messages.length - 1]?.role === "user" && (
          <div className="flex gap-3 px-1">
            <div className="size-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 bg-violet-500/10 border border-violet-500/20">
              <span className="size-3 rounded-full border border-violet-400 border-t-transparent animate-spin" />
            </div>
            <div className="flex items-center gap-1 pt-2">
              <span className="size-1.5 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:0ms]" />
              <span className="size-1.5 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:150ms]" />
              <span className="size-1.5 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:300ms]" />
            </div>
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2 p-3 rounded-lg border border-destructive/30 bg-destructive/10 text-destructive text-sm">
            <AlertCircle className="size-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">Błąd połączenia</p>
              <p className="text-xs mt-0.5 opacity-80">{error.message}</p>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="shrink-0 px-4 py-3 border-t border-border/60 bg-card/20">
        <form onSubmit={handleSubmit} className="flex gap-2 items-end">
          <div className="flex-1 relative">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="Napisz wiadomość… (Enter aby wysłać, Shift+Enter nowa linia)"
              className="min-h-11 max-h-40 resize-none py-2.5 pr-3 text-sm leading-relaxed"
              rows={1}
              disabled={isLoading}
              aria-label="Wiadomość do AI"
            />
          </div>

          {isLoading ? (
            <Button
              type="button"
              size="icon"
              variant="outline"
              className="size-11 shrink-0"
              onClick={stop}
              aria-label="Zatrzymaj generowanie"
            >
              <Square className="size-4 fill-current" />
            </Button>
          ) : (
            <Button
              type="submit"
              size="icon"
              className="size-11 shrink-0 bg-brand hover:bg-brand/90"
              disabled={!input.trim()}
              aria-label="Wyślij wiadomość"
            >
              <Send className="size-4" />
            </Button>
          )}
        </form>
        <p className="text-[10px] text-muted-foreground/50 mt-1.5 text-center">
          AI może popełniać błędy. Sprawdź ważne informacje.
        </p>
      </div>
    </div>
  );
}
