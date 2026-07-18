"use client";

import * as React from "react";
import Link from "next/link";
import {
  Plus,
  Trash2,
  Loader2,
  Handshake,
  X,
  ArrowRight,
  DoorOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type {
  AttachmentType,
  SalesBoardData,
} from "@/lib/strategy-hub/sales-board-data";

/**
 * Sales Process Designer — proces sprzedaży jako lustro podróży zakupowej.
 * Te same kolumny (etapy segmentu) co Funnel Board / Blueprint; karty = akcje
 * handlowe; chipy = pitche/skrypty/magnety przypięte relacją „używany w etapie";
 * granica MQL/SQL wynika z ownerSide etapów (edycja w Journey Designerze).
 * Etapy marketingowe są przygaszone, ale widoczne — wspólny obraz (SMarketing).
 */

const ACTIVITY_TYPES = [
  "research",
  "cold call",
  "discovery",
  "demo",
  "oferta",
  "follow-up",
  "negocjacje",
  "onboarding",
] as const;

const ATTACHMENT_BADGE: Record<AttachmentType, { label: string; className: string }> = {
  sales_pitch: { label: "pitch", className: "border-orange-500/40 text-orange-600" },
  sales_script: { label: "skrypt", className: "border-red-500/40 text-red-600" },
  lead_magnet: { label: "magnet", className: "border-amber-500/40 text-amber-600" },
};

interface Props {
  projectId: string;
  initialData: SalesBoardData;
}

export function SalesProcessBoard({ projectId, initialData }: Props) {
  const [data, setData] = React.useState<SalesBoardData>(initialData);
  const [loading, setLoading] = React.useState(false);
  const [creatingStageId, setCreatingStageId] = React.useState<string | null>(null);
  const savingTimers = React.useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map()
  );

  const segmentId = data.segmentId;
  const stages = [...data.stages].sort((a, b) => a.orderIdx - b.orderIdx);
  const boundaryIdx = stages.findIndex(
    (s) => s.ownerSide === "sales" || s.ownerSide === "shared"
  );

  const activitiesBase = React.useCallback(
    (sid: string) =>
      `/api/strategy-hub/projects/${projectId}/segments/${sid}/sales-activities`,
    [projectId]
  );

  const refresh = React.useCallback(
    async (sid: string | null) => {
      try {
        const url = new URL(
          `/api/strategy-hub/projects/${projectId}/sales-board`,
          window.location.origin
        );
        if (sid) url.searchParams.set("segment", sid);
        const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
        if (!res.ok) return;
        setData((await res.json()) as SalesBoardData);
      } catch {
        /* timeout — kolejny refresh naprawi stan */
      }
    },
    [projectId]
  );

  const selectSegment = async (sid: string) => {
    if (sid === segmentId) return;
    setLoading(true);
    try {
      await refresh(sid);
    } finally {
      setLoading(false);
    }
  };

  const addActivity = async (stageId: string) => {
    if (!segmentId) return;
    setCreatingStageId(stageId);
    try {
      const count = data.activities.filter((a) => a.stageId === stageId).length;
      const res = await fetch(activitiesBase(segmentId), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stageId, name: "Nowa akcja", orderIdx: count }),
      });
      if (res.ok) await refresh(segmentId);
    } finally {
      setCreatingStageId(null);
    }
  };

  const saveActivity = (id: string, field: string, value: unknown, debounce = 600) => {
    if (!segmentId) return;
    setData((prev) => ({
      ...prev,
      activities: prev.activities.map((a) =>
        a.id === id ? { ...a, [field]: value } : a
      ),
    }));
    const key = `${id}:${field}`;
    const existing = savingTimers.current.get(key);
    if (existing) clearTimeout(existing);
    const t = setTimeout(async () => {
      try {
        await fetch(`${activitiesBase(segmentId)}/${id}`, {
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

  const removeActivity = async (id: string) => {
    if (!segmentId) return;
    setData((prev) => ({
      ...prev,
      activities: prev.activities.filter((a) => a.id !== id),
    }));
    try {
      await fetch(`${activitiesBase(segmentId)}/${id}`, { method: "DELETE" });
    } catch {
      /* best-effort */
    }
  };

  const attach = async (stageId: string, refValue: string) => {
    if (!refValue) return;
    const [type, id] = refValue.split("|");
    try {
      await fetch(`/api/strategy-hub/projects/${projectId}/relations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: { type, id },
          target: { type: "stage", id: stageId },
          relationType: "uzywany_w_etapie",
        }),
        signal: AbortSignal.timeout(8000),
      });
    } finally {
      await refresh(segmentId);
    }
  };

  const detach = async (relationId: string) => {
    setData((prev) => ({
      ...prev,
      attachments: prev.attachments.filter((a) => a.relationId !== relationId),
    }));
    try {
      await fetch(
        `/api/strategy-hub/projects/${projectId}/relations/${relationId}`,
        { method: "DELETE" }
      );
    } catch {
      /* best-effort */
    }
  };

  /** Przypina odpowiedź do obiekcji: relacja materiał → obiekcja `oslabia`. */
  const pinAnswer = async (objectionId: string, refValue: string) => {
    if (!refValue) return;
    const [type, id] = refValue.split("|");
    try {
      await fetch(`/api/strategy-hub/projects/${projectId}/relations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: { type, id },
          target: { type: "objection", id: objectionId },
          relationType: "oslabia",
        }),
        signal: AbortSignal.timeout(8000),
      });
    } finally {
      await refresh(segmentId);
    }
  };

  const unpinAnswer = async (objectionId: string, relationId: string) => {
    setData((prev) => ({
      ...prev,
      objections: prev.objections.map((o) =>
        o.id === objectionId
          ? { ...o, answers: o.answers.filter((a) => a.relationId !== relationId) }
          : o
      ),
    }));
    try {
      await fetch(
        `/api/strategy-hub/projects/${projectId}/relations/${relationId}`,
        { method: "DELETE" }
      );
    } catch {
      /* best-effort */
    }
  };

  if (data.segments.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border p-8 text-center">
        <Handshake className="mx-auto size-6 text-muted-foreground/50" />
        <p className="mt-2 text-sm text-muted-foreground">
          Najpierw dodaj segment i jego podróż zakupową — proces sprzedaży jest
          lustrem etapów zakupu.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="flex shrink-0 flex-wrap gap-1.5 border-b border-border pb-3">
        {data.segments.map((s) => (
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

      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="size-5 animate-spin" />
        </div>
      ) : stages.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          Ten segment nie ma etapów zakupu —{" "}
          <Link
            href={`/strategy-hub/projects/${projectId}/market/journey`}
            className="font-medium text-brand hover:underline"
          >
            zdefiniuj podróż zakupową
          </Link>
          .
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-x-auto pb-1">
          <div className="flex h-full min-w-max items-stretch gap-0">
            {stages.map((stage, i) => {
              const marketingOwned = stage.ownerSide === "marketing";
              const stageActivities = data.activities
                .filter((a) => a.stageId === stage.id)
                .sort((a, b) => a.orderIdx - b.orderIdx);
              const stageAttachments = data.attachments.filter(
                (a) => a.stageId === stage.id
              );
              const attachedRefs = new Set(
                stageAttachments.map((a) => `${a.type}|${a.id}`)
              );
              const available = data.library.filter(
                (l) => !attachedRefs.has(`${l.type}|${l.id}`)
              );

              return (
                <React.Fragment key={stage.id}>
                  {i > 0 && (
                    <div className="flex w-8 shrink-0 flex-col items-center justify-center gap-1 pt-16">
                      {boundaryIdx === i && (
                        <span
                          className="mb-1 whitespace-nowrap rounded-full border border-teal-500/40 bg-teal-500/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-teal-600"
                          title="Handoff marketing → sprzedaż (granica MQL/SQL)"
                        >
                          MQL→SQL
                        </span>
                      )}
                      <ArrowRight className="size-4 text-muted-foreground/50" />
                    </div>
                  )}

                  <div
                    className={cn(
                      "flex h-full min-h-0 w-[280px] shrink-0 flex-col gap-2.5 overflow-y-auto rounded-xl border border-border bg-card/40 p-4",
                      marketingOwned && "opacity-60"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-teal-500/10 text-[11px] font-semibold text-teal-600">
                        {i + 1}
                      </span>
                      <span className="flex-1 truncate text-sm font-medium">
                        {stage.name}
                      </span>
                      <span
                        className={cn(
                          "shrink-0 rounded-full border px-1.5 py-0.5 text-[9px] font-semibold uppercase",
                          marketingOwned
                            ? "border-border text-muted-foreground"
                            : "border-teal-500/40 text-teal-600"
                        )}
                        title="Kto prowadzi etap — edycja w Podróży zakupowej"
                      >
                        {stage.ownerSide === "marketing"
                          ? "marketing"
                          : stage.ownerSide === "shared"
                            ? "wspólny"
                            : "sprzedaż"}
                      </span>
                    </div>

                    {marketingOwned ? (
                      <p className="text-[11px] text-muted-foreground">
                        Etap prowadzi marketing — handlowiec widzi kontekst, akcje
                        planuj od granicy MQL→SQL.
                      </p>
                    ) : null}

                    <div className="space-y-1.5">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Akcje handlowe
                      </p>
                      {stageActivities.length === 0 && !marketingOwned && (
                        <p className="rounded-md border border-dashed border-amber-500/50 px-2 py-1.5 text-[11px] text-amber-600">
                          luka: brak akcji sprzedażowej na tym etapie
                        </p>
                      )}
                      {stageActivities.map((a) => (
                        <div
                          key={a.id}
                          className="space-y-1 rounded-lg border border-border bg-card p-2"
                        >
                          <div className="flex items-center gap-1">
                            <Input
                              value={a.name}
                              onChange={(e) =>
                                saveActivity(a.id, "name", e.target.value)
                              }
                              aria-label="Nazwa akcji handlowej"
                              className="h-7 flex-1 border-0 bg-transparent px-0 text-xs font-medium shadow-none focus-visible:ring-0"
                            />
                            <button
                              type="button"
                              onClick={() => void removeActivity(a.id)}
                              aria-label="Usuń akcję"
                              className="flex size-5 items-center justify-center rounded text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                            >
                              <Trash2 className="size-3" />
                            </button>
                          </div>
                          <select
                            value={a.type ?? ""}
                            onChange={(e) =>
                              saveActivity(a.id, "type", e.target.value || null, 0)
                            }
                            aria-label="Typ akcji handlowej"
                            className="h-6 w-full rounded-md border border-border bg-transparent px-1.5 text-[10px] text-muted-foreground focus-visible:outline-none"
                          >
                            <option value="">typ akcji —</option>
                            {ACTIVITY_TYPES.map((t) => (
                              <option key={t} value={t}>
                                {t}
                              </option>
                            ))}
                          </select>
                        </div>
                      ))}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => void addActivity(stage.id)}
                        disabled={creatingStageId === stage.id}
                        className="h-7 w-full gap-1 text-[11px]"
                      >
                        {creatingStageId === stage.id ? (
                          <Loader2 className="size-3 animate-spin" />
                        ) : (
                          <Plus className="size-3" />
                        )}
                        Dodaj akcję
                      </Button>
                    </div>

                    <div className="space-y-1.5">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Materiały etapu
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {stageAttachments.map((a) => (
                          <span
                            key={a.relationId}
                            className={cn(
                              "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px]",
                              ATTACHMENT_BADGE[a.type].className
                            )}
                          >
                            <span className="text-muted-foreground">
                              {ATTACHMENT_BADGE[a.type].label}:
                            </span>
                            <span className="max-w-[120px] truncate">{a.label}</span>
                            <button
                              type="button"
                              onClick={() => void detach(a.relationId)}
                              aria-label={`Odepnij ${a.label}`}
                              className="text-muted-foreground hover:text-destructive"
                            >
                              <X className="size-2.5" />
                            </button>
                          </span>
                        ))}
                      </div>
                      {available.length > 0 && (
                        <select
                          value=""
                          onChange={(e) => void attach(stage.id, e.target.value)}
                          className="h-6 w-full rounded-md border border-dashed border-border bg-transparent px-1.5 text-[10px] text-muted-foreground focus-visible:outline-none"
                          aria-label="Przypnij pitch, skrypt lub lead magnet do etapu"
                        >
                          <option value="">+ przypnij pitch / skrypt / magnet…</option>
                          {available.map((l) => (
                            <option key={`${l.type}|${l.id}`} value={`${l.type}|${l.id}`}>
                              {ATTACHMENT_BADGE[l.type].label}: {l.label}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>

                    {stage.objections?.trim() ? (
                      <div className="space-y-1">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                          Obiekcje etapu
                        </p>
                        <p className="whitespace-pre-wrap text-[11px] text-muted-foreground">
                          {stage.objections}
                        </p>
                      </div>
                    ) : null}

                    {stage.exitCriterion?.trim() ? (
                      <div className="mt-auto flex items-start gap-1.5 border-t border-border pt-2 text-[11px] text-muted-foreground">
                        <DoorOpen className="mt-0.5 size-3 shrink-0" />
                        <span>
                          <span className="font-medium">Wyjście:</span>{" "}
                          {stage.exitCriterion}
                        </span>
                      </div>
                    ) : null}
                  </div>
                </React.Fragment>
              );
            })}
          </div>
        </div>
      )}

      {data.objections.length > 0 && !loading && (
        <div className="shrink-0 space-y-2 border-t border-border pt-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Obiekcje segmentu — odpowiedzi sprzedaży
            </p>
            <Link
              href={`/strategy-hub/projects/${projectId}/foundation/business`}
              className="text-[10px] text-brand hover:underline"
            >
              edytuj obiekcje
            </Link>
          </div>
          <div className="grid gap-1.5 sm:grid-cols-2 xl:grid-cols-3">
            {data.objections.map((o) => {
              const answered = o.hasResponse || o.answers.length > 0;
              const pinnedRefs = new Set(o.answers.map((a) => `${a.type}|${a.id}`));
              const availableAnswers = data.library.filter(
                (l) => !pinnedRefs.has(`${l.type}|${l.id}`)
              );
              return (
                <div
                  key={o.id}
                  className={cn(
                    "space-y-1.5 rounded-lg border p-2",
                    answered ? "border-border bg-card/40" : "border-amber-500/40 bg-amber-500/5"
                  )}
                >
                  <p className="line-clamp-2 text-[11px] text-foreground/90">
                    {o.objectionMd}
                  </p>
                  {!answered && (
                    <p className="text-[10px] font-medium text-amber-600">
                      luka: obiekcja bez odpowiedzi
                    </p>
                  )}
                  <div className="flex flex-wrap items-center gap-1">
                    {o.hasResponse && (
                      <span className="rounded-full border border-emerald-500/40 px-2 py-0.5 text-[10px] text-emerald-600">
                        odpowiedź spisana
                      </span>
                    )}
                    {o.answers.map((a) => (
                      <span
                        key={a.relationId}
                        className={cn(
                          "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px]",
                          ATTACHMENT_BADGE[a.type].className
                        )}
                        title="Materiał osłabiający obiekcję (relacja „osłabia”)"
                      >
                        <span className="max-w-[110px] truncate">{a.label}</span>
                        <button
                          type="button"
                          onClick={() => void unpinAnswer(o.id, a.relationId)}
                          aria-label={`Odepnij odpowiedź ${a.label}`}
                          className="text-muted-foreground hover:text-destructive"
                        >
                          <X className="size-2.5" />
                        </button>
                      </span>
                    ))}
                  </div>
                  {availableAnswers.length > 0 && (
                    <select
                      value=""
                      onChange={(e) => void pinAnswer(o.id, e.target.value)}
                      aria-label="Przypnij odpowiedź osłabiającą obiekcję"
                      className="h-6 w-full rounded-md border border-dashed border-border bg-transparent px-1.5 text-[10px] text-muted-foreground focus-visible:outline-none"
                    >
                      <option value="">+ przypnij odpowiedź (pitch / skrypt / magnet)…</option>
                      {availableAnswers.map((l) => (
                        <option key={`${l.type}|${l.id}`} value={`${l.type}|${l.id}`}>
                          {ATTACHMENT_BADGE[l.type].label}: {l.label}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <p className="text-[11px] text-muted-foreground">
        Kolumny = etapy podróży zakupowej segmentu (edycja: Rynek → Podróż
        zakupowa). Granica MQL→SQL wynika z pola &bdquo;Prowadzi&rdquo; na etapach.
        Obiekcja bez odpowiedzi (spisanej lub przypiętej relacją „osłabia”) = luka.
      </p>
    </div>
  );
}
