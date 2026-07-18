"use client";

import * as React from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import {
  Plus,
  X,
  Trash2,
  Loader2,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Filter,
  Megaphone,
  Magnet,
  Radio,
  Route,
  Target,
  AlertTriangle,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { pluralCount } from "@/lib/strategy-hub/pluralize";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { upsertFunnelElement, deleteFunnelElement } from "@/lib/strategy-hub/actions";
import type { CoverageKey, JourneyView } from "@/lib/strategy-hub/journey-data";
import { COVERAGE_LABELS } from "@/lib/strategy-hub/coverage";
import { FunnelChannelsPanel } from "./funnel-channels-panel";

/**
 * Warsztat lejka marketingowego — dedykowany, pełnoekranowy edytor modułu.
 * Trzy strefy: WPŁYW (co zasila lejek: podróż, kampanie, magnety, kanały)
 * → LEJEK (kolumny etapów zakupu z kartami treści, edycja karta-po-karcie)
 * → EFEKT (pokrycie etapów, luki, postęp) / edytor wybranego elementu.
 * Mapa relacji (React Flow) i plan kanałów zostają jako osobne zakładki.
 */

const FunnelBoard = dynamic(
  () => import("./funnel-board").then((m) => m.FunnelBoard),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center gap-2 rounded-xl border border-border text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Ładowanie mapy relacji…
      </div>
    ),
  }
);

// ── Typy odpowiedzi /funnel-board ────────────────────────────────────────────

interface StageRow {
  id: string;
  segmentId: string;
  name: string;
  phase: string | null;
  orderIdx: number | null;
  ownerSide: string;
}
interface ElementRow {
  id: string;
  stageId: string;
  segmentId: string | null;
  name: string;
  format: string | null;
  status: string | null;
  position: number | null;
  contentMd: string | null;
  cta: string | null;
  ctaUrl: string | null;
}
interface BoardData {
  segments: { id: string; name: string }[];
  stages: StageRow[];
  elements: ElementRow[];
  elementChannels: { funnelElementId: string; channelId: string }[];
  elementCampaigns: {
    relationId: string;
    funnelElementId: string;
    campaignId: string;
  }[];
  magnetStages: { relationId: string; leadMagnetId: string; stageId: string }[];
  elementNextStages: {
    relationId: string;
    funnelElementId: string;
    stageId: string;
  }[];
  channels: { id: string; name: string; icon: string | null }[];
  campaigns: {
    id: string;
    name: string;
    segmentId: string | null;
    stageId: string | null;
  }[];
  leadMagnets: { id: string; name: string; segmentId: string | null }[];
}

// ── Słowniki UI ──────────────────────────────────────────────────────────────

const FORMAT_OPTIONS = [
  "Artykuł",
  "Post",
  "Video",
  "Webinar",
  "Case study",
  "E-book",
  "Landing",
  "E-mail",
  "Kalkulator",
  "Inne",
];

const STATUS_META: Record<string, { label: string; dot: string }> = {
  draft: { label: "szkic", dot: "bg-zinc-400" },
  in_progress: { label: "w przygotowaniu", dot: "bg-amber-500" },
  published: { label: "opublikowany", dot: "bg-emerald-500" },
};

type WorkspaceView = "editor" | "map" | "channels";

interface Props {
  projectId: string;
  projectName: string;
}

// ─────────────────────────────────────────────────────────────────────────────

