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
  WEIGHT_OPTIONS,
  weightPickerActiveClass,
  type StrategyListWeight,
} from "@/lib/strategy-hub/business-strategy-lists";

/**
 * Wiersz encji DB-backed: dowolna encja z polami text+note+weight.
 * (np. business_problems → problemMd+ambitionMd+priority,
 *      objections → objectionMd+responseMd+priority)
 *
 * Komponent NIE wie o nazwach pól w DB — używa generycznego interfejsu.
 * Mapowanie robi parent (`mapToCallout`/`mapFromCallout`).
 */
export interface CalloutItem {
  id: string;
  text: string;
  note: string;
  weight: StrategyListWeight;
}

interface EntityCalloutListProps {
  items: CalloutItem[];
  onAdd: (text: string) => Promise<CalloutItem>;
  onUpdate: (
    id: string,
    patch: Partial<Pick<CalloutItem, "text" | "note" | "weight">>
  ) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
  placeholder?: string;
  addLabel?: string;
  emptyHint?: string;
  className?: string;
}

// ─── Primitive: kropka wagi ──────────────────────────────────────────────────

function weightDotClass(w: StrategyListWeight) {
  return { 1: "bg-emerald-500", 2: "bg-amber-500", 3: "bg-destructive" }[w];
}

// ─── Primitive: pasek wagi (lewa krawędź kafelka) ────────────────────────────

function WeightBar({ value }: { value: StrategyListWeight }) {
  return (
    <span
      aria-hidden
      className={cn(
        "shrink-0 self-stretch w-1.5 rounded-l-md",
        weightDotClass(value)
      )}
    />
  );
}

// ─── Mini picker wagi (popover przy ikonie ołówka) ───────────────────────────

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
              <span
                className={cn("w-5 h-1.5 rounded-full shrink-0", weightDotClass(w))}
              />
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Primitive: auto-resize textarea ─────────────────────────────────────────

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

// ─── Wiersz encji ────────────────────────────────────────────────────────────

function EntityRow({
  item,
  index,
  onUpdate,
  onRemove,
}: {
  item: CalloutItem;
  index: number;
  onUpdate: (patch: Partial<Pick<CalloutItem, "text" | "note" | "weight">>) => void;
  onRemove: () => void;
}) {
  // Lokalny stan tekstu — debounce'owany zapis
  const [text, setText] = useState(item.text);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync z propem bez efektu (React 19) — wzorzec „poprzedni prop".
  const [prevText, setPrevText] = useState(item.text);
  if (item.text !== prevText) {
    setPrevText(item.text);
    setText(item.text);
  }

  const onTextChange = (next: string) => {
    setText(next);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onUpdate({ text: next });
    }, 500);
  };

  return (
    <li className="group flex items-stretch rounded-md border border-border/40 bg-muted/10 hover:bg-muted/20 transition-colors">
      <WeightBar value={item.weight} />
      <div className="flex items-start gap-2 flex-1 min-w-0 px-2.5 pt-1.5 pb-1">
        <AutoResizeText
          value={text}
          onChange={onTextChange}
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
            onChange={(weight) => onUpdate({ weight })}
            itemLabel={item.text || `element ${index + 1}`}
          />
        </div>
      </div>
    </li>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

export function EntityCalloutList({
  items,
  onAdd,
  onUpdate,
  onRemove,
  placeholder = "Wpisz element i naciśnij Enter…",
  addLabel = "Dodaj",
  emptyHint = "Brak elementów — dodaj pierwszy poniżej.",
  className,
}: EntityCalloutListProps) {
  const [draft, setDraft] = useState("");
  const [pending, startTransition] = useTransition();
  const [savedTick, setSavedTick] = useState(false);

  const flashSaved = useCallback(() => {
    setSavedTick(true);
    setTimeout(() => setSavedTick(false), 1500);
  }, []);

  const handleAdd = () => {
    const value = draft.trim();
    if (!value) return;
    startTransition(async () => {
      try {
        await onAdd(value);
        setDraft("");
        flashSaved();
      } catch (err) {
        console.error("add failed", err);
      }
    });
  };

  const handleUpdate = (
    id: string,
    patch: Partial<Pick<CalloutItem, "text" | "note" | "weight">>
  ) => {
    startTransition(async () => {
      try {
        await onUpdate(id, patch);
        flashSaved();
      } catch (err) {
        console.error("update failed", err);
      }
    });
  };

  const handleRemove = (id: string) => {
    startTransition(async () => {
      try {
        await onRemove(id);
        flashSaved();
      } catch (err) {
        console.error("remove failed", err);
      }
    });
  };

  const handleDraftKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      handleAdd();
    }
  };

  return (
    <div className={cn(className)}>
      {/* Status bar */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border">
        <span className="text-xs text-muted-foreground mr-auto">
          {items.length === 0
            ? "Brak elementów"
            : `${items.length} ${
                items.length === 1
                  ? "element"
                  : items.length <= 4
                    ? "elementy"
                    : "elementów"
              }`}
        </span>
        {pending && (
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Loader2 className="size-3 animate-spin" />
            Zapisywanie…
          </span>
        )}
        {!pending && savedTick && (
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
        <ul
          className="grid p-3 gap-2"
          style={{ gridTemplateColumns: "repeat(auto-fill, minmax(14rem, 1fr))" }}
        >
          {items.map((item, index) => (
            <EntityRow
              key={item.id}
              item={item}
              index={index}
              onUpdate={(patch) => handleUpdate(item.id, patch)}
              onRemove={() => handleRemove(item.id)}
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
            disabled={pending}
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={handleAdd}
            disabled={!draft.trim() || pending}
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
