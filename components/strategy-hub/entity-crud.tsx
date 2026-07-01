"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { Plus, Trash2, Loader2, Check, Pencil, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { OptionCombobox } from "@/components/strategy-hub/option-combobox";
import {
  VisibilityControl,
  type VisibilityStatus,
} from "@/components/strategy-hub/visibility-control";

export type FieldType =
  | "text"
  | "textarea"
  | "url"
  | "number"
  | "date"
  | "select"
  | "relation";

export interface FieldDef {
  key: string;
  label: string;
  type: FieldType;
  placeholder?: string;
  options?: { value: string; label: string; tone?: BadgeTone }[];
  /** Pokaż jako tytuł karty. */
  primary?: boolean;
  /** Pokaż jako kolorowy badge (dla select). */
  badge?: boolean;
  /** Ukryj w formularzu dodawania (np. pole tylko-do-odczytu). */
  hiddenOnCreate?: boolean;
}

type BadgeTone = "neutral" | "success" | "warning" | "danger" | "info";

export interface EntityRecord {
  id: string;
  [key: string]: unknown;
}

interface EntityCrudProps {
  projectId: string;
  entity: string;
  fields: FieldDef[];
  addLabel?: string;
  emptyHint?: string;
  /** Domyślne wartości nowego rekordu. */
  defaults?: Record<string, unknown>;
  /** Nadpisuje ścieżkę API (np. dzieci segmentu scoped po segmentId). */
  basePath?: string;
  /** Kompaktowy układ jednokolumnowy (np. zagnieżdżony w karcie). */
  dense?: boolean;
  /** Wołane po każdej udanej mutacji (add/update/delete). */
  onMutate?: () => void;
  /** Filtr po stronie WWW (multi-site). */
  siteId?: string;
  /** Tylko odczyt — bez dodawania, edycji i usuwania. */
  readOnly?: boolean;
}

const toneClass: Record<BadgeTone, string> = {
  neutral: "bg-muted text-muted-foreground border-border",
  success: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  warning: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  danger: "bg-destructive/10 text-destructive border-destructive/20",
  info: "bg-blue-500/10 text-blue-400 border-blue-500/20",
};

function apiBase(projectId: string, entity: string) {
  return `/api/strategy-hub/projects/${projectId}/${entity}`;
}

// ─── Pole formularza ─────────────────────────────────────────────────────────

