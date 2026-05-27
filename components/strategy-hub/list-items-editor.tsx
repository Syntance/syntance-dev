"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useTransition,
  type KeyboardEvent,
} from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, Loader2, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  createStrategyListItem,
  parseStrategyListItems,
  serializeStrategyListItems,
  WEIGHT_OPTIONS,
  weightBgClass,
  weightBorderClass,
  weightPickerActiveClass,
  type StrategyListItem,
  type StrategyListWeight,
} from "@/lib/strategy-hub/business-strategy-lists";

type AccentVariant = "violet" | "amber" | "rose";

interface ListItemsEditorProps {
  initialContent: string | null;
  placeholder?: string;
  onSave: (content: string) => Promise<void>;
  className?: string;
  addLabel?: string;
  emptyHint?: string;
  accent?: AccentVariant;
}

const ACCENT_RING: Record<AccentVariant, string> = {
  violet: "focus-within:ring-violet-500/20 focus-within:border-violet-500/40",
  amber: "focus-within:ring-amber-500/20 focus-within:border-amber-500/40",
  rose: "focus-within:ring-rose-500/20 focus-within:border-rose-500/40",
};

const CALLOUT_WIDTH =
  "w-fit min-w-[min(100%,16rem)] max-w-lg";

function AutoResizeTitle({
  value,
  onChange,
  placeholder,
  ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  ariaLabel: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  const syncHeight = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${el.scrollHeight}px`;
  }, []);

  useLayoutEffect(() => {
    syncHeight();
  }, [value, syncHeight]);

  return (
    <textarea
      ref={ref}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onInput={syncHeight}
      placeholder={placeholder}
      aria-label={ariaLabel}
      rows={1}
      className={cn(
        "flex w-full min-h-8 resize-none overflow-hidden rounded-lg border border-transparent",
        "bg-transparent px-2.5 py-1.5 text-sm font-medium leading-snug shadow-none outline-none",
        "transition-colors placeholder:text-muted-foreground",
        "focus-visible:border-ring focus-visible:bg-background/80 focus-visible:ring-3 focus-visible:ring-ring/50",
        "field-sizing-content dark:bg-transparent"
      )}
    />
  );
}

function WeightPicker({
  value,
  onChange,
  itemLabel,
}: {
  value: StrategyListWeight;
  onChange: (weight: StrategyListWeight) => void;
  itemLabel: string;
}) {
  return (
    <div
      className="flex flex-wrap items-center justify-end gap-0.5 shrink-0"
      role="group"
      aria-label={`Priorytet elementu: ${itemLabel}`}
    >
      {WEIGHT_OPTIONS.map(({ value: w, label }) => (
        <button
          key={w}
          type="button"
          title={label}
          aria-label={label}
          aria-pressed={value === w}
          onClick={() => onChange(w)}
          className={cn(
            "h-7 px-2 rounded-md text-[10px] font-medium border transition-colors",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
            value === w
              ? weightPickerActiveClass(w)
              : "border-border bg-background text-muted-foreground hover:bg-muted/60"
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function StrategyCallout({
  item,
  index,
  accent,
  onChange,
  onRemove,
}: {
  item: StrategyListItem;
  index: number;
  accent: AccentVariant;
  onChange: (next: StrategyListItem) => void;
  onRemove: () => void;
}) {
  const [noteOpen, setNoteOpen] = useState(Boolean(item.note.trim()));

  const clearNote = () => {
    onChange({ ...item, note: "" });
    setNoteOpen(false);
  };

  return (
    <li className={CALLOUT_WIDTH}>
      <div
        className={cn(
          "rounded-lg border border-border border-l-[3px] px-3 py-2.5 transition-colors",
          weightBorderClass(item.weight),
          weightBgClass(item.weight),
          ACCENT_RING[accent],
          "focus-within:ring-2"
        )}
      >
        <div className="grid grid-cols-[1.25rem_minmax(0,1fr)_auto] gap-x-2 gap-y-2 items-start">
          <span
            className="text-xs font-medium text-muted-foreground pt-2 tabular-nums text-right"
            aria-hidden
          >
            {index + 1}.
          </span>

          <AutoResizeTitle
            value={item.text}
            onChange={(text) => onChange({ ...item, text })}
            placeholder="Nazwa…"
            ariaLabel={`Element ${index + 1}`}
          />

          <div className="flex items-start gap-0.5 pt-0.5">
            <WeightPicker
              value={item.weight}
              onChange={(weight) => onChange({ ...item, weight })}
              itemLabel={item.text || `element ${index + 1}`}
            />
            <Button
              type="button"
              size="icon"
              variant="ghost"
              onClick={onRemove}
              className="size-8 shrink-0 text-muted-foreground hover:text-destructive"
              aria-label={`Usuń element ${index + 1}`}
            >
              <Trash2 className="size-3.5" />
            </Button>
          </div>

          {noteOpen ? (
            <div className="col-start-2 relative min-w-0">
              <Textarea
                value={item.note}
                onChange={(e) => onChange({ ...item, note: e.target.value })}
                placeholder="Notatka (opcjonalna)…"
                aria-label={`Notatka do elementu ${index + 1}`}
                rows={2}
                className="w-full min-h-0 text-xs bg-background/50 resize-none py-1.5 pr-9 field-sizing-content"
              />
              <Button
                type="button"
                size="icon"
                variant="ghost"
                onClick={clearNote}
                className="absolute top-1 right-1 size-7 text-muted-foreground hover:text-destructive"
                aria-label={`Usuń notatkę elementu ${index + 1}`}
              >
                <Trash2 className="size-3" />
              </Button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setNoteOpen(true)}
              className="col-start-2 text-left text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              + Dodaj notatkę
            </button>
          )}
        </div>
      </div>
    </li>
  );
}

export function ListItemsEditor({
  initialContent,
  placeholder = "Wpisz element i naciśnij Enter…",
  onSave,
  className,
  addLabel = "Dodaj",
  emptyHint = "Brak elementów — dodaj pierwszy callout poniżej.",
  accent = "violet",
}: ListItemsEditorProps) {
  const [items, setItems] = useState(() =>
    parseStrategyListItems(initialContent)
  );
  const [draft, setDraft] = useState("");
  const [saving, startSave] = useTransition();
  const [saved, setSaved] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const persist = useCallback(
    (nextItems: StrategyListItem[]) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        startSave(async () => {
          await onSave(serializeStrategyListItems(nextItems));
          setSaved(true);
          if (savedTimeoutRef.current) clearTimeout(savedTimeoutRef.current);
          savedTimeoutRef.current = setTimeout(() => setSaved(false), 2000);
        });
      }, 500);
    },
    [onSave]
  );

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (savedTimeoutRef.current) clearTimeout(savedTimeoutRef.current);
    };
  }, []);

  const updateItem = (index: number, next: StrategyListItem) => {
    const updated = [...items];
    updated[index] = next;
    setItems(updated);
    persist(updated);
  };

  const removeItem = (index: number) => {
    const next = items.filter((_, i) => i !== index);
    setItems(next);
    persist(next);
  };

  const addItem = () => {
    const value = draft.trim();
    if (!value) return;
    const next = [...items, createStrategyListItem(value)];
    setItems(next);
    setDraft("");
    persist(next);
  };

  const handleDraftKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      addItem();
    }
  };

  return (
    <div className={cn("bg-card", className)}>
      <div className="flex items-center justify-end gap-2 px-4 py-2 border-b border-border bg-muted/20">
        <span className="mr-auto text-xs text-muted-foreground">
          {items.length}{" "}
          {items.length === 1
            ? "callout"
            : items.length >= 2 && items.length <= 4
              ? "callouty"
              : "calloutów"}
        </span>
        {saving ? (
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Loader2 className="size-3 animate-spin" />
            Zapisywanie…
          </span>
        ) : saved ? (
          <span className="inline-flex items-center gap-1 text-xs text-success">
            <Check className="size-3" />
            Zapisano
          </span>
        ) : null}
      </div>

      {items.length === 0 ? (
        <p className="px-5 py-6 text-sm text-muted-foreground text-center">
          {emptyHint}
        </p>
      ) : (
        <ul className="flex flex-col items-start gap-2.5 p-4">
          {items.map((item, index) => (
            <StrategyCallout
              key={item.id}
              item={item}
              index={index}
              accent={accent}
              onChange={(next) => updateItem(index, next)}
              onRemove={() => removeItem(index)}
            />
          ))}
        </ul>
      )}

      <div className="border-t border-border bg-muted/10 px-4 py-3">
        <div className={cn("flex items-center gap-2", CALLOUT_WIDTH)}>
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleDraftKeyDown}
            placeholder={placeholder}
            aria-label="Nowy element"
            className="flex-1 min-w-0"
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={addItem}
            disabled={!draft.trim() || saving}
            className="gap-1.5 shrink-0"
          >
            <Plus className="size-3.5" />
            {addLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
