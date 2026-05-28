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
import { Button } from "@/components/ui/button";
import { Plus, Trash2, Loader2, Check, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  createStrategyListItem,
  parseStrategyListItems,
  serializeStrategyListItems,
  WEIGHT_OPTIONS,
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

// ─── Kolorowe kropki wagi ─────────────────────────────────────────────────────

function weightDotClass(w: StrategyListWeight) {
  return {
    1: "bg-emerald-500",
    2: "bg-amber-500",
    3: "bg-destructive",
  }[w];
}

// Pasek wagi — tylko wizualny
function WeightBar({ value }: { value: StrategyListWeight }) {
  return (
    <span
      aria-hidden
      className={cn("shrink-0 self-stretch w-1.5 rounded-l-md", weightDotClass(value))}
    />
  );
}

// Mini picker wagi — popup przy ołówku
function WeightPicker({
  value,
  onChange,
  itemLabel,
}: {
  value: StrategyListWeight;
  onChange: (w: StrategyListWeight) => void;
  itemLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label={`Zmień wagę elementu: ${itemLabel}`}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "size-5 flex items-center justify-center rounded transition-colors",
          open
            ? "text-foreground bg-muted"
            : "text-transparent group-hover:text-muted-foreground hover:text-foreground hover:bg-muted"
        )}
      >
        <Pencil className="size-3" />
      </button>

      {open && (
        <div className="absolute right-0 bottom-6 z-20 flex items-center gap-1 rounded-lg border border-border bg-popover px-2 py-1.5 shadow-lg">
          {WEIGHT_OPTIONS.map(({ value: w, label }) => (
            <button
              key={w}
              type="button"
              title={label}
              onClick={() => {
                onChange(w);
                setOpen(false);
              }}
              className={cn(
                "flex flex-col items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium transition-colors",
                value === w
                  ? weightPickerActiveClass(w)
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <span className={cn("w-5 h-1.5 rounded-full shrink-0", weightDotClass(w))} />
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Auto-resize textarea ─────────────────────────────────────────────────────

function AutoResizeText({
  value,
  onChange,
  placeholder,
  ariaLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  ariaLabel: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  const sync = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${el.scrollHeight}px`;
  }, []);

  useLayoutEffect(() => {
    sync();
  }, [value, sync]);

  return (
    <textarea
      ref={ref}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onInput={sync}
      placeholder={placeholder}
      aria-label={ariaLabel}
      rows={1}
      className={cn(
        "flex-1 min-w-0 w-full bg-transparent text-sm leading-snug resize-none overflow-hidden",
        "py-0.5 outline-none border-none shadow-none",
        "placeholder:text-muted-foreground/50 text-foreground/90",
        "field-sizing-content"
      )}
    />
  );
}

// ─── Jeden wiersz elementu ────────────────────────────────────────────────────

function StrategyRow({
  item,
  index,
  onChange,
  onRemove,
}: {
  item: StrategyListItem;
  index: number;
  accent: AccentVariant;
  onChange: (next: StrategyListItem) => void;
  onRemove: () => void;
}) {
  return (
    <li className="group flex items-stretch rounded-md border border-border/40 bg-muted/10 hover:bg-muted/20 transition-colors">
      <WeightBar value={item.weight} />
      <div className="flex items-start gap-2 flex-1 min-w-0 px-2.5 py-1.5">
        <AutoResizeText
          value={item.text}
          onChange={(text) => onChange({ ...item, text })}
          placeholder="Element…"
          ariaLabel={`Element ${index + 1}`}
        />
        <div className="flex flex-col items-center gap-0.5 shrink-0 mt-0.5">
          <button
            type="button"
            onClick={onRemove}
            aria-label={`Usuń element ${index + 1}`}
            className="size-5 flex items-center justify-center rounded text-transparent group-hover:text-muted-foreground hover:text-destructive transition-colors"
          >
            <Trash2 className="size-3" />
          </button>
          <WeightPicker
            value={item.weight}
            onChange={(weight) => onChange({ ...item, weight })}
            itemLabel={item.text || `element ${index + 1}`}
          />
        </div>
      </div>
    </li>
  );
}

// ─── ListItemsEditor ──────────────────────────────────────────────────────────

export function ListItemsEditor({
  initialContent,
  placeholder = "Wpisz element i naciśnij Enter…",
  onSave,
  className,
  addLabel = "Dodaj",
  emptyHint = "Brak elementów — dodaj pierwszy poniżej.",
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
    <div className={cn(className)}>
      {/* Status bar */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border">
        <span className="text-xs text-muted-foreground mr-auto">
          {items.length === 0
            ? "Brak elementów"
            : `${items.length} ${items.length === 1 ? "element" : items.length <= 4 ? "elementy" : "elementów"}`}
        </span>
        {/* Legenda wag */}
        <div className="flex items-center gap-2 mr-2 pr-2 border-r border-border/50">
          <span className="flex items-center gap-1 text-[10px] text-muted-foreground/70">
            <span className="size-2 rounded-full bg-destructive" />
            Ważne
          </span>
          <span className="flex items-center gap-1 text-[10px] text-muted-foreground/70">
            <span className="size-2 rounded-full bg-amber-500" />
            Średnie
          </span>
          <span className="flex items-center gap-1 text-[10px] text-muted-foreground/70">
            <span className="size-2 rounded-full bg-emerald-500" />
            Neutralne
          </span>
        </div>
        {saving && (
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Loader2 className="size-3 animate-spin" />
            Zapisywanie…
          </span>
        )}
        {!saving && saved && (
          <span className="inline-flex items-center gap-1 text-xs text-success">
            <Check className="size-3" />
            Zapisano
          </span>
        )}
      </div>

      {/* Lista */}
      {items.length === 0 ? (
        <p className="px-5 py-6 text-sm text-muted-foreground text-center">
          {emptyHint}
        </p>
      ) : (
        <ul className="grid p-3 gap-2" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(14rem, 1fr))" }}>
          {items.map((item, index) => (
            <StrategyRow
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

      {/* Dodaj nowy */}
      <div className="border-t border-border px-4 py-3">
        <div className="flex items-center gap-2 max-w-lg">
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleDraftKeyDown}
            placeholder={placeholder}
            aria-label="Nowy element"
            className="flex-1 min-w-0 h-8 text-sm"
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={addItem}
            disabled={!draft.trim() || saving}
            className="gap-1.5 shrink-0 h-8 text-xs"
          >
            <Plus className="size-3.5" />
            {addLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