function Field({
  field,
  value,
  onChange,
}: {
  field: FieldDef;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  const str = value == null ? "" : String(value);
  const id = `f-${field.key}`;

  if (field.type === "textarea") {
    return (
      <div className="space-y-1">
        <label htmlFor={id} className="text-xs font-medium text-muted-foreground">
          {field.label}
        </label>
        <Textarea
          id={id}
          value={str}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          rows={3}
          className="text-sm"
        />
      </div>
    );
  }

  if (field.type === "relation") {
    return (
      <div className="space-y-1">
        <span className="text-xs font-medium text-muted-foreground">
          {field.label}
        </span>
        <OptionCombobox
          options={field.options ?? []}
          value={str || null}
          onChange={(v) => onChange(v)}
          placeholder={field.placeholder ?? "Wybierz…"}
        />
      </div>
    );
  }

  if (field.type === "select") {
    return (
      <div className="space-y-1">
        <label htmlFor={id} className="text-xs font-medium text-muted-foreground">
          {field.label}
        </label>
        <select
          id={id}
          value={str}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-full rounded-md border border-border bg-transparent px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
        >
          <option value="">—</option>
          {field.options?.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <label htmlFor={id} className="text-xs font-medium text-muted-foreground">
        {field.label}
      </label>
      <Input
        id={id}
        type={
          field.type === "url"
            ? "url"
            : field.type === "number"
              ? "number"
              : field.type === "date"
                ? "date"
                : "text"
        }
        value={
          field.type === "date" && str ? str.slice(0, 10) : str
        }
        onChange={(e) =>
          onChange(
            field.type === "number"
              ? e.target.value === ""
                ? null
                : Number(e.target.value)
              : e.target.value
          )
        }
        placeholder={field.placeholder}
        className="h-9 text-sm"
      />
    </div>
  );
}

// ─── Formularz (dodawanie / edycja) ──────────────────────────────────────────

function RecordForm({
  fields,
  initial,
  onSubmit,
  onCancel,
  submitLabel,
  pending,
}: {
  fields: FieldDef[];
  initial: Record<string, unknown>;
  onSubmit: (data: Record<string, unknown>) => void;
  onCancel: () => void;
  submitLabel: string;
  pending: boolean;
}) {
  const [draft, setDraft] = useState<Record<string, unknown>>(initial);
  const visible = fields.filter((f) => !f.hiddenOnCreate || initial.id);

  const primaryField = fields.find((f) => f.primary) ?? fields[0];
  const canSubmit = Boolean(String(draft[primaryField.key] ?? "").trim());

  return (
    <div className="rounded-lg border border-border bg-card/60 p-3 space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        {visible.map((f) => (
          <div key={f.key} className={cn(f.type === "textarea" && "sm:col-span-2")}>
            <Field
              field={f}
              value={draft[f.key]}
              onChange={(v) => setDraft((d) => ({ ...d, [f.key]: v }))}
            />
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          onClick={() => onSubmit(draft)}
          disabled={!canSubmit || pending}
          className="h-8 text-xs gap-1.5"
        >
          {pending ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Check className="size-3.5" />
          )}
          {submitLabel}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={onCancel}
          className="h-8 text-xs gap-1.5"
        >
          <X className="size-3.5" />
          Anuluj
        </Button>
      </div>
    </div>
  );
}

// ─── Karta rekordu ───────────────────────────────────────────────────────────

function RecordCard({
  record,
  fields,
  onUpdate,
  onRemove,
  projectId,
  entityType,
  visStatus,
  readOnly = false,
}: {
  record: EntityRecord;
  fields: FieldDef[];
  onUpdate: (data: Record<string, unknown>) => void;
  onRemove: () => void;
  projectId: string;
  entityType: string;
  visStatus: VisibilityStatus;
  readOnly?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const primary = fields.find((f) => f.primary) ?? fields[0];
  const badgeField = fields.find((f) => f.badge);
  const badgeOpt = badgeField?.options?.find(
    (o) => o.value === record[badgeField.key]
  );
  const secondary = fields.filter(
    (f) => !f.primary && !f.badge && record[f.key]
  );

  if (editing && !readOnly) {
    return (
      <li className="list-none">
        <RecordForm
          fields={fields}
          initial={record}
          submitLabel="Zapisz"
          pending={pending}
          onCancel={() => setEditing(false)}
          onSubmit={(data) => {
            startTransition(async () => {
              await onUpdate(data);
              setEditing(false);
            });
          }}
        />
      </li>
    );
  }

  return (
    <li className="group list-none rounded-lg border border-border/60 bg-card/40 p-3 hover:border-border transition-colors">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-foreground/90 truncate">
              {(() => {
                const raw = record[primary.key];
                if (
                  (primary.type === "relation" || primary.type === "select") &&
                  primary.options
                ) {
                  return (
                    primary.options.find((o) => o.value === raw)?.label ??
                    String(raw ?? "—")
                  );
                }
                return String(raw ?? "—");
              })()}
            </span>
            {badgeOpt && (
              <Badge
                variant="outline"
                className={cn(
                  "text-[10px] h-4 px-1.5 border",
                  toneClass[badgeOpt.tone ?? "neutral"]
                )}
              >
                {badgeOpt.label}
              </Badge>
            )}
          </div>
          {secondary.map((f) => {
            const raw = record[f.key];
            const label =
              (f.type === "relation" || f.type === "select") && f.options
                ? (f.options.find((o) => o.value === raw)?.label ??
                  String(raw))
                : String(raw);
            return (
              <p
                key={f.key}
                className="mt-1 text-xs text-muted-foreground line-clamp-2 whitespace-pre-wrap"
              >
                <span className="text-muted-foreground/60">{f.label}: </span>
                {f.type === "url" ? (
                  <a
                    href={String(raw)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-brand hover:underline break-all"
                  >
                    {String(raw)}
                  </a>
                ) : (
                  label
                )}
              </p>
            );
          })}
        </div>
        {!readOnly && (
          <div className="flex flex-col items-center gap-0.5 shrink-0">
            <VisibilityControl
              projectId={projectId}
              scope="record"
              entityType={entityType}
              entityId={record.id}
              initialStatus={visStatus}
            />
            <button
              type="button"
              onClick={() => setEditing(true)}
              aria-label="Edytuj"
              className="size-6 flex items-center justify-center rounded text-transparent group-hover:text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <Pencil className="size-3.5" />
            </button>
            <button
              type="button"
              onClick={onRemove}
              aria-label="Usuń"
              className="size-6 flex items-center justify-center rounded text-transparent group-hover:text-muted-foreground hover:text-destructive transition-colors"
            >
              <Trash2 className="size-3.5" />
            </button>
          </div>
        )}
      </div>
    </li>
  );
}

// ─── Main ────────────────────────────────────────────────────────────────────

export function EntityCrud({
  projectId,
  entity,
  fields,
  addLabel = "Dodaj",
  emptyHint = "Brak elementów — dodaj pierwszy.",
  defaults = {},
  basePath,
  dense = false,
  onMutate,
  siteId: siteIdProp,
  readOnly = false,
}: EntityCrudProps) {
  const [items, setItems] = useState<EntityRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [pending, startTransition] = useTransition();
  const [visMap, setVisMap] = useState<Record<string, VisibilityStatus>>({});

  const searchParams = useSearchParams();
  const pathId = searchParams.get("pathId");
  const siteIdFromUrl = searchParams.get("site");
  const siteId = siteIdProp ?? siteIdFromUrl ?? undefined;

  const base = basePath ?? apiBase(projectId, entity);
  const query = new URLSearchParams();
  if (pathId) query.set("pathId", pathId);
  if (siteId) query.set("siteId", siteId);
  const qs = query.toString();
  const baseWithPath = qs ? `${base}?${qs}` : base;

  useEffect(() => {
    const ctrl = new AbortController();
    fetch(`/api/strategy-hub/projects/${projectId}/visibility`, {
      signal: ctrl.signal,
    })
      .then((r) => (r.ok ? r.json() : null))
      .then(
        (d: { records?: Record<string, Record<string, VisibilityStatus>> } | null) =>
          setVisMap(d?.records?.[entity] ?? {})
      )
      .catch(() => {});
    return () => ctrl.abort();
  }, [projectId, entity]);

  const load = useCallback(async () => {
    try {
      const res = await fetch(baseWithPath, { signal: AbortSignal.timeout(8000) });
      if (res.ok) {
        const json = await res.json();
        setItems(json.items ?? []);
      }
    } catch (err) {
      console.error("load failed", err);
    }
  }, [baseWithPath]);

  useEffect(() => {
    const ctrl = new AbortController();
    fetch(baseWithPath, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((j) => setItems(j.items ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
    return () => ctrl.abort();
  }, [baseWithPath]);

  const handleAdd = (data: Record<string, unknown>) =>
    startTransition(async () => {
      try {
        const res = await fetch(base, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...defaults,
            ...data,
            ...(pathId ? { pathId } : {}),
            ...(siteId ? { siteId } : {}),
          }),
          signal: AbortSignal.timeout(8000),
        });
        if (res.ok) {
          await load();
          setAdding(false);
          onMutate?.();
        }
      } catch (err) {
        console.error("add failed", err);
      }
    });

  const handleUpdate = async (id: string, data: Record<string, unknown>) => {
    try {
      const res = await fetch(`${base}/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        signal: AbortSignal.timeout(8000),
      });
      if (res.ok) {
        await load();
        onMutate?.();
      }
    } catch (err) {
      console.error("update failed", err);
    }
  };

  const handleRemove = (id: string) =>
    startTransition(async () => {
      setItems((prev) => prev.filter((i) => i.id !== id));
      try {
        await fetch(`${base}/${id}`, {
          method: "DELETE",
          signal: AbortSignal.timeout(8000),
        });
        onMutate?.();
      } catch (err) {
        console.error("remove failed", err);
        await load();
      }
    });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">
          {loading
            ? "Ładowanie…"
            : `${items.length} ${items.length === 1 ? "element" : "elementów"}`}
        </span>
        {!adding && !readOnly && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setAdding(true)}
            className="h-8 text-xs gap-1.5"
          >
            <Plus className="size-3.5" />
            {addLabel}
          </Button>
        )}
      </div>

      {adding && !readOnly && (
        <RecordForm
          fields={fields}
          initial={{ ...defaults }}
          submitLabel="Dodaj"
          pending={pending}
          onCancel={() => setAdding(false)}
          onSubmit={handleAdd}
        />
      )}

      {!loading && items.length === 0 && !adding && (
        <p className="py-6 text-sm text-muted-foreground text-center">
          {emptyHint}
        </p>
      )}

      {items.length > 0 && (
        <ul className={cn("grid gap-2", !dense && "sm:grid-cols-2")}>
          {items.map((item) => (
            <RecordCard
              key={item.id}
              record={item}
              fields={fields}
              onUpdate={(data) => handleUpdate(item.id, data)}
              onRemove={() => handleRemove(item.id)}
              projectId={projectId}
              entityType={entity}
              visStatus={visMap[item.id] ?? "visible"}
              readOnly={readOnly}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
