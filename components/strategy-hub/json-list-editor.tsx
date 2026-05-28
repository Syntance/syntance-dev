"use client";

import { Plus, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface JsonColumn {
  key: string;
  label: string;
  type?: "text" | "color";
  placeholder?: string;
  width?: string;
}

type Item = Record<string, unknown>;

interface JsonListEditorProps {
  value: Item[];
  columns: JsonColumn[];
  onChange: (next: Item[]) => void;
  addLabel?: string;
  emptyHint?: string;
}

/**
 * Edytor listy płaskich obiektów (np. kolory marki, typografia, loga).
 * Zmiany propagowane do parenta przez `onChange` — parent decyduje o zapisie.
 */
export function JsonListEditor({
  value,
  columns,
  onChange,
  addLabel = "Dodaj wiersz",
  emptyHint = "Brak pozycji.",
}: JsonListEditorProps) {
  const items = Array.isArray(value) ? value : [];

  const update = (idx: number, key: string, v: string) => {
    const next = items.map((it, i) => (i === idx ? { ...it, [key]: v } : it));
    onChange(next);
  };

  const remove = (idx: number) => onChange(items.filter((_, i) => i !== idx));

  const add = () => {
    const blank: Item = {};
    for (const c of columns) blank[c.key] = "";
    onChange([...items, blank]);
  };

  return (
    <div className="space-y-2">
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground py-2">{emptyHint}</p>
      ) : (
        <ul className="space-y-1.5">
          {items.map((item, idx) => (
            <li key={idx} className="flex items-center gap-2">
              {columns.map((col) => {
                const val = item[col.key] == null ? "" : String(item[col.key]);
                if (col.type === "color") {
                  return (
                    <div
                      key={col.key}
                      className="flex items-center gap-1.5 shrink-0"
                    >
                      <input
                        type="color"
                        aria-label={`${col.label} (próbnik)`}
                        value={/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(val) ? val : "#888888"}
                        onChange={(e) => update(idx, col.key, e.target.value)}
                        className="size-9 rounded-md border border-border bg-transparent p-0.5 cursor-pointer"
                      />
                      <Input
                        value={val}
                        onChange={(e) => update(idx, col.key, e.target.value)}
                        placeholder={col.placeholder ?? col.label}
                        aria-label={col.label}
                        className="h-9 text-sm w-28"
                      />
                    </div>
                  );
                }
                return (
                  <Input
                    key={col.key}
                    value={val}
                    onChange={(e) => update(idx, col.key, e.target.value)}
                    placeholder={col.placeholder ?? col.label}
                    aria-label={col.label}
                    className={cn("h-9 text-sm flex-1 min-w-0", col.width)}
                  />
                );
              })}
              <button
                type="button"
                onClick={() => remove(idx)}
                aria-label="Usuń wiersz"
                className="size-8 shrink-0 flex items-center justify-center rounded text-muted-foreground hover:text-destructive hover:bg-muted transition-colors"
              >
                <Trash2 className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={add}
        className="h-8 text-xs gap-1.5"
      >
        <Plus className="size-3.5" />
        {addLabel}
      </Button>
    </div>
  );
}
