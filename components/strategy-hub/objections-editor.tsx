"use client";

import * as React from "react";
import { Plus, Trash2, Sparkles, ShieldQuestion, Loader2, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { RelationPicker } from "@/components/strategy-hub/relation-picker";
import { useHubOverlays } from "@/components/strategy-hub/hub-overlays";

const STAGES = ["TOFU", "MOFU", "BOFU", "retention"] as const;
type Stage = (typeof STAGES)[number];

const STATUSES = [
  { value: "active", label: "Otwarta", tone: "warning" },
  { value: "needs_proof", label: "Brak dowodu", tone: "danger" },
  { value: "resolved", label: "Zbita", tone: "success" },
] as const;
type Status = (typeof STATUSES)[number]["value"];

export interface ObjectionItem {
  id: string;
  objectionMd: string;
  responseMd: string | null;
  proofMd: string | null;
  segmentId?: string | null;
  stage: string | null;
  status: string | null;
  priority: number;
}

interface Props {
  projectId: string;
  initial: ObjectionItem[];
  onItemsChange?: (items: { id: string; objectionMd: string }[]) => void;
}

const STATUS_TONE: Record<string, string> = {
  warning: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  danger: "bg-destructive/15 text-destructive border-destructive/30",
  success: "bg-success/15 text-success border-success/30",
};

export function ObjectionsEditor({ projectId, initial, onItemsChange }: Props) {
  const api = `/api/strategy-hub/projects/${projectId}/objections`;
  const { openSidekick } = useHubOverlays();

  const [rows, setRows] = React.useState<ObjectionItem[]>(initial);
  const [selectedId, setSelectedId] = React.useState<string | null>(
    initial[0]?.id ?? null
  );
  const [filterStage, setFilterStage] = React.useState<Stage | "all">("all");
  const [filterStatus, setFilterStatus] = React.useState<Status | "all">("all");
  const [savingField, setSavingField] = React.useState<string | null>(null);
  const [creating, setCreating] = React.useState(false);

  const timers = React.useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map()
  );

  const notifyParent = React.useCallback(
    (next: ObjectionItem[]) => {
      onItemsChange?.(next.map((o) => ({ id: o.id, objectionMd: o.objectionMd })));
    },
    [onItemsChange]
  );

  const selected = rows.find((r) => r.id === selectedId) ?? null;

  const filtered = rows.filter(
    (r) =>
      (filterStage === "all" || r.stage === filterStage) &&
      (filterStatus === "all" || r.status === filterStatus)
  );

  const patchRow = React.useCallback(
    (id: string, patch: Partial<ObjectionItem>) => {
      setRows((prev) => {
        const next = prev.map((r) => (r.id === id ? { ...r, ...patch } : r));
        notifyParent(next);
        return next;
      });
    },
    [notifyParent]
  );

  const saveField = React.useCallback(
    (id: string, field: keyof ObjectionItem, value: unknown, debounce = 600) => {
      patchRow(id, { [field]: value } as Partial<ObjectionItem>);
      const key = `${id}:${field}`;
      const existing = timers.current.get(key);
      if (existing) clearTimeout(existing);
      const t = setTimeout(async () => {
        setSavingField(key);
        try {
          await fetch(`${api}/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ [field]: value }),
          });
        } catch {
          // best-effort
        } finally {
          setSavingField((c) => (c === key ? null : c));
        }
      }, debounce);
      timers.current.set(key, t);
    },
    [api, patchRow]
  );

  const addObjection = React.useCallback(async () => {
    setCreating(true);
    try {
      const res = await fetch(api, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ objectionMd: "Nowa obiekcja", priority: 2 }),
      });
      if (!res.ok) return;
      const { item } = (await res.json()) as { item: ObjectionItem };
      setRows((prev) => {
        const next = [...prev, item];
        notifyParent(next);
        return next;
      });
      setSelectedId(item.id);
    } finally {
      setCreating(false);
    }
  }, [api, notifyParent]);

  const removeObjection = React.useCallback(
    async (id: string) => {
      setRows((prev) => {
        const next = prev.filter((r) => r.id !== id);
        notifyParent(next);
        if (selectedId === id) setSelectedId(next[0]?.id ?? null);
        return next;
      });
      try {
        await fetch(`${api}/${id}`, { method: "DELETE" });
      } catch {
        // best-effort
      }
    },
    [api, notifyParent, selectedId]
  );

  return (
    <div className="grid h-full grid-cols-1 md:grid-cols-[280px_1fr]">
      {/* ── Lewa kolumna: lista + filtry ── */}
      <div className="flex flex-col border-r border-border min-h-0">
        <div className="flex flex-col gap-2 border-b border-border p-3">
          <Button
            type="button"
            size="sm"
            onClick={() => void addObjection()}
            disabled={creating}
            className="w-full"
          >
            {creating ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Plus className="size-3.5" />
            )}
            Dodaj obiekcję
          </Button>
          <div className="flex flex-wrap gap-1">
            <FilterPill active={filterStage === "all"} onClick={() => setFilterStage("all")}>
              Wszystkie fazy
            </FilterPill>
            {STAGES.map((s) => (
              <FilterPill
                key={s}
                active={filterStage === s}
                onClick={() => setFilterStage(s)}
              >
                {s}
              </FilterPill>
            ))}
          </div>
          <div className="flex flex-wrap gap-1">
            <FilterPill active={filterStatus === "all"} onClick={() => setFilterStatus("all")}>
              Każdy status
            </FilterPill>
            {STATUSES.map((s) => (
              <FilterPill
                key={s.value}
                active={filterStatus === s.value}
                onClick={() => setFilterStatus(s.value)}
              >
                {s.label}
              </FilterPill>
            ))}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {filtered.length === 0 ? (
            <p className="p-3 text-xs text-muted-foreground">
              Brak obiekcji dla wybranego filtra.
            </p>
          ) : (
            <ul className="space-y-1">
              {filtered.map((o) => {
                const statusMeta = STATUSES.find((s) => s.value === o.status);
                return (
                  <li key={o.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(o.id)}
                      className={cn(
                        "flex w-full items-start gap-2 rounded-lg border px-2.5 py-2 text-left transition-colors",
                        selectedId === o.id
                          ? "border-brand/40 bg-brand/5"
                          : "border-transparent hover:bg-muted/50"
                      )}
                    >
                      <ShieldQuestion className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-medium">
                          {o.objectionMd || "—"}
                        </span>
                        <span className="mt-1 flex items-center gap-1">
                          {o.stage && (
                            <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                              {o.stage}
                            </span>
                          )}
                          {statusMeta && (
                            <span
                              className={cn(
                                "rounded border px-1.5 py-0.5 text-[10px]",
                                STATUS_TONE[statusMeta.tone]
                              )}
                            >
                              {statusMeta.label}
                            </span>
                          )}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {/* ── Prawa kolumna: edytor 3-blokowy ── */}
      <div className="min-h-0 overflow-y-auto p-5">
        {!selected ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
            <ShieldQuestion className="size-6 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">
              Wybierz lub dodaj obiekcję, aby ją edytować.
            </p>
          </div>
        ) : (
          <div className="mx-auto flex max-w-2xl flex-col gap-5">
            {/* Chipy */}
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-[200px] flex-1">
                <span className="mb-1 block text-[11px] font-medium text-muted-foreground">
                  Segment
                </span>
                <RelationPicker
                  projectId={projectId}
                  entityType="segment"
                  cardinality="single"
                  value={selected.segmentId ?? null}
                  onChange={(v) =>
                    saveField(selected.id, "segmentId", typeof v === "string" ? v : null, 0)
                  }
                  placeholder="Przypisz segment"
                />
              </div>
              <div>
                <label htmlFor="objection-stage" className="mb-1 block text-[11px] font-medium text-muted-foreground">
                  Etap lejka
                </label>
                <select
                  id="objection-stage"
                  value={selected.stage ?? ""}
                  onChange={(e) =>
                    saveField(selected.id, "stage", e.target.value || null, 0)
                  }
                  className="h-9 rounded-md border border-border bg-background px-2 text-sm"
                >
                  <option value="">—</option>
                  {STAGES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="objection-status" className="mb-1 block text-[11px] font-medium text-muted-foreground">
                  Status
                </label>
                <select
                  id="objection-status"
                  value={selected.status ?? "active"}
                  onChange={(e) => saveField(selected.id, "status", e.target.value, 0)}
                  className="h-9 rounded-md border border-border bg-background px-2 text-sm"
                >
                  {STATUSES.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="ml-auto size-9 text-muted-foreground hover:text-destructive"
                onClick={() => void removeObjection(selected.id)}
                aria-label="Usuń obiekcję"
              >
                <Trash2 className="size-4" />
              </Button>
            </div>

            <FieldBlock
              label="Obiekcja"
              hint="Co klient mówi / czego się obawia"
              value={selected.objectionMd}
              saving={savingField === `${selected.id}:objectionMd`}
              onChange={(v) => saveField(selected.id, "objectionMd", v)}
            />
            <FieldBlock
              label="Odpowiedź"
              hint="Jak zbijamy tę obiekcję"
              value={selected.responseMd ?? ""}
              saving={savingField === `${selected.id}:responseMd`}
              onChange={(v) => saveField(selected.id, "responseMd", v)}
            />
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Dowód</p>
                  <p className="text-[11px] text-muted-foreground">
                    Konkretny fakt, case study lub statystyka
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    openSidekick(
                      `Zaproponuj dowód (case study, statystyka lub opinia) zbijający obiekcję: „${selected.objectionMd}". Odpowiedź którą mamy: „${selected.responseMd ?? "(brak)"}".`
                    )
                  }
                >
                  <Sparkles className="size-3.5" />
                  Zaproponuj dowód
                </Button>
              </div>
              <FieldBlock
                label=""
                value={selected.proofMd ?? ""}
                saving={savingField === `${selected.id}:proofMd`}
                onChange={(v) => saveField(selected.id, "proofMd", v)}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function FilterPill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-2 py-0.5 text-[11px] transition-colors",
        active
          ? "border-brand/40 bg-brand/10 text-brand"
          : "border-border text-muted-foreground hover:text-foreground"
      )}
    >
      {children}
    </button>
  );
}

function FieldBlock({
  label,
  hint,
  value,
  saving,
  onChange,
}: {
  label: string;
  hint?: string;
  value: string;
  saving: boolean;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      {label && (
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">{label}</p>
            {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
          </div>
          {saving ? (
            <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
          ) : (
            <Check className="size-3.5 text-success/0" />
          )}
        </div>
      )}
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={label ? 2 : 3}
        className="resize-none text-sm"
        placeholder="…"
      />
    </div>
  );
}
