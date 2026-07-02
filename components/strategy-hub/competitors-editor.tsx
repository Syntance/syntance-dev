"use client";

import {
  useCallback,
  useRef,
  useState,
  useTransition,
  type KeyboardEvent,
} from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Plus,
  Trash2,
  Loader2,
  Check,
  ChevronDown,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type CompetitorType = "direct" | "indirect" | "none";

export interface CompetitorRow {
  id: string;
  name: string;
  url: string | null;
  type: string;
  strengthsMd: string | null;
  weaknessesMd: string | null;
  pricingMd: string | null;
  channelsMd: string | null;
  notesMd: string | null;
  quadrantX: number | null;
  quadrantY: number | null;
}

interface CompetitorsEditorProps {
  items: CompetitorRow[];
  onAdd: (data: { name: string; url?: string }) => Promise<CompetitorRow>;
  onUpdate: (id: string, patch: Partial<CompetitorRow>) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
}

const TYPE_LABELS: Record<CompetitorType, string> = {
  direct: "Bezpośredni",
  indirect: "Pośredni",
  none: "Substytut",
};

const TYPE_DOT: Record<CompetitorType, string> = {
  direct: "bg-destructive",
  indirect: "bg-amber-500",
  none: "bg-muted-foreground",
};

function asType(t: string): CompetitorType {
  return t === "direct" || t === "indirect" || t === "none" ? t : "direct";
}