export function FunnelWorkspace({ projectId, projectName }: Props) {
  const [board, setBoard] = React.useState<BoardData | null>(null);
  const [journey, setJourney] = React.useState<JourneyView | null>(null);
  const [segmentId, setSegmentId] = React.useState<string>("");
  const [view, setView] = React.useState<WorkspaceView>("editor");
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = React.useState<string | null>(null);
  const saveTimers = React.useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map()
  );

  const hub = `/strategy-hub/projects/${projectId}`;
  const api = `/api/strategy-hub/projects/${projectId}`;

  const fetchBoard = React.useCallback(async (): Promise<BoardData | null> => {
    try {
      const res = await fetch(`${api}/funnel-board`, {
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) return null;
      return (await res.json()) as BoardData;
    } catch {
      return null;
    }
  }, [api]);

  const fetchJourney = React.useCallback(
    async (sid: string): Promise<JourneyView | null> => {
      try {
        const url = sid
          ? `${api}/journey?segment=${sid}`
          : `${api}/journey`;
        const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
        if (!res.ok) return null;
        return (await res.json()) as JourneyView;
      } catch {
        return null;
      }
    },
    [api]
  );

  const refresh = React.useCallback(
    async (sid?: string) => {
      // Najpierw plansza — z niej wynika efektywny segment; journey MUSI być
      // pobrane dla tego samego segmentu, inaczej pokrycie opisuje inny lejek.
      const b = await fetchBoard();
      let target = sid ?? segmentId;
      if (b) {
        setBoard(b);
        if (!b.segments.some((s) => s.id === target)) {
          target = b.segments[0]?.id ?? "";
        }
        setSegmentId(target);
      }
      if (target) {
        const j = await fetchJourney(target);
        if (j) setJourney(j);
      }
    },
    [segmentId, fetchBoard, fetchJourney]
  );

  React.useEffect(() => {
    void (async () => {
      await refresh();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- tylko pierwszy load
  }, []);

  const selectSegment = async (sid: string) => {
    setSegmentId(sid);
    setSelectedId(null);
    const j = await fetchJourney(sid);
    if (j) setJourney(j);
  };

  // ── Widoki pochodne ────────────────────────────────────────────────────────

  const stages = React.useMemo(
    () =>
      (board?.stages ?? [])
        .filter((s) => s.segmentId === segmentId)
        .sort((a, b) => (a.orderIdx ?? 0) - (b.orderIdx ?? 0)),
    [board, segmentId]
  );
  const stageIds = React.useMemo(() => new Set(stages.map((s) => s.id)), [stages]);
  const elements = React.useMemo(
    () =>
      (board?.elements ?? [])
        .filter((e) => stageIds.has(e.stageId))
        .sort((a, b) => (a.position ?? 0) - (b.position ?? 0)),
    [board, stageIds]
  );
  const elementIds = React.useMemo(
    () => new Set(elements.map((e) => e.id)),
    [elements]
  );
  const selected = elements.find((e) => e.id === selectedId) ?? null;

  const journeyByStage = React.useMemo(() => {
    const map = new Map<string, JourneyView["stages"][number]>();
    for (const s of journey?.stages ?? []) map.set(s.id, s);
    return map;
  }, [journey]);

  const boundaryIdx = stages.findIndex(
    (s) => s.ownerSide === "sales" || s.ownerSide === "shared"
  );

  const coverageStats = React.useMemo(() => {
    let required = 0;
    let ok = 0;
    for (const s of journey?.stages ?? []) {
      for (const c of s.coverage) {
        if (!c.required) continue;
        required += 1;
        if (c.ok) ok += 1;
      }
    }
    return { required, ok, pct: required ? Math.round((ok / required) * 100) : 0 };
  }, [journey]);

  // Powiązania wybranego elementu (podświetlanie w lewej szynie).
  const selectedChannelIds = React.useMemo(
    () =>
      new Set(
        (board?.elementChannels ?? [])
          .filter((ec) => ec.funnelElementId === selectedId)
          .map((ec) => ec.channelId)
      ),
    [board, selectedId]
  );
  const selectedCampaignIds = React.useMemo(
    () =>
      new Set(
        (board?.elementCampaigns ?? [])
          .filter((ec) => ec.funnelElementId === selectedId)
          .map((ec) => ec.campaignId)
      ),
    [board, selectedId]
  );

  // ── Mutacje ────────────────────────────────────────────────────────────────

  const elementPayload = (el: ElementRow) => ({
    projectId,
    id: el.id,
    stageId: el.stageId,
    segmentId: el.segmentId,
    name: el.name || "Bez nazwy",
    position: el.position ?? 0,
    contentMd: el.contentMd ?? undefined,
    cta: el.cta ?? undefined,
    ctaUrl: el.ctaUrl ?? undefined,
    format: el.format ?? undefined,
    status: el.status ?? undefined,
  });

  const patchElement = (id: string, patch: Partial<ElementRow>, debounce = 600) => {
    setBoard((prev) =>
      prev
        ? {
            ...prev,
            elements: prev.elements.map((e) =>
              e.id === id ? { ...e, ...patch } : e
            ),
          }
        : prev
    );
    const key = `el:${id}`;
    const existing = saveTimers.current.get(key);
    if (existing) clearTimeout(existing);
    const t = setTimeout(() => {
      setBoard((prev) => {
        const el = prev?.elements.find((e) => e.id === id);
        if (el) void upsertFunnelElement(elementPayload(el));
        return prev;
      });
      // Pokrycie mogło się zmienić dopiero po zapisie relacji — journey
      // odświeżamy tylko przy zmianach strukturalnych, nie przy literach.
    }, debounce);
    saveTimers.current.set(key, t);
  };

  const moveElement = async (el: ElementRow, targetStageId: string) => {
    if (targetStageId === el.stageId) return;
    const count = elements.filter((e) => e.stageId === targetStageId).length;
    setBoard((prev) =>
      prev
        ? {
            ...prev,
            elements: prev.elements.map((e) =>
              e.id === el.id ? { ...e, stageId: targetStageId, position: count } : e
            ),
          }
        : prev
    );
    await upsertFunnelElement({
      ...elementPayload(el),
      stageId: targetStageId,
      position: count,
    });
    await refresh();
  };

  const addElement = async (stageId: string) => {
    const before = new Set(elements.map((e) => e.id));
    await upsertFunnelElement({
      projectId,
      stageId,
      segmentId,
      name: "Nowa treść",
      position: elements.filter((e) => e.stageId === stageId).length,
      status: "draft",
    });
    const b = await fetchBoard();
    if (b) {
      setBoard(b);
      const fresh = b.elements.find(
        (e) => e.stageId === stageId && !before.has(e.id)
      );
      if (fresh) setSelectedId(fresh.id);
    }
    const j = await fetchJourney(segmentId);
    if (j) setJourney(j);
  };

  // Kolumny lejka SĄ etapami podróży zakupowej — rename i dodanie etapu
  // działają wprost na segment-child `purchase-stages`.
  const stagesBase = `${api}/segments/${segmentId}/purchase-stages`;

  const renameStage = (stage: StageRow, name: string) => {
    setBoard((prev) =>
      prev
        ? {
            ...prev,
            stages: prev.stages.map((s) =>
              s.id === stage.id ? { ...s, name } : s
            ),
          }
        : prev
    );
    const key = `stage:${stage.id}`;
    const existing = saveTimers.current.get(key);
    if (existing) clearTimeout(existing);
    const t = setTimeout(async () => {
      try {
        await fetch(`${stagesBase}/${stage.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: name || "Etap" }),
          signal: AbortSignal.timeout(8000),
        });
        const j = await fetchJourney(segmentId);
        if (j) setJourney(j);
      } catch {
        /* best-effort */
      }
    }, 700);
    saveTimers.current.set(key, t);
  };

  const addStage = async () => {
    if (!segmentId) return;
    try {
      await fetch(stagesBase, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Nowy etap", orderIdx: stages.length }),
        signal: AbortSignal.timeout(8000),
      });
    } finally {
      await refresh();
    }
  };

  const removeElement = async (id: string) => {
    setSelectedId(null);
    setBoard((prev) =>
      prev
        ? { ...prev, elements: prev.elements.filter((e) => e.id !== id) }
        : prev
    );
    await deleteFunnelElement(id, projectId);
    await refresh();
  };

  const setElementChannels = async (elementId: string, channelIds: string[]) => {
    setBoard((prev) =>
      prev
        ? {
            ...prev,
            elementChannels: [
              ...prev.elementChannels.filter(
                (ec) => ec.funnelElementId !== elementId
              ),
              ...channelIds.map((channelId) => ({
                funnelElementId: elementId,
                channelId,
              })),
            ],
          }
        : prev
    );
    try {
      await fetch(`${api}/funnel-elements/${elementId}/relations`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channelIds }),
        signal: AbortSignal.timeout(8000),
      });
    } finally {
      await refresh();
    }
  };

  const addRelation = async (
    source: { type: string; id: string },
    target: { type: string; id: string },
    relationType: string
  ) => {
    try {
      await fetch(`${api}/relations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source, target, relationType }),
        signal: AbortSignal.timeout(8000),
      });
    } finally {
      await refresh();
    }
  };

  const removeRelation = async (relationId: string) => {
    try {
      await fetch(`${api}/relations/${relationId}`, {
        method: "DELETE",
        signal: AbortSignal.timeout(8000),
      });
    } finally {
      await refresh();
    }
  };

  // Esc zamyka edytor elementu.
  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setSelectedId(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // ── Render ─────────────────────────────────────────────────────────────────

  if (!board) {
    return (
      <div className="flex h-full min-h-[400px] items-center justify-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Ładowanie lejka…
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-[540px] flex-col">
      {/* ── Nagłówek modułu ── */}
      <header className="flex flex-wrap items-center gap-x-4 gap-y-2 pb-3">
        <div className="min-w-0">
          <p className="truncate text-[11px] font-medium text-muted-foreground">
            {projectName} · Egzekucja
          </p>
          <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
            <Filter className="size-5 text-brand" />
            Lejek marketingowy
          </h1>
          <p className="text-[11px] text-muted-foreground">
            Każda kolumna = etap podróży zakupowej segmentu; lejek to Twoje
            odpowiedzi na te etapy.{" "}
            <Link
              href={`${hub}/market/journey`}
              className="text-brand hover:underline"
            >
              Edytuj podróż →
            </Link>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {board.segments.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => void selectSegment(s.id)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                segmentId === s.id
                  ? "border-brand/40 bg-brand/10 text-brand"
                  : "border-border text-muted-foreground hover:text-foreground"
              )}
            >
              {s.name}
            </button>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-3">
          {journey && journey.stages.length > 0 && (
            <div
              className="flex items-center gap-2"
              title={`${coverageStats.ok}/${coverageStats.required} wymaganych odpowiedzi strategii`}
            >
              <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted">
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    coverageStats.pct === 100 ? "bg-emerald-500" : "bg-brand"
                  )}
                  style={{ width: `${coverageStats.pct}%` }}
                />
              </div>
              <span className="text-[11px] tabular-nums text-muted-foreground">
                {coverageStats.pct}%
              </span>
              {journey.gapCount > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-600">
                  <AlertTriangle className="size-3" />
                  {pluralCount(journey.gapCount, "luka", "luki", "luk")}
                </span>
              )}
            </div>
          )}

          <div className="flex rounded-lg border border-border p-0.5">
            {(
              [
                ["editor", "Edytor"],
                ["map", "Mapa relacji"],
                ["channels", "Kanały i plan"],
              ] as [WorkspaceView, string][]
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setView(key)}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                  view === key
                    ? "bg-brand/10 text-brand"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* ── Treść ── */}
      <div className="min-h-0 flex-1">
        {view === "map" && (
          <div className="h-full overflow-y-auto">
            <FunnelBoard projectId={projectId} />
          </div>
        )}

        {view === "channels" && (
          <div className="h-full overflow-y-auto pr-1">
            <FunnelChannelsPanel projectId={projectId} />
          </div>
        )}

        {view === "editor" &&
          (board.segments.length === 0 ? (
            <EmptyState
              text="Lejek buduje się na segmentach — najpierw zdefiniuj, do kogo mówisz."
              href={`${hub}/market/segments`}
              cta="Dodaj segmenty"
            />
          ) : stages.length === 0 ? (
            <EmptyState
              text="Ten segment nie ma jeszcze podróży zakupowej. Etapy zakupu są kręgosłupem lejka — treści odpowiadają na konkretne etapy."
              href={`${hub}/market/journey`}
              cta="Zaprojektuj podróż zakupową"
            />
          ) : (
            <div className="grid h-full min-h-0 grid-cols-[240px_minmax(0,1fr)_320px] gap-3">
              <InfluencePanel
                hub={hub}
                board={board}
                segmentId={segmentId}
                stages={stages}
                elementIds={elementIds}
                selectedChannelIds={selectedChannelIds}
                selectedCampaignIds={selectedCampaignIds}
                onPinMagnet={(magnetId, stageId) =>
                  void addRelation(
                    { type: "lead_magnet", id: magnetId },
                    { type: "stage", id: stageId },
                    "uzywany_w_etapie"
                  )
                }
                onUnpin={(relationId) => void removeRelation(relationId)}
              />

              {/* ── Środek: kolumny etapów ── */}
              <div className="min-h-0 overflow-x-auto overflow-y-hidden rounded-xl border border-border bg-card/20 p-3">
                <div className="flex h-full min-w-max items-stretch gap-0">
                  {stages.map((stage, i) => (
                    <React.Fragment key={stage.id}>
                      {i > 0 && (
                        <div className="flex w-7 shrink-0 flex-col items-center justify-start gap-1 pt-10">
                          {boundaryIdx === i && (
                            <span
                              className="whitespace-nowrap rounded-full border border-teal-500/40 bg-teal-500/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-teal-600 [writing-mode:vertical-rl]"
                              title="Handoff marketing → sprzedaż (granica MQL/SQL)"
                            >
                              MQL→SQL
                            </span>
                          )}
                          <ArrowRight className="size-3.5 text-muted-foreground/40" />
                        </div>
                      )}
                      <StageColumn
                        stage={stage}
                        index={i}
                        journeyStage={journeyByStage.get(stage.id)}
                        elements={elements.filter((e) => e.stageId === stage.id)}
                        board={board}
                        stages={stages}
                        selectedId={selectedId}
                        dragOver={dragOverStage === stage.id}
                        onSelect={setSelectedId}
                        onAdd={() => void addElement(stage.id)}
                        onRename={(name) => renameStage(stage, name)}
                        onMove={(el, dir) => {
                          const target = stages[i + dir];
                          if (target) void moveElement(el, target.id);
                        }}
                        onDragOver={(over) =>
                          setDragOverStage(over ? stage.id : null)
                        }
                        onDropElement={(elId) => {
                          setDragOverStage(null);
                          const el = elements.find((e) => e.id === elId);
                          if (el) void moveElement(el, stage.id);
                        }}
                      />
                    </React.Fragment>
                  ))}

                  {/* Nowy etap podróży = nowa kolumna lejka */}
                  <div className="ml-4 flex w-[180px] shrink-0 items-start pt-1">
                    <button
                      type="button"
                      onClick={() => void addStage()}
                      className="w-full rounded-xl border border-dashed border-border px-3 py-4 text-center text-[11px] text-muted-foreground transition-colors hover:border-brand/40 hover:text-brand"
                    >
                      <Plus className="mx-auto mb-1 size-4" />
                      Dodaj etap podróży
                      <span className="mt-0.5 block text-[10px] opacity-70">
                        np. Edukacja — lejek dostanie kolumnę
                      </span>
                    </button>
                  </div>
                </div>
              </div>

              {/* ── Prawa szyna: Efekt / edytor elementu ── */}
              <div className="min-h-0 overflow-y-auto rounded-xl border border-border bg-card/30">
                {selected ? (
                  <ElementEditor
                    key={selected.id}
                    element={selected}
                    board={board}
                    stages={stages}
                    onClose={() => setSelectedId(null)}
                    onPatch={patchElement}
                    onMoveToStage={(sid) => void moveElement(selected, sid)}
                    onSetChannels={(ids) =>
                      void setElementChannels(selected.id, ids)
                    }
                    onLinkCampaign={(cid) =>
                      void addRelation(
                        { type: "element", id: selected.id },
                        { type: "campaign", id: cid },
                        "promowany_przez"
                      )
                    }
                    onLinkNextStage={(sid) =>
                      void addRelation(
                        { type: "element", id: selected.id },
                        { type: "stage", id: sid },
                        "prowadzi_do_etapu"
                      )
                    }
                    onUnlink={(relationId) => void removeRelation(relationId)}
                    onDelete={() => void removeElement(selected.id)}
                  />
                ) : (
                  <EffectPanel
                    hub={hub}
                    journey={journey}
                    stages={stages}
                    onAddContent={(sid) => void addElement(sid)}
                  />
                )}
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function EmptyState({
  text,
  href,
  cta,
}: {
  text: string;
  href: string;
  cta: string;
}) {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="max-w-md rounded-2xl border border-dashed border-border p-8 text-center">
        <Route className="mx-auto size-6 text-muted-foreground/50" />
        <p className="mt-3 text-sm text-muted-foreground">{text}</p>
        <Button asChild size="sm" className="mt-4">
          <Link href={href}>{cta}</Link>
        </Button>
      </div>
    </div>
  );
}

// ── Lewa szyna: co zasila lejek ──────────────────────────────────────────────

function RailSection({
  icon,
  title,
  href,
  hrefLabel,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  href: string;
  hrefLabel: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {icon}
          {title}
        </p>
        <Link
          href={href}
          className="flex items-center gap-0.5 text-[10px] text-muted-foreground hover:text-brand"
        >
          {hrefLabel}
          <ArrowUpRight className="size-2.5" />
        </Link>
      </div>
      {children}
    </section>
  );
}

function InfluencePanel({
  hub,
  board,
  segmentId,
  stages,
  elementIds,
  selectedChannelIds,
  selectedCampaignIds,
  onPinMagnet,
  onUnpin,
}: {
  hub: string;
  board: BoardData;
  segmentId: string;
  stages: StageRow[];
  elementIds: Set<string>;
  selectedChannelIds: Set<string>;
  selectedCampaignIds: Set<string>;
  onPinMagnet: (magnetId: string, stageId: string) => void;
  onUnpin: (relationId: string) => void;
}) {
  const stageIds = new Set(stages.map((s) => s.id));
  const stageName = (id: string | null) =>
    stages.find((s) => s.id === id)?.name ?? null;

  const campaigns = board.campaigns.filter(
    (c) => !c.segmentId || c.segmentId === segmentId
  );
  const magnets = board.leadMagnets.filter(
    (m) => !m.segmentId || m.segmentId === segmentId
  );
  const campaignUse = new Map<string, number>();
  for (const ec of board.elementCampaigns) {
    if (!elementIds.has(ec.funnelElementId)) continue;
    campaignUse.set(ec.campaignId, (campaignUse.get(ec.campaignId) ?? 0) + 1);
  }
  const channelUse = new Map<string, number>();
  for (const ec of board.elementChannels) {
    if (!elementIds.has(ec.funnelElementId)) continue;
    channelUse.set(ec.channelId, (channelUse.get(ec.channelId) ?? 0) + 1);
  }

  return (
    <aside className="min-h-0 space-y-5 overflow-y-auto rounded-xl border border-border bg-card/30 p-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-brand">
        Co zasila lejek
      </p>

      <RailSection
        icon={<Route className="size-3" />}
        title="Podróż zakupowa"
        href={`${hub}/market/journey`}
        hrefLabel="edytuj"
      >
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          {pluralCount(stages.length, "etap", "etapy", "etapów")} tego segmentu
          wyznacza kolumny lejka. Pytania i triggery etapów widzisz w nagłówkach
          kolumn.
        </p>
      </RailSection>

      <RailSection
        icon={<Megaphone className="size-3" />}
        title={`Kampanie (${campaigns.length})`}
        href={`${hub}/execution/campaigns`}
        hrefLabel="edytuj"
      >
        {campaigns.length === 0 ? (
          <p className="text-[11px] text-muted-foreground">
            Brak kampanii zasilających ten segment.
          </p>
        ) : (
          <ul className="space-y-1">
            {campaigns.map((c) => (
              <li
                key={c.id}
                className={cn(
                  "rounded-lg border px-2 py-1.5 text-[11px]",
                  selectedCampaignIds.has(c.id)
                    ? "border-brand/50 bg-brand/5"
                    : "border-border"
                )}
              >
                <span className="block truncate font-medium">{c.name}</span>
                <span className="text-[10px] text-muted-foreground">
                  {stageName(c.stageId)
                    ? `etap: ${stageName(c.stageId)}`
                    : "bez etapu"}
                  {" · "}
                  {campaignUse.get(c.id) ?? 0} treści
                </span>
              </li>
            ))}
          </ul>
        )}
      </RailSection>

      <RailSection
        icon={<Magnet className="size-3" />}
        title={`Lead magnety (${magnets.length})`}
        href={`${hub}/execution/offers`}
        hrefLabel="edytuj"
      >
        {magnets.length === 0 ? (
          <p className="text-[11px] text-muted-foreground">
            Brak lead magnetów — to one zamieniają ruch w kontakty.
          </p>
        ) : (
          <ul className="space-y-1">
            {magnets.map((m) => {
              const pins = board.magnetStages.filter(
                (ms) => ms.leadMagnetId === m.id && stageIds.has(ms.stageId)
              );
              return (
                <li
                  key={m.id}
                  className="space-y-1 rounded-lg border border-border px-2 py-1.5 text-[11px]"
                >
                  <span className="block truncate font-medium">{m.name}</span>
                  <div className="flex flex-wrap items-center gap-1">
                    {pins.map((p) => (
                      <span
                        key={p.relationId}
                        className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-[9px] text-amber-600"
                      >
                        {stageName(p.stageId)}
                        <button
                          type="button"
                          aria-label="Odepnij od etapu"
                          onClick={() => onUnpin(p.relationId)}
                          className="hover:text-destructive"
                        >
                          <X className="size-2.5" />
                        </button>
                      </span>
                    ))}
                    <select
                      value=""
                      onChange={(e) => {
                        if (e.target.value) onPinMagnet(m.id, e.target.value);
                      }}
                      aria-label={`Przypnij ${m.name} do etapu`}
                      className="h-5 rounded border border-dashed border-border bg-transparent px-1 text-[9px] text-muted-foreground focus-visible:outline-none"
                    >
                      <option value="">+ etap</option>
                      {stages
                        .filter((s) => !pins.some((p) => p.stageId === s.id))
                        .map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                    </select>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </RailSection>

      <RailSection
        icon={<Radio className="size-3" />}
        title={`Kanały (${board.channels.length})`}
        href={`${hub}/execution/channels`}
        hrefLabel="edytuj"
      >
        {board.channels.length === 0 ? (
          <p className="text-[11px] text-muted-foreground">
            Brak kanałów dystrybucji.
          </p>
        ) : (
          <ul className="space-y-1">
            {board.channels.map((c) => {
              const uses = channelUse.get(c.id) ?? 0;
              return (
                <li
                  key={c.id}
                  className={cn(
                    "flex items-center justify-between gap-2 rounded-lg border px-2 py-1.5 text-[11px]",
                    selectedChannelIds.has(c.id)
                      ? "border-brand/50 bg-brand/5"
                      : "border-border",
                    uses === 0 && "opacity-60"
                  )}
                >
                  <span className="truncate">
                    {c.icon ? `${c.icon} ` : ""}
                    {c.name}
                  </span>
                  <span
                    className="shrink-0 text-[10px] tabular-nums text-muted-foreground"
                    title="Liczba treści publikowanych w kanale"
                  >
                    {uses}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </RailSection>
    </aside>
  );
}

// ── Kolumna etapu ────────────────────────────────────────────────────────────

function StageColumn({
  stage,
  index,
  journeyStage,
  elements,
  board,
  stages,
  selectedId,
  dragOver,
  onSelect,
  onAdd,
  onRename,
  onMove,
  onDragOver,
  onDropElement,
}: {
  stage: StageRow;
  index: number;
  journeyStage: JourneyView["stages"][number] | undefined;
  elements: ElementRow[];
  board: BoardData;
  stages: StageRow[];
  selectedId: string | null;
  dragOver: boolean;
  onSelect: (id: string) => void;
  onAdd: () => void;
  onRename: (name: string) => void;
  onMove: (el: ElementRow, dir: -1 | 1) => void;
  onDragOver: (over: boolean) => void;
  onDropElement: (elementId: string) => void;
}) {
  const gaps =
    journeyStage?.coverage.filter((c) => c.required && !c.ok).map((c) => c.key) ??
    [];

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        onDragOver(true);
      }}
      onDragLeave={() => onDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        const id = e.dataTransfer.getData("text/element-id");
        if (id) onDropElement(id);
      }}
      className={cn(
        "flex h-full w-[264px] shrink-0 flex-col rounded-xl border bg-card/50 transition-colors",
        dragOver ? "border-brand/60 bg-brand/5" : "border-border"
      )}
    >
      {/* Nagłówek etapu */}
      <div className="space-y-1.5 border-b border-border p-2.5">
        <div className="flex items-center gap-1.5">
          <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-brand/10 text-[10px] font-semibold text-brand">
            {index + 1}
          </span>
          <input
            value={stage.name}
            onChange={(e) => onRename(e.target.value)}
            aria-label={`Nazwa etapu ${index + 1}`}
            title="Nazwa etapu podróży zakupowej — to ona jest taksonomią lejka"
            className="min-w-0 flex-1 rounded bg-transparent text-[13px] font-semibold outline-none transition-colors hover:bg-muted/40 focus:bg-muted/40"
          />
        </div>
        {journeyStage &&
          (journeyStage.trigger || journeyStage.questions) && (
            <details className="group">
              <summary className="flex cursor-pointer list-none items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground [&::-webkit-details-marker]:hidden">
                <ChevronDown className="size-3 transition-transform group-open:rotate-180" />
                Kontekst klienta na tym etapie
              </summary>
              <div className="mt-1.5 space-y-1 text-[11px] leading-snug text-muted-foreground">
                {journeyStage.trigger && (
                  <p>
                    <span className="font-medium text-foreground/80">Trigger:</span>{" "}
                    {journeyStage.trigger}
                  </p>
                )}
                {journeyStage.questions && (
                  <p>
                    <span className="font-medium text-foreground/80">Pyta:</span>{" "}
                    {journeyStage.questions}
                  </p>
                )}
              </div>
            </details>
          )}
      </div>

      {/* Karty treści */}
      <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto p-2">
        {elements.length === 0 && (
          <button
            type="button"
            onClick={onAdd}
            className="w-full rounded-lg border border-dashed border-amber-500/60 px-2 py-3 text-center text-[11px] text-amber-600 transition-colors hover:bg-amber-500/10"
          >
            <AlertTriangle className="mx-auto mb-1 size-3.5" />
            Luka: klient na tym etapie nie dostaje żadnej treści.
            <span className="mt-0.5 block font-medium">+ Dodaj pierwszą</span>
          </button>
        )}
        {elements.map((el) => (
          <ElementCard
            key={el.id}
            element={el}
            board={board}
            stages={stages}
            selected={selectedId === el.id}
            canLeft={index > 0}
            canRight={index < stages.length - 1}
            onSelect={() => onSelect(el.id)}
            onMove={(dir) => onMove(el, dir)}
          />
        ))}
        <button
          type="button"
          onClick={onAdd}
          className="flex w-full items-center justify-center gap-1 rounded-lg border border-dashed border-border px-2 py-1.5 text-[11px] text-muted-foreground transition-colors hover:border-brand/40 hover:text-brand"
        >
          <Plus className="size-3" />
          Dodaj treść
        </button>
      </div>

      {/* Stopka etapu: wyjście + pokrycie */}
      <div className="space-y-1.5 border-t border-border p-2.5">
        {journeyStage?.exitCriterion ? (
          <p
            className="truncate text-[10px] text-muted-foreground"
            title={`Kryterium wyjścia: ${journeyStage.exitCriterion}`}
          >
            → {journeyStage.exitCriterion}
          </p>
        ) : null}
        {journeyStage && (
          <div className="flex items-center gap-1.5">
            {journeyStage.coverage.map((c) => (
              <span
                key={c.key}
                title={`${COVERAGE_LABELS[c.key]}: ${
                  c.ok ? "OK" : c.required ? "LUKA" : "niewymagane"
                }`}
                className={cn(
                  "size-2 rounded-full",
                  c.ok
                    ? "bg-emerald-500"
                    : c.required
                      ? "bg-amber-500"
                      : "bg-muted-foreground/25"
                )}
              />
            ))}
            {gaps.length > 0 && (
              <span className="text-[9px] font-medium text-amber-600">
                {gaps.map((g) => COVERAGE_LABELS[g]).join(" · ")}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Karta treści ─────────────────────────────────────────────────────────────

function ElementCard({
  element,
  board,
  stages,
  selected,
  canLeft,
  canRight,
  onSelect,
  onMove,
}: {
  element: ElementRow;
  board: BoardData;
  stages: StageRow[];
  selected: boolean;
  canLeft: boolean;
  canRight: boolean;
  onSelect: () => void;
  onMove: (dir: -1 | 1) => void;
}) {
  const status = STATUS_META[element.status ?? "draft"] ?? STATUS_META.draft;
  const channelCount = board.elementChannels.filter(
    (ec) => ec.funnelElementId === element.id
  ).length;
  const campaignCount = board.elementCampaigns.filter(
    (ec) => ec.funnelElementId === element.id
  ).length;
  const nextStage = board.elementNextStages.find(
    (ns) => ns.funnelElementId === element.id
  );
  const nextIdx = nextStage
    ? stages.findIndex((s) => s.id === nextStage.stageId)
    : -1;

  return (
    <div
      role="button"
      tabIndex={0}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/element-id", element.id);
        e.dataTransfer.effectAllowed = "move";
      }}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
      className={cn(
        "group cursor-pointer rounded-lg border bg-card p-2 text-left transition-colors",
        selected
          ? "border-brand ring-1 ring-brand/40"
          : "border-border hover:border-brand/40"
      )}
    >
      <div className="flex items-start gap-1.5">
        <span
          className={cn("mt-1 size-1.5 shrink-0 rounded-full", status.dot)}
          title={`Status: ${status.label}`}
        />
        <p className="min-w-0 flex-1 text-xs font-medium leading-snug [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2] overflow-hidden">
          {element.name}
        </p>
        <div className="flex shrink-0 gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
          {canLeft && (
            <button
              type="button"
              aria-label="Przenieś do wcześniejszego etapu"
              onClick={(e) => {
                e.stopPropagation();
                onMove(-1);
              }}
              className="flex size-4 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <ArrowLeft className="size-3" />
            </button>
          )}
          {canRight && (
            <button
              type="button"
              aria-label="Przenieś do następnego etapu"
              onClick={(e) => {
                e.stopPropagation();
                onMove(1);
              }}
              className="flex size-4 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <ArrowRight className="size-3" />
            </button>
          )}
        </div>
      </div>
      <div className="mt-1.5 flex items-center gap-2 text-[10px] text-muted-foreground">
        {element.format && (
          <span className="rounded border border-border px-1 py-px">
            {element.format}
          </span>
        )}
        {channelCount > 0 && (
          <span className="inline-flex items-center gap-0.5" title="Kanały">
            <Radio className="size-2.5" />
            {channelCount}
          </span>
        )}
        {campaignCount > 0 && (
          <span className="inline-flex items-center gap-0.5" title="Kampanie">
            <Megaphone className="size-2.5" />
            {campaignCount}
          </span>
        )}
        {nextIdx >= 0 && (
          <span
            className="inline-flex items-center gap-0.5 text-emerald-600"
            title={`Prowadzi do etapu ${nextIdx + 1}`}
          >
            <ArrowRight className="size-2.5" />
            {nextIdx + 1}
          </span>
        )}
      </div>
    </div>
  );
}

// ── Prawa szyna: efekt lejka ─────────────────────────────────────────────────

function EffectPanel({
  hub,
  journey,
  stages,
  onAddContent,
}: {
  hub: string;
  journey: JourneyView | null;
  stages: StageRow[];
  onAddContent: (stageId: string) => void;
}) {
  if (!journey) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
      </div>
    );
  }

  const gapAction = (stageId: string, key: CoverageKey) => {
    switch (key) {
      case "content":
        return { onClick: () => onAddContent(stageId) };
      case "channel":
        return { href: `${hub}/execution/channels` };
      case "sales":
        return { href: `${hub}/execution/sales` };
      case "exit":
        return { onClick: () => onAddContent(stageId) };
      case "kpi":
        return { href: `${hub}/measurement/kpi` };
    }
  };

  return (
    <div className="space-y-4 p-3">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-brand">
          Efekt lejka
        </p>
        <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
          Gap engine sprawdza, czy każdy etap ma odpowiedź strategii: treść,
          kanał, akcję sprzedaży, wyjście do przodu i pomiar.
        </p>
      </div>

      <div className="space-y-2">
        {journey.stages.map((s, i) => {
          const gaps = s.coverage.filter((c) => c.required && !c.ok);
          return (
            <div
              key={s.id}
              className={cn(
                "rounded-lg border p-2",
                gaps.length > 0 ? "border-amber-500/30" : "border-border"
              )}
            >
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-semibold text-muted-foreground">
                  {i + 1}.
                </span>
                <span className="min-w-0 flex-1 truncate text-[11px] font-medium">
                  {s.name}
                </span>
                <span className="flex gap-1">
                  {s.coverage.map((c) => (
                    <span
                      key={c.key}
                      title={`${COVERAGE_LABELS[c.key]}: ${
                        c.ok ? "OK" : c.required ? "luka" : "niewymagane"
                      }`}
                      className={cn(
                        "size-1.5 rounded-full",
                        c.ok
                          ? "bg-emerald-500"
                          : c.required
                            ? "bg-amber-500"
                            : "bg-muted-foreground/25"
                      )}
                    />
                  ))}
                </span>
              </div>
              {gaps.length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {gaps.map((g) => {
                    const action = gapAction(s.id, g.key);
                    const label = `brak: ${COVERAGE_LABELS[g.key].toLowerCase()}`;
                    const className =
                      "rounded-full border border-dashed border-amber-500/50 px-1.5 py-0.5 text-[9px] font-medium text-amber-600 transition-colors hover:bg-amber-500/10";
                    return "href" in action && action.href ? (
                      <Link key={g.key} href={action.href} className={className}>
                        {label} →
                      </Link>
                    ) : (
                      <button
                        key={g.key}
                        type="button"
                        onClick={"onClick" in action ? action.onClick : undefined}
                        className={className}
                      >
                        {label} +
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {stages.length > 0 && journey.gapCount === 0 && (
        <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-2 text-[11px] text-emerald-600">
          <Target className="mr-1 inline size-3" />
          Każdy etap ma komplet odpowiedzi. Lejek jest domknięty strategicznie.
        </p>
      )}

      <p className="text-[10px] leading-relaxed text-muted-foreground">
        Kliknij kartę treści, aby edytować ją tutaj — bez wychodzenia z lejka.
      </p>
    </div>
  );
}

// ── Edytor pojedynczego elementu ─────────────────────────────────────────────

function ElementEditor({
  element,
  board,
  stages,
  onClose,
  onPatch,
  onMoveToStage,
  onSetChannels,
  onLinkCampaign,
  onLinkNextStage,
  onUnlink,
  onDelete,
}: {
  element: ElementRow;
  board: BoardData;
  stages: StageRow[];
  onClose: () => void;
  onPatch: (id: string, patch: Partial<ElementRow>, debounce?: number) => void;
  onMoveToStage: (stageId: string) => void;
  onSetChannels: (channelIds: string[]) => void;
  onLinkCampaign: (campaignId: string) => void;
  onLinkNextStage: (stageId: string) => void;
  onUnlink: (relationId: string) => void;
  onDelete: () => void;
}) {
  const [confirmDelete, setConfirmDelete] = React.useState(false);

  const myChannels = board.elementChannels
    .filter((ec) => ec.funnelElementId === element.id)
    .map((ec) => ec.channelId);
  const myCampaigns = board.elementCampaigns.filter(
    (ec) => ec.funnelElementId === element.id
  );
  const myNextStages = board.elementNextStages.filter(
    (ns) => ns.funnelElementId === element.id
  );
  const stageIdx = stages.findIndex((s) => s.id === element.stageId);
  const formatValue =
    element.format && !FORMAT_OPTIONS.includes(element.format)
      ? [...FORMAT_OPTIONS, element.format]
      : FORMAT_OPTIONS;

  const field = (label: string, node: React.ReactNode) => (
    <label className="block space-y-1">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      {node}
    </label>
  );

  return (
    <div className="space-y-3.5 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-brand">
          Edycja treści
        </p>
        <button
          type="button"
          onClick={onClose}
          aria-label="Zamknij edytor (Esc)"
          className="flex size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <X className="size-3.5" />
        </button>
      </div>

      {field(
        "Nazwa",
        <Input
          value={element.name}
          onChange={(e) => onPatch(element.id, { name: e.target.value })}
          className="h-8 text-sm font-medium"
        />
      )}

      <div className="grid grid-cols-2 gap-2">
        {field(
          "Format",
          <select
            value={element.format ?? ""}
            onChange={(e) =>
              onPatch(element.id, { format: e.target.value || null }, 0)
            }
            className="h-8 w-full rounded-md border border-border bg-transparent px-2 text-xs focus-visible:outline-none"
          >
            <option value="">—</option>
            {formatValue.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        )}
        {field(
          "Status",
          <select
            value={element.status ?? "draft"}
            onChange={(e) => onPatch(element.id, { status: e.target.value }, 0)}
            className="h-8 w-full rounded-md border border-border bg-transparent px-2 text-xs focus-visible:outline-none"
          >
            {Object.entries(STATUS_META).map(([value, meta]) => (
              <option key={value} value={value}>
                {meta.label}
              </option>
            ))}
          </select>
        )}
      </div>

      {field(
        "Etap zakupu",
        <select
          value={element.stageId}
          onChange={(e) => onMoveToStage(e.target.value)}
          className="h-8 w-full rounded-md border border-border bg-transparent px-2 text-xs focus-visible:outline-none"
        >
          {stages.map((s, i) => (
            <option key={s.id} value={s.id}>
              {i + 1}. {s.name}
            </option>
          ))}
        </select>
      )}

      {field(
        "Co komunikujemy",
        <Textarea
          value={element.contentMd ?? ""}
          onChange={(e) => onPatch(element.id, { contentMd: e.target.value })}
          placeholder="Kluczowy przekaz tej treści — na jakie pytanie etapu odpowiada?"
          className="min-h-[84px] text-xs"
        />
      )}

      <div className="grid grid-cols-1 gap-2">
        {field(
          "CTA (dokąd kieruje klienta)",
          <Input
            value={element.cta ?? ""}
            onChange={(e) => onPatch(element.id, { cta: e.target.value })}
            placeholder="np. Pobierz checklistę"
            className="h-8 text-xs"
          />
        )}
        {field(
          "URL CTA",
          <Input
            value={element.ctaUrl ?? ""}
            onChange={(e) => onPatch(element.id, { ctaUrl: e.target.value })}
            placeholder="https://…"
            className="h-8 text-xs"
          />
        )}
      </div>

      {/* Publikacja: kanały */}
      <div className="space-y-1.5">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Publikowany w kanałach
        </span>
        {board.channels.length === 0 ? (
          <p className="text-[11px] text-muted-foreground">
            Brak kanałów w projekcie.
          </p>
        ) : (
          <div className="flex flex-wrap gap-1">
            {board.channels.map((c) => {
              const on = myChannels.includes(c.id);
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() =>
                    onSetChannels(
                      on
                        ? myChannels.filter((id) => id !== c.id)
                        : [...myChannels, c.id]
                    )
                  }
                  className={cn(
                    "rounded-full border px-2 py-0.5 text-[10px] transition-colors",
                    on
                      ? "border-brand/50 bg-brand/10 text-brand"
                      : "border-border text-muted-foreground hover:text-foreground"
                  )}
                >
                  {c.icon ? `${c.icon} ` : ""}
                  {c.name}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Promocja: kampanie */}
      <div className="space-y-1.5">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Promowany przez kampanię
        </span>
        <div className="flex flex-wrap items-center gap-1">
          {myCampaigns.map((ec) => {
            const c = board.campaigns.find((x) => x.id === ec.campaignId);
            return (
              <span
                key={ec.relationId}
                className="inline-flex items-center gap-1 rounded-full border border-violet-500/40 bg-violet-500/10 px-2 py-0.5 text-[10px] text-violet-600"
              >
                {c?.name ?? "kampania"}
                <button
                  type="button"
                  aria-label="Odepnij kampanię"
                  onClick={() => onUnlink(ec.relationId)}
                  className="hover:text-destructive"
                >
                  <X className="size-2.5" />
                </button>
              </span>
            );
          })}
          {board.campaigns.filter(
            (c) => !myCampaigns.some((ec) => ec.campaignId === c.id)
          ).length > 0 && (
            <select
              value=""
              onChange={(e) => {
                if (e.target.value) onLinkCampaign(e.target.value);
              }}
              aria-label="Dodaj kampanię promującą"
              className="h-6 rounded-md border border-dashed border-border bg-transparent px-1.5 text-[10px] text-muted-foreground focus-visible:outline-none"
            >
              <option value="">+ kampania…</option>
              {board.campaigns
                .filter((c) => !myCampaigns.some((ec) => ec.campaignId === c.id))
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </select>
          )}
        </div>
      </div>

      {/* Wyjście: dokąd prowadzi */}
      <div className="space-y-1.5">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Prowadzi do etapu (wyjście CTA)
        </span>
        <div className="flex flex-wrap items-center gap-1">
          {myNextStages.map((ns) => {
            const idx = stages.findIndex((s) => s.id === ns.stageId);
            return (
              <span
                key={ns.relationId}
                className="inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-600"
              >
                <ArrowRight className="size-2.5" />
                {idx >= 0 ? `${idx + 1}. ${stages[idx].name}` : "etap"}
                <button
                  type="button"
                  aria-label="Usuń wyjście"
                  onClick={() => onUnlink(ns.relationId)}
                  className="hover:text-destructive"
                >
                  <X className="size-2.5" />
                </button>
              </span>
            );
          })}
          <select
            value=""
            onChange={(e) => {
              if (e.target.value) onLinkNextStage(e.target.value);
            }}
            aria-label="Ustaw etap docelowy"
            className="h-6 rounded-md border border-dashed border-border bg-transparent px-1.5 text-[10px] text-muted-foreground focus-visible:outline-none"
          >
            <option value="">+ etap docelowy…</option>
            {stages
              .filter(
                (s, i) =>
                  i > stageIdx && !myNextStages.some((ns) => ns.stageId === s.id)
              )
              .map((s) => {
                const i = stages.findIndex((x) => x.id === s.id);
                return (
                  <option key={s.id} value={s.id}>
                    {i + 1}. {s.name}
                  </option>
                );
              })}
          </select>
        </div>
        <p className="text-[10px] text-muted-foreground">
          Bez wyjścia treść jest ślepą uliczką — gap engine liczy to jako lukę.
        </p>
      </div>

      <div className="border-t border-border pt-3">
        {confirmDelete ? (
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={onDelete}
              className="h-7 gap-1 text-xs"
            >
              <Trash2 className="size-3" />
              Usuń na pewno
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setConfirmDelete(false)}
              className="h-7 text-xs"
            >
              Anuluj
            </Button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="flex items-center gap-1 text-[11px] text-muted-foreground transition-colors hover:text-destructive"
          >
            <Trash2 className="size-3" />
            Usuń treść z lejka
          </button>
        )}
      </div>
    </div>
  );
}
