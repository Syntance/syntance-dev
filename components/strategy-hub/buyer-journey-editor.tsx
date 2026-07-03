"use client";

import * as React from "react";
import Link from "next/link";
import {
  Plus,
  Trash2,
  Loader2,
  ArrowUp,
  ArrowDown,
  Milestone,
  Clock,
  Workflow,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RelationPicker } from "@/components/strategy-hub/relation-picker";
import { upsertFunnelElement } from "@/lib/strategy-hub/actions";

interface SegmentOption {
  id: string;
  name: string;
  code: string | null;
}

interface Stage {
  id: string;
  segmentId: string;
  name: string;
  whatDoesMd: string | null;
  timeHint: string | null;
  ourActionMd: string | null;
  orderIdx: number;
}

interface Props {
  projectId: string;
  segments: SegmentOption[];
  initialSegmentId: string | null;
  initialStages: Stage[];
}

/**
 * Customer Journey — mapa etapów podróży klienta per segment (Faza 3, M1).
 * `buyer_journey_stages` jest dzieckiem segmentu; ten widok agreguje edycję
 * ponad wszystkimi segmentami projektu w jednym miejscu (spec: /market/journey).
 */
export function BuyerJourneyEditor({
  projectId,
  segments,
  initialSegmentId,
  initialStages,
}: Props) {
  const [activeSegmentId, setActiveSegmentId] = React.useState<string | null>(
    initialSegmentId
  );
  const [stagesBySegment, setStagesBySegment] = React.useState<Record<string, Stage[]>>(
    () => (initialSegmentId ? { [initialSegmentId]: initialStages } : {})
  );
  const [loading, setLoading] = React.useState(false);
  const [creating, setCreating] = React.useState(false);
  const [promotingId, setPromotingId] = React.useState<string | null>(null);
  const [promoteTarget, setPromoteTarget] = React.useState<string | null>(null);
  const [promoting, setPromoting] = React.useState(false);
  const [promotedIds, setPromotedIds] = React.useState<Set<string>>(new Set());
  const savingTimers = React.useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map()
  );

  const base = React.useCallback(
    (segmentId: string) =>
      `/api/strategy-hub/projects/${projectId}/segments/${segmentId}/buyer-journey`,
    [projectId]
  );

  const stages = activeSegmentId ? stagesBySegment[activeSegmentId] ?? [] : [];
  const sorted = [...stages].sort((a, b) => a.orderIdx - b.orderIdx);

  const selectSegment = React.useCallback(
    async (segmentId: string) => {
      setActiveSegmentId(segmentId);
      if (stagesBySegment[segmentId]) return;
      setLoading(true);
      try {
        const res = await fetch(base(segmentId));
        const j = (await res.json()) as { items: Stage[] };
        setStagesBySegment((prev) => ({ ...prev, [segmentId]: j.items ?? [] }));
      } finally {
        setLoading(false);
      }
    },
    [stagesBySegment, base]
  );

  const patchLocal = (segmentId: string, id: string, patch: Partial<Stage>) => {
    setStagesBySegment((prev) => ({
      ...prev,
      [segmentId]: (prev[segmentId] ?? []).map((s) =>
        s.id === id ? { ...s, ...patch } : s
      ),
    }));
  };

  const saveField = (
    segmentId: string,
    id: string,
    field: keyof Stage,
    value: unknown,
    debounce = 600
  ) => {
    patchLocal(segmentId, id, { [field]: value } as Partial<Stage>);
    const key = `${id}:${field}`;
    const existing = savingTimers.current.get(key);
    if (existing) clearTimeout(existing);
    const t = setTimeout(async () => {
      try {
        await fetch(`${base(segmentId)}/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ [field]: value }),
        });
      } catch {
        // best-effort
      }
    }, debounce);
    savingTimers.current.set(key, t);
  };

  const addStage = async (segmentId: string) => {
    setCreating(true);
    try {
      const orderIdx = (stagesBySegment[segmentId]?.length ?? 0);
      const res = await fetch(base(segmentId), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Nowy etap", orderIdx }),
      });
      if (!res.ok) return;
      const { item } = (await res.json()) as { item: Stage };
      setStagesBySegment((prev) => ({
        ...prev,
        [segmentId]: [...(prev[segmentId] ?? []), item],
      }));
    } finally {
      setCreating(false);
    }
  };

  const removeStage = async (segmentId: string, id: string) => {
    setStagesBySegment((prev) => ({
      ...prev,
      [segmentId]: (prev[segmentId] ?? []).filter((s) => s.id !== id),
    }));
    try {
      await fetch(`${base(segmentId)}/${id}`, { method: "DELETE" });
    } catch {
      // best-effort
    }
  };

  const promoteToFunnel = async (stage: Stage) => {
    if (!promoteTarget) return;
    setPromoting(true);
    try {
      await upsertFunnelElement({
        projectId,
        segmentId: stage.segmentId,
        stageId: promoteTarget,
        name: stage.name,
        contentMd: stage.ourActionMd ?? undefined,
        position: 0,
      });
      setPromotedIds((prev) => new Set(prev).add(stage.id));
      setPromotingId(null);
      setPromoteTarget(null);
    } finally {
      setPromoting(false);
    }
  };

  const move = (segmentId: string, id: string, dir: -1 | 1) => {
    const list = [...(stagesBySegment[segmentId] ?? [])].sort(
      (a, b) => a.orderIdx - b.orderIdx
    );
    const idx = list.findIndex((s) => s.id === id);
    const swapIdx = idx + dir;
    if (idx < 0 || swapIdx < 0 || swapIdx >= list.length) return;
    const a = list[idx];
    const b = list[swapIdx];
    const aOrder = b.orderIdx;
    const bOrder = a.orderIdx;
    patchLocal(segmentId, a.id, { orderIdx: aOrder });
    patchLocal(segmentId, b.id, { orderIdx: bOrder });
    saveField(segmentId, a.id, "orderIdx", aOrder, 0);
    saveField(segmentId, b.id, "orderIdx", bOrder, 0);
  };

  if (segments.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border p-8 text-center">
        <Milestone className="mx-auto size-6 text-muted-foreground/50" />
        <p className="mt-2 text-sm text-muted-foreground">
          Najpierw dodaj segment w module Segmenty, aby zmapować jego podróż klienta.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5 border-b border-border pb-3">
        {segments.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => void selectSegment(s.id)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
              activeSegmentId === s.id
                ? "border-brand/40 bg-brand/10 text-brand"
                : "border-border text-muted-foreground hover:text-foreground"
            )}
          >
            {s.name}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="size-5 animate-spin" />
        </div>
      ) : !activeSegmentId ? null : (
        <div className="space-y-3">
          {sorted.length === 0 && (
            <p className="py-4 text-sm text-muted-foreground">
              Brak etapów podróży dla tego segmentu. Dodaj pierwszy etap.
            </p>
          )}
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {sorted.map((stage, i) => (
              <div
                key={stage.id}
                className="flex flex-col gap-2.5 rounded-xl border border-border bg-card/40 p-4"
              >
                <div className="flex items-center gap-2">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-brand/10 text-[11px] font-semibold text-brand">
                    {i + 1}
                  </span>
                  <Input
                    value={stage.name}
                    onChange={(e) =>
                      saveField(activeSegmentId, stage.id, "name", e.target.value)
                    }
                    className="h-8 flex-1 border-0 bg-transparent px-0 text-sm font-medium shadow-none focus-visible:ring-0"
                  />
                  <div className="flex shrink-0 items-center gap-0.5">
                    <IconBtn
                      icon={ArrowUp}
                      disabled={i === 0}
                      onClick={() => move(activeSegmentId, stage.id, -1)}
                      label="Przesuń wyżej"
                    />
                    <IconBtn
                      icon={ArrowDown}
                      disabled={i === sorted.length - 1}
                      onClick={() => move(activeSegmentId, stage.id, 1)}
                      label="Przesuń niżej"
                    />
                    <IconBtn
                      icon={Trash2}
                      danger
                      onClick={() => void removeStage(activeSegmentId, stage.id)}
                      label="Usuń etap"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Clock className="size-3.5" />
                  <Input
                    value={stage.timeHint ?? ""}
                    onChange={(e) =>
                      saveField(activeSegmentId, stage.id, "timeHint", e.target.value)
                    }
                    placeholder="np. dzień 1–3"
                    className="h-7 border-0 bg-transparent px-0 text-xs shadow-none focus-visible:ring-0"
                  />
                </div>

                <div className="space-y-1">
                  <label htmlFor={`stage-${stage.id}-what`} className="text-[11px] font-medium text-muted-foreground">
                    Co robi klient
                  </label>
                  <Textarea
                    id={`stage-${stage.id}-what`}
                    value={stage.whatDoesMd ?? ""}
                    onChange={(e) =>
                      saveField(activeSegmentId, stage.id, "whatDoesMd", e.target.value)
                    }
                    rows={2}
                    className="resize-none text-sm"
                    placeholder="Zachowanie klienta na tym etapie…"
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor={`stage-${stage.id}-action`} className="text-[11px] font-medium text-muted-foreground">
                    Nasza akcja
                  </label>
                  <Textarea
                    id={`stage-${stage.id}-action`}
                    value={stage.ourActionMd ?? ""}
                    onChange={(e) =>
                      saveField(activeSegmentId, stage.id, "ourActionMd", e.target.value)
                    }
                    rows={2}
                    className="resize-none text-sm"
                    placeholder="Co robimy, żeby przesunąć klienta dalej…"
                  />
                </div>

                <div className="border-t border-border pt-2.5">
                  {promotedIds.has(stage.id) ? (
                    <Link
                      href={`/strategy-hub/projects/${projectId}/execution/funnel`}
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-success hover:underline"
                    >
                      <Check className="size-3.5" /> Przekute na lejek — otwórz
                    </Link>
                  ) : promotingId === stage.id ? (
                    <div className="flex items-center gap-2">
                      <div className="flex-1">
                        <RelationPicker
                          projectId={projectId}
                          entityType="purchase_stage"
                          cardinality="single"
                          value={promoteTarget}
                          filterSegmentId={activeSegmentId ?? undefined}
                          onChange={(v) =>
                            setPromoteTarget(typeof v === "string" ? v : null)
                          }
                          placeholder="Wybierz etap lejka…"
                        />
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        className="h-8 shrink-0"
                        disabled={!promoteTarget || promoting}
                        onClick={() => void promoteToFunnel(stage)}
                      >
                        {promoting ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          "OK"
                        )}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-8 shrink-0"
                        onClick={() => {
                          setPromotingId(null);
                          setPromoteTarget(null);
                        }}
                      >
                        Anuluj
                      </Button>
                    </div>
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-8 gap-1.5 text-xs"
                      onClick={() => {
                        setPromotingId(stage.id);
                        setPromoteTarget(null);
                      }}
                    >
                      <Workflow className="size-3.5" /> Przekuj na lejek
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void addStage(activeSegmentId)}
            disabled={creating}
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
      )}
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
        danger ? "hover:bg-destructive/10 hover:text-destructive" : "hover:bg-muted hover:text-foreground"
      )}
    >
      <Icon className="size-3.5" />
    </button>
  );
}