function CompetitorCard({
  item,
  onUpdate,
  onRemove,
}: {
  item: CompetitorRow;
  onUpdate: (patch: Partial<CompetitorRow>) => void;
  onRemove: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [name, setName] = useState(item.name);
  const [url, setUrl] = useState(item.url ?? "");
  const [strengths, setStrengths] = useState(item.strengthsMd ?? "");
  const [weaknesses, setWeaknesses] = useState(item.weaknessesMd ?? "");
  const [pricing, setPricing] = useState(item.pricingMd ?? "");
  const [notes, setNotes] = useState(item.notesMd ?? "");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync ze źródłem `item` bez efektu (React 19): reset podczas renderu przy zmianie identyczności.
  const [prevItem, setPrevItem] = useState(item);
  if (item !== prevItem) {
    setPrevItem(item);
    setName(item.name);
    setUrl(item.url ?? "");
    setStrengths(item.strengthsMd ?? "");
    setWeaknesses(item.weaknessesMd ?? "");
    setPricing(item.pricingMd ?? "");
    setNotes(item.notesMd ?? "");
  }

  const debouncedUpdate = useCallback(
    (patch: Partial<CompetitorRow>) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => onUpdate(patch), 500);
    },
    [onUpdate]
  );

  const type = asType(item.type);

  return (
    <li className="rounded-md border border-border/40 bg-muted/10 hover:bg-muted/20 transition-colors">
      <div className="flex items-center gap-2 px-3 py-2">
        <span
          aria-hidden
          className={cn("size-2 shrink-0 rounded-full", TYPE_DOT[type])}
          title={TYPE_LABELS[type]}
        />
        <input
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            debouncedUpdate({ name: e.target.value });
          }}
          className="bg-transparent border-none outline-none text-sm font-medium flex-1 min-w-0"
          aria-label="Nazwa konkurenta"
          placeholder="Nazwa…"
        />
        {url && (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground hover:text-foreground"
            aria-label={`Otwórz ${url} w nowej karcie`}
          >
            <ExternalLink className="size-3.5" />
          </a>
        )}
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          aria-label={expanded ? "Zwiń" : "Rozwiń szczegóły"}
          className="size-6 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
        >
          <ChevronDown
            className={cn("size-3.5 transition-transform", expanded && "rotate-180")}
          />
        </button>
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Usuń ${name}`}
          className="size-6 flex items-center justify-center rounded text-muted-foreground hover:text-destructive transition-colors"
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>

      {expanded && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 px-3 pb-3 pt-1 border-t border-border/30">
          <Field label="URL">
            <Input
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                debouncedUpdate({ url: e.target.value || null });
              }}
              placeholder="https://…"
              className="h-7 text-xs"
            />
          </Field>
          <Field label="Typ">
            <select
              value={type}
              onChange={(e) =>
                onUpdate({ type: e.target.value as CompetitorType })
              }
              className="h-7 text-xs bg-muted/20 border border-border/40 rounded-md px-2 outline-none focus:ring-1 focus:ring-ring"
              aria-label="Typ konkurenta"
            >
              <option value="direct">Bezpośredni</option>
              <option value="indirect">Pośredni</option>
              <option value="none">Substytut</option>
            </select>
          </Field>
          <Field label="Mocne strony">
            <Textarea
              value={strengths}
              onChange={(v) => {
                setStrengths(v);
                debouncedUpdate({ strengthsMd: v || null });
              }}
            />
          </Field>
          <Field label="Słabe strony">
            <Textarea
              value={weaknesses}
              onChange={(v) => {
                setWeaknesses(v);
                debouncedUpdate({ weaknessesMd: v || null });
              }}
            />
          </Field>
          <Field label="Cennik">
            <Textarea
              value={pricing}
              onChange={(v) => {
                setPricing(v);
                debouncedUpdate({ pricingMd: v || null });
              }}
            />
          </Field>
          <Field label="Notatki">
            <Textarea
              value={notes}
              onChange={(v) => {
                setNotes(v);
                debouncedUpdate({ notesMd: v || null });
              }}
            />
          </Field>
        </div>
      )}
    </li>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">
        {label}
      </span>
      {children}
    </label>
  );
}

function Textarea({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      rows={2}
      className="w-full px-2 py-1 text-xs leading-snug rounded-md bg-muted/20 border border-border/40 outline-none focus:ring-1 focus:ring-ring resize-none field-sizing-content"
    />
  );
}

export function CompetitorsEditor({
  items,
  onAdd,
  onUpdate,
  onRemove,
}: CompetitorsEditorProps) {
  const [draftName, setDraftName] = useState("");
  const [draftUrl, setDraftUrl] = useState("");
  const [pending, startTransition] = useTransition();
  const [savedTick, setSavedTick] = useState(false);

  const flashSaved = () => {
    setSavedTick(true);
    setTimeout(() => setSavedTick(false), 1500);
  };

  const handleAdd = () => {
    const name = draftName.trim();
    if (!name) return;
    startTransition(async () => {
      try {
        await onAdd({ name, url: draftUrl.trim() || undefined });
        setDraftName("");
        setDraftUrl("");
        flashSaved();
      } catch (err) {
        console.error(err);
      }
    });
  };

  const wrapUpdate = (id: string, patch: Partial<CompetitorRow>) => {
    startTransition(async () => {
      try {
        await onUpdate(id, patch);
        flashSaved();
      } catch (err) {
        console.error(err);
      }
    });
  };

  const wrapRemove = (id: string) => {
    startTransition(async () => {
      try {
        await onRemove(id);
        flashSaved();
      } catch (err) {
        console.error(err);
      }
    });
  };

  const handleDraftKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAdd();
    }
  };

  return (
    <div>
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border">
        <span className="text-xs text-muted-foreground mr-auto">
          {items.length}{" "}
          {items.length === 1 ? "konkurent" : "konkurentów"}
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

      {items.length === 0 ? (
        <p className="px-5 py-8 text-sm text-muted-foreground text-center">
          Brak konkurentów. Dodaj pierwszego poniżej.
        </p>
      ) : (
        <ul className="p-3 space-y-1.5">
          {items.map((item) => (
            <CompetitorCard
              key={item.id}
              item={item}
              onUpdate={(patch) => wrapUpdate(item.id, patch)}
              onRemove={() => wrapRemove(item.id)}
            />
          ))}
        </ul>
      )}

      <div className="border-t border-border px-4 py-3">
        <div className="flex items-center gap-2 max-w-xl">
          <Input
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            onKeyDown={handleDraftKeyDown}
            placeholder="Nazwa konkurenta…"
            className="flex-1 min-w-0 h-8 text-sm"
            disabled={pending}
            aria-label="Nazwa nowego konkurenta"
          />
          <Input
            value={draftUrl}
            onChange={(e) => setDraftUrl(e.target.value)}
            onKeyDown={handleDraftKeyDown}
            placeholder="URL (opcjonalnie)"
            className="flex-1 min-w-0 h-8 text-sm"
            disabled={pending}
            aria-label="URL konkurenta"
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={handleAdd}
            disabled={!draftName.trim() || pending}
            className="gap-1.5 shrink-0 h-8 text-xs"
          >
            <Plus className="size-3.5" />
            Dodaj
          </Button>
        </div>
      </div>
    </div>
  );
}
