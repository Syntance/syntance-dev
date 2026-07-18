"use client";

import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { ListItemsEditor } from "@/components/strategy-hub/list-items-editor";
import { Sparkles, Loader2, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { emitToast } from "@/lib/strategy-hub/toast";

interface UvpEditorProps {
  /** Markdown / plain text — jedno zdanie pozycjonowania. */
  core: string;
  /** JSON-string serializowanej listy StrategyListItem[] (lub legacy markdown). */
  valueAdds: string;
  onSaveCore: (markdown: string) => Promise<void>;
  onSaveValueAdds: (markdown: string) => Promise<void>;
  placeholder?: string;
  emptyHint?: string;
  accent?: "violet" | "amber" | "rose";
}

const DEBOUNCE_MS = 600;

export function UvpEditor({
  core,
  valueAdds,
  onSaveCore,
  onSaveValueAdds,
  placeholder = "np. jedyny sklep z darmową personalizacją w 24h",
  emptyHint,
  accent = "amber",
}: UvpEditorProps) {
  const [coreLocal, setCoreLocal] = useState(core);
  const [coreState, setCoreState] = useState<"idle" | "saving" | "saved">("idle");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Sync z propem `core` bez efektu (React 19): wzorzec „poprzedni prop" — reset
  // podczas renderu, gdy wartość ze źródła się zmieniła.
  const [prevCore, setPrevCore] = useState(core);
  if (core !== prevCore) {
    setPrevCore(core);
    setCoreLocal(core);
  }

  const syncHeight = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${el.scrollHeight}px`;
  }, []);

  useLayoutEffect(() => {
    syncHeight();
  }, [coreLocal, syncHeight]);

  const handleCoreChange = (value: string) => {
    setCoreLocal(value);
    setCoreState("saving");
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        await onSaveCore(value);
        setCoreState("saved");
        setTimeout(() => setCoreState("idle"), 1500);
      } catch {
        emitToast("Nie udało się zapisać UVP.");
        setCoreState("idle");
      }
    }, DEBOUNCE_MS);
  };

  return (
    <div className="flex flex-col">
      {/* ── Core UVP — jedno zdanie ──────────────────────────────── */}
      <section className="border-b border-border">
        <header className="flex items-center gap-2 px-5 pt-4 pb-2">
          <Sparkles className="size-3.5 text-amber-400" aria-hidden />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Core UVP
          </h3>
          <span className="text-[11px] text-muted-foreground/60 ml-1">
            jedno zdanie
          </span>
          <div className="ml-auto">
            {coreState === "saving" && (
              <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                <Loader2 className="size-3 animate-spin" />
                Zapisywanie…
              </span>
            )}
            {coreState === "saved" && (
              <span className="inline-flex items-center gap-1 text-[11px] text-success">
                <Check className="size-3" />
                Zapisano
              </span>
            )}
          </div>
        </header>
        <div className="px-5 pb-4">
          <textarea
            ref={textareaRef}
            value={coreLocal}
            onChange={(e) => handleCoreChange(e.target.value)}
            onInput={syncHeight}
            placeholder={placeholder}
            aria-label="Core UVP — jedno zdanie pozycjonowania"
            rows={1}
            className={cn(
              "w-full bg-transparent resize-none overflow-hidden",
              "text-base leading-relaxed text-foreground",
              "outline-none border-none placeholder:text-muted-foreground/50",
              "field-sizing-content"
            )}
          />
        </div>
      </section>

      {/* ── Value adds — lista ───────────────────────────────────── */}
      <section className="flex-1">
        <header className="flex items-center gap-2 px-5 pt-4 pb-1">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Value Adds
          </h3>
          <span className="text-[11px] text-muted-foreground/60 ml-1">
            argumenty wsparcia z wagą
          </span>
        </header>
        <ListItemsEditor
          initialContent={valueAdds}
          placeholder="np. darmowa dostawa w 24h"
          emptyHint={
            emptyHint ?? "Dodaj argumenty UVP — każdy z wagą i notatką."
          }
          accent={accent}
          onSave={onSaveValueAdds}
          className="rounded-none border-0"
        />
      </section>
    </div>
  );
}
