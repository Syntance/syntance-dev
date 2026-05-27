"use client";

import { useState, useTransition, type ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Plus, Pencil, Trash2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface FieldConfig {
  name: string;
  label: string;
  type?: "text" | "textarea" | "number" | "date" | "select" | "hidden";
  options?: { value: string; label: string }[];
  placeholder?: string;
  required?: boolean;
  full?: boolean;
  defaultValue?: string;
}

interface ResourceListProps<T extends { id: string }> {
  title: string;
  icon?: ReactNode;
  items: T[];
  fields: FieldConfig[];
  renderRow: (item: T) => ReactNode;
  onSave: (data: Record<string, unknown> & { id?: string }) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  emptyHint?: string;
  newButtonLabel?: string;
}

export function ResourceList<T extends { id: string }>({
  title,
  icon,
  items,
  fields,
  renderRow,
  onSave,
  onDelete,
  emptyHint = "Brak danych.",
  newButtonLabel = "Dodaj",
}: ResourceListProps<T>) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<T | null>(null);
  const [pending, startTransition] = useTransition();

  function openNew() {
    setEditing(null);
    setOpen(true);
  }

  function openEdit(item: T) {
    setEditing(item);
    setOpen(true);
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const data: Record<string, unknown> = {};
    for (const field of fields) {
      const value = form.get(field.name);
      if (value !== null && value !== "") {
        data[field.name] = value;
      }
    }
    if (editing) data.id = editing.id;
    startTransition(async () => {
      try {
        await onSave(data);
        setOpen(false);
      } catch (err) {
        console.error(err);
      }
    });
  }

  function handleDelete(id: string) {
    if (!confirm("Na pewno usunąć?")) return;
    startTransition(async () => {
      await onDelete(id);
    });
  }

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-5 py-3 border-b border-border bg-muted/20">
        <div className="flex items-center gap-2">
          {icon}
          <span className="font-medium text-sm">{title}</span>
          <span className="text-xs text-muted-foreground">({items.length})</span>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={openNew}
          className="h-7 gap-1.5 text-xs"
        >
          <Plus className="size-3.5" />
          {newButtonLabel}
        </Button>
      </div>

      {items.length === 0 ? (
        <div className="px-5 py-8 text-center text-xs text-muted-foreground">
          {emptyHint}
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {items.map((item) => (
            <li
              key={item.id}
              className="group flex items-center justify-between gap-3 px-5 py-3 hover:bg-muted/20 transition-colors"
            >
              <div className="flex-1 min-w-0">{renderRow(item)}</div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-7"
                  onClick={() => openEdit(item)}
                  aria-label="Edytuj"
                >
                  <Pencil className="size-3.5" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-7 hover:text-destructive"
                  onClick={() => handleDelete(item.id)}
                  aria-label="Usuń"
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edytuj" : "Dodaj"} — {title}</DialogTitle>
            <DialogDescription className="text-xs">
              {editing ? "Zaktualizuj dane wpisu." : "Uzupełnij dane nowego wpisu."}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="grid gap-3 sm:grid-cols-2">
            {fields.map((field) => {
              const editingValue =
                editing
                  ? (editing as unknown as Record<string, unknown>)[field.name]
                  : undefined;
              if (field.type === "hidden") {
                return (
                  <input
                    key={field.name}
                    type="hidden"
                    name={field.name}
                    defaultValue={
                      (editingValue as string | undefined) ??
                      field.defaultValue ??
                      ""
                    }
                  />
                );
              }
              return (
              <div
                key={field.name}
                className={cn(
                  "flex flex-col gap-1.5",
                  (field.full || field.type === "textarea") && "sm:col-span-2"
                )}
              >
                <label
                  htmlFor={field.name}
                  className="text-xs font-medium text-muted-foreground"
                >
                  {field.label}
                  {field.required && (
                    <span className="text-destructive ml-1">*</span>
                  )}
                </label>
                {field.type === "textarea" ? (
                  <textarea
                    id={field.name}
                    name={field.name}
                    placeholder={field.placeholder}
                    required={field.required}
                    defaultValue={(editingValue as string | undefined) ?? ""}
                    rows={3}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-accent-light focus:outline-none focus:ring-2 focus:ring-accent/20 resize-y"
                  />
                ) : field.type === "select" ? (
                  <select
                    id={field.name}
                    name={field.name}
                    required={field.required}
                    defaultValue={(editingValue as string | undefined) ?? ""}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-accent-light focus:outline-none focus:ring-2 focus:ring-accent/20"
                  >
                    <option value="">— wybierz —</option>
                    {field.options?.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    id={field.name}
                    name={field.name}
                    type={field.type ?? "text"}
                    placeholder={field.placeholder}
                    required={field.required}
                    defaultValue={
                      field.type === "date" && editingValue
                        ? new Date(editingValue as string)
                            .toISOString()
                            .slice(0, 10)
                        : ((editingValue as string | number | undefined) ?? "")
                    }
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-accent-light focus:outline-none focus:ring-2 focus:ring-accent/20"
                  />
                )}
              </div>
              );
            })}

            <DialogFooter className="sm:col-span-2 mt-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setOpen(false)}
                disabled={pending}
              >
                Anuluj
              </Button>
              <Button
                type="submit"
                size="sm"
                className="bg-brand hover:bg-brand/90 text-white"
                disabled={pending}
              >
                {pending && <Loader2 className="size-3.5 animate-spin" />}
                {editing ? "Zapisz" : "Dodaj"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
