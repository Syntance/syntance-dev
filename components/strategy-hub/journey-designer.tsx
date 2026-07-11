"use client";

import * as React from "react";
import Link from "next/link";
import {
  Plus,
  Trash2,
  Loader2,
  ArrowLeft,
  ArrowRight,
  Milestone,
  Clock,
  ChevronDown,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type {
  CoverageKey,
  JourneyStageView,
  JourneyView,
} from "@/lib/strategy-hub/journey-data";

/**
 * Journey Designer — edytor podróży zakupowej segmentu (logika Negacza).
 * Pozioma oś etapów: trigger → pytania → nasza akcja → kryterium wyjścia,
 * ownerSide wyznacza granicę MQL/SQL, kropki pokrycia = gap engine.
 * CRUD przez segment-child endpoint `purchase-stages`; pokrycie z /journey.
 */

const COVERAGE_META: Record<
  CoverageKey,
  { label: string; hrefSegment: string }
> = {
  content: { label: "Treść", hrefSegment: "execution/funnel" },
  channel: { label: "Kanał", hrefSegment: "execution/channels" },
  sales: { label: "Sprzedaż", hrefSegment: "execution/sales" },
  exit: { label: "Wyjście", hrefSegment: "execution/funnel" },
  kpi: { label: "KPI", hrefSegment: "measurement/kpi" },
};

const OWNER_OPTIONS = [
  { value: "marketing", label: "M", title: "Marketing prowadzi etap" },
  { value: "shared", label: "M+S", title: "Marketing i sprzedaż wspólnie" },
  { value: "sales", label: "S", title: "Sprzedaż prowadzi etap" },
] as const;

const PHASE_OPTIONS = ["", "TOFU", "MOFU", "BOFU", "retencja"] as const;

interface Props {
  projectId: string;
  initialView: JourneyView;
}

export function JourneyDesigner({ projectId, initialView }: Props) {
  const [view, setView] = React.useState<JourneyView>(initialView);
  const [loading, setLoading] = React.useState(false);
  const [creating, setCreating] = React.useState(false);
  const [expandedIds, setExpandedIds] = React.useState<Set<string>>(new Set());
  const savingTimers = React.useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map()
  );
  const refreshTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const segmentId = view.segmentId;
  const stages = [...view.stages].sort((a, b) => a.orderIdx - b.orderIdx);

  // Automatycznie rozpinaj wszystkie etapy gdy się załadują
  React.useEffect(() => {
    if (stages.length > 0) {
      setExpandedIds(new Set(stages.map((s) => s.id)));
    }
  }, [stages.length]);

  const crudBase = React.useCallback(
    (sid: string) =>
      `/api/strategy-hub/projects/${projectId}/segments/${sid}/purchase-stages`,
    [projectId]
  );

  const refresh = React.useCallback(
    async (sid: string | null) => {
      try {
        const url = new URL(
          `/api/strategy-hub/projects/${projectId}/journey`,
          window.location.origin
        );
        if (sid) url.searchParams.set("segment", sid);
        const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
        if (!res.ok) return;
        const json = (await res.json()) as JourneyView;
        setView(json);
      } catch {
        /* timeout — kolejny refresh naprawi stan */
      }
    },
    [projectId]
  );

  /** Odśwież pokrycie z opóźnieniem (po serii szybkich edycji). */
  const scheduleRefresh = React.useCallback(() => {
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    refreshTimer.current = setTimeout(() => void refresh(segmentId), 1200);
  }, [refresh, segmentId]);

  const selectSegment = async (sid: string) => {
    if (sid === segmentId) return;
    setLoading(true);
    try {
      await refresh(sid);
    } finally {
      setLoading(false);
    }
  };

  const patchLocal = (id: string, patch: Partial<JourneyStageView>) => {
    setView((prev) => ({
      ...prev,
      stages: prev.stages.map((s) => (s.id === id ? { ...s, ...patch } : s)),
    }));
  };

  const saveField = (
    id: string,
    field: keyof JourneyStageView,
    value: unknown,
    debounce = 600
  ) => {
    if (!segmentId) return;
    patchLocal(id, { [field]: value } as Partial<JourneyStageView>);
    const key = `${id}:${field}`;
    const existing = savingTimers.current.get(key);
    if (existing) clearTimeout(existing);
    const t = setTimeout(async () => {
      try {
        await fetch(`${crudBase(segmentId)}/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ [field]: value }),
        });
      } catch {
        /* best-effort */
      }
    }, debounce);
    savingTimers.current.set(key, t);
  };

  const addStage = async () => {
    if (!segmentId) return;
    setCreating(true);
    try {
      const res = await fetch(crudBase(segmentId), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Nowy etap", orderIdx: stages.length }),
      });
      if (res.ok) await refresh(segmentId);
    } finally {
      setCreating(false);
    }
  };

  const removeStage = async (id: string) => {
    if (!segmentId) return;
    setView((prev) => ({
      ...prev,
      stages: prev.stages.filter((s) => s.id !== id),
    }));
    try {
      await fetch(`${crudBase(segmentId)}/${id}`, { method: "DELETE" });
    } finally {
      scheduleRefresh();
    }
  };

  const move = (id: string, dir: -1 | 1) => {
    const idx = stages.findIndex((s) => s.id === id);
    const swapIdx = idx + dir;
    if (idx < 0 || swapIdx < 0 || swapIdx >= stages.length) return;
    const a = stages[idx];
    const b = stages[swapIdx];
    saveField(a.id, "orderIdx", b.orderIdx, 0);
    saveField(b.id, "orderIdx", a.orderIdx, 0);
  };

  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  /** Indeks pierwszego etapu prowadzonego przez sprzedaż = granica MQL/SQL. */
  const boundaryIdx = stages.findIndex(
    (s) => s.ownerSide === "sales" || s.ownerSide === "shared"
  );

  if (view.segments.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border p-8 text-center">
        <Milestone className="mx-auto size-6 text-muted-foreground/50" />
        <p className="mt-2 text-sm text-muted-foreground">
          Najpierw dodaj segment w module Segmenty — podróż zakupowa należy do
          segmentu.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
        <div className="flex flex-wrap gap-1.5">
          {view.segments.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => void selectSegment(s.id)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                segmentId === s.id
                  ? "border-brand/40 bg-brand/10 text-brand"
                  : "border-border text-muted-foreground hover:text-foreground"
              )}
            >
              {s.icon ? `${s.icon} ` : ""}
              {s.name}
            </button>
          ))}
        </div>
        {view.gapCount > 0 && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[11px] font-medium text-amber-600">
            <AlertTriangle className="size-3" />
            {view.gapCount} luk w pokryciu etapów
          </span>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="size-5 animate-spin" />
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-x-auto pb-1">
          <div className="flex h-full min-w-max items-stretch gap-0">
            {stages.map((stage, i) => (
              <React.Fragment key={stage.id}>
                {i > 0 && (
                  <div className="flex w-8 shrink-0 flex-col items-center justify-center gap-1 pt-24">
                    {boundaryIdx === i && (
                      <span
                        className="mb-1 rotate-0 whitespace-nowrap rounded-full border border-teal-500/40 bg-teal-500/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-teal-600"
                        title="Handoff marketing → sprzedaż (granica MQL/SQL) — wynika z pola Prowadzi na etapach"
                      >
                        MQL→SQL
                      </span>
                    )}
                    <ArrowRight className="size-4 text-muted-foreground/50" />
                  </div>
                )}
                <StageCard
                  projectId={projectId}
                  stage={stage}
                  index={i}
                  total={stages.length}
                  expanded={expandedIds.has(stage.id)}
                  onToggleExpanded={() => toggleExpanded(stage.id)}
                  onSave={(field, value, debounce) => {
                    saveField(stage.id, field, value, debounce);
                    if (field === "ownerSide" || field === "phase") scheduleRefresh();
                  }}
                  onMove={(dir) => move(stage.id, dir)}
                  onRemove={() => void removeStage(stage.id)}
                />
              </React.Fragment>
            ))}

            <div className="flex w-56 shrink-0 items-center justify-center">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void addStage()}
                disabled={creating || !segmentId}
                className="gap-1.5"
              >
                {creating ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Plus className="size-3.5" />
                )}
                Dodaj etap podróży
              </Button>
            </div>
          </div>
        </div>
      )}

      <p className="text-[11px] text-muted-foreground">
        Kolumny lejka, procesu sprzedaży i blueprintu wynikają wprost z tych
        etapów. Kropki pod etapem = pokrycie strategii (gap engine) — kliknij,
        aby przejść do właściwego edytora.
      </p>
    </div>
  );
}

function StageCard({
  projectId,
  stage,
  index,
  total,
  expanded,
  onToggleExpanded,
  onSave,
  onMove,
  onRemove,
}: {
  projectId: string;
  stage: JourneyStageView;
  index: number;
  total: number;
  expanded: boolean;
  onToggleExpanded: () => void;
  onSave: (field: keyof JourneyStageView, value: unknown, debounce?: number) => void;
  onMove: (dir: -1 | 1) => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex h-full min-h-0 w-[300px] shrink-0 flex-col gap-2.5 overflow-y-auto rounded-xl border border-border bg-card/40 p-4">
      <div className="flex items-center gap-2">
        <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-brand/10 text-[11px] font-semibold text-brand">
          {index + 1}
        </span>
        <Input
          value={stage.name}
          onChange={(e) => onSave("name", e.target.value)}
          className="h-8 flex-1 border-0 bg-transparent px-0 text-sm font-medium shadow-none focus-visible:ring-0"
        />
        <div className="flex shrink-0 items-center gap-0.5">
          <IconBtn
            icon={ArrowLeft}
            disabled={index === 0}
            onClick={() => onMove(-1)}
            label="Przesuń wcześniej"
          />
          <IconBtn
            icon={ArrowRight}
            disabled={index === total - 1}
            onClick={() => onMove(1)}
            label="Przesuń później"
          />
          <IconBtn icon={Trash2} danger onClick={onRemove} label="Usuń etap" />
        </div>
      </div>

      <div className="flex items-center justify-between gap-2">
        <div
          className="flex items-center rounded-full border border-border p-0.5"
          role="radiogroup"
          aria-label="Kto prowadzi etap"
        >
          {OWNER_OPTIONS.map((o) => (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={stage.ownerSide === o.value}
              title={o.title}
              onClick={() => onSave("ownerSide", o.value, 0)}
              className={cn(
                "rounded-full px-2 py-0.5 text-[10px] font-semibold transition-colors",
                stage.ownerSide === o.value
                  ? o.value === "marketing"
                    ? "bg-brand/15 text-brand"
                    : "bg-teal-500/15 text-teal-600"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {o.label}
            </button>
          ))}
        </div>
        <select
          value={stage.phase ?? ""}
          onChange={(e) => onSave("phase", e.target.value || null, 0)}
          title="Opcjonalny tag fazy — tylko do widoków zbiorczych, nie struktura lejka"
          className="h-6 rounded-md border border-border bg-transparent px-1.5 text-[10px] text-muted-foreground focus-visible:outline-none"
        >
          {PHASE_OPTIONS.map((p) => (
            <option key={p} value={p}>
              {p === "" ? "faza —" : p}
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Clock className="size-3.5 shrink-0" />
        <Input
          value={stage.timeHint ?? ""}
          onChange={(e) => onSave("timeHint", e.target.value)}
          placeholder="np. dzień 1–3"
          className="h-7 border-0 bg-transparent px-0 text-xs shadow-none focus-visible:ring-0"
        />
      </div>

      <Field
        id={`stage-${stage.id}-trigger`}
        label="Trigger — co uruchamia etap"
        value={stage.trigger}
        placeholder="Co sprawia, że klient wchodzi w ten etap…"
        onChange={(v) => onSave("trigger", v)}
      />
      <Field
        id={`stage-${stage.id}-does`}
        label="Co robi klient"
        value={stage.clientDoesMd}
        placeholder="Zachowanie klienta na tym etapie…"
        onChange={(v) => onSave("clientDoesMd", v)}
      />
      <Field
        id={`stage-${stage.id}-questions`}
        label="Pytania klienta"
        value={stage.questions}
        placeholder="Na co klient szuka odpowiedzi…"
        onChange={(v) => onSave("questions", v)}
      />
      <Field
        id={`stage-${stage.id}-action`}
        label="Nasza akcja"
        value={stage.ourActionMd}
        placeholder="Co robimy, żeby przesunąć klienta dalej…"
        onChange={(v) => onSave("ourActionMd", v)}
      />

      <button
        type="button"
        onClick={onToggleExpanded}
        className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground"
        aria-expanded={expanded}
      >
        <ChevronDown
          className={cn("size-3.5 transition-transform", expanded && "rotate-180")}
        />
        {expanded ? "Mniej" : "Emocje, obiekcje, kryterium wyjścia"}
      </button>

      {expanded && (
        <>
          <Field
            id={`stage-${stage.id}-emo`}
            label="Stan emocjonalny"
            value={stage.emotionalState}
            placeholder="Co czuje klient…"
            onChange={(v) => onSave("emotionalState", v)}
          />
          <Field
            id={`stage-${stage.id}-obj`}
            label="Obiekcje etapu"
            value={stage.objections}
            placeholder="Co go blokuje…"
            onChange={(v) => onSave("objections", v)}
          />
          <Field
            id={`stage-${stage.id}-exit`}
            label="Kryterium wyjścia"
            value={stage.exitCriterion}
            placeholder="Po czym poznajemy, że przeszedł dalej…"
            onChange={(v) => onSave("exitCriterion", v)}
          />
        </>
      )}

      <div className="mt-auto flex items-center gap-2 border-t border-border pt-2.5">
        {stage.coverage.map((c) => {
          const meta = COVERAGE_META[c.key];
          const isGap = c.required && !c.ok;
          return (
            <Link
              key={c.key}
              href={`/strategy-hub/projects/${projectId}/${meta.hrefSegment}`}
              title={
                c.ok
                  ? `${meta.label}: jest odpowiedź na etap`
                  : isGap
                    ? `LUKA: brak — ${meta.label.toLowerCase()} dla tego etapu`
                    : `${meta.label}: niewymagane dla tego etapu`
              }
              className="group flex flex-col items-center gap-0.5"
            >
              <span
                className={cn(
                  "size-2.5 rounded-full border transition-transform group-hover:scale-125",
                  c.ok
                    ? "border-emerald-500 bg-emerald-500"
                    : isGap
                      ? "border-amber-500 bg-transparent"
                      : "border-border bg-transparent opacity-50"
                )}
              />
              <span
                className={cn(
                  "text-[9px] leading-none",
                  isGap ? "font-medium text-amber-600" : "text-muted-foreground"
                )}
              >
                {meta.label}
              </span>
            </Link>
          );
        })}
        <span className="ml-auto text-[10px] text-muted-foreground">
          {stage.counts.elements} treści · {stage.counts.salesActivities} akcji
        </span>
      </div>
    </div>
  );
}

function Field({
  id,
  label,
  value,
  placeholder,
  onChange,
}: {
  id: string;
  label: string;
  value: string | null;
  placeholder: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="text-[11px] font-medium text-muted-foreground">
        {label}
      </label>
      <Textarea
        id={id}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        rows={2}
        className="resize-none text-sm"
        placeholder={placeholder}
      />
    </div>
  );
}

function IconBtn({
  icon: Icon,
  onClick,
  disabled,
  danger,
  label,
}: {
  icon: React.ComponentType<{ className?: string }>;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={cn(
        "flex size-6 items-center justify-center rounded text-muted-foreground transition-colors disabled:opacity-30",
        danger
          ? "hover:bg-destructive/10 hover:text-destructive"
          : "hover:bg-muted hover:text-foreground"
      )}
    >
      <Icon className="size-3.5" />
    </button>
  );
}
