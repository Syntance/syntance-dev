"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  MarkerType,
  type Node,
  type Edge,
  type Connection,
  type OnNodeDrag,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { LayoutGrid, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { upsertFunnelElement } from "@/lib/strategy-hub/actions";

const PHASES = [
  { key: "TOFU", label: "TOFU — Świadomość", color: "#60a5fa" },
  { key: "MOFU", label: "MOFU — Rozważanie", color: "#a78bfa" },
  { key: "BOFU", label: "BOFU — Decyzja", color: "#34d399" },
  { key: "retention", label: "Retencja", color: "#fbbf24" },
] as const;
type Phase = (typeof PHASES)[number]["key"];

const COL_WIDTH = 260;
const COL_GAP = 40;
const COL_X = (i: number) => 40 + i * (COL_WIDTH + COL_GAP);
const CHANNEL_COL_X = COL_X(PHASES.length) + 40;
const ROW_HEIGHT = 76;
const ROW_START_Y = 90;

interface StageRow {
  id: string;
  segmentId: string;
  name: string;
  phase: string | null;
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
interface ChannelRow {
  id: string;
  name: string;
  icon: string | null;
}
interface SegmentRow {
  id: string;
  name: string;
}

interface BoardData {
  segments: SegmentRow[];
  stages: StageRow[];
  elements: ElementRow[];
  elementChannels: { funnelElementId: string; channelId: string }[];
  channels: ChannelRow[];
}

function phaseAt(x: number): Phase | null {
  for (let i = 0; i < PHASES.length; i++) {
    const left = COL_X(i) - COL_GAP / 2;
    const right = COL_X(i) + COL_WIDTH + COL_GAP / 2;
    if (x >= left && x < right) return PHASES[i].key;
  }
  return null;
}

export function FunnelBoard({
  projectId,
  mode = "editor",
}: {
  projectId: string;
  mode?: "editor" | "client";
}) {
  const isEditor = mode === "editor";
  const [data, setData] = useState<BoardData | null>(null);
  const [segmentId, setSegmentId] = useState<string>("");
  const [visiblePhases, setVisiblePhases] = useState<Set<Phase>>(
    () => new Set(PHASES.map((p) => p.key))
  );
  const [warning, setWarning] = useState<string | null>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const layoutSeq = useRef(0);

  const refresh = useCallback(async () => {
    const url = `/api/strategy-hub/projects/${projectId}/funnel-board`;
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (!res.ok) return;
      const json = (await res.json()) as BoardData;
      setData(json);
      setSegmentId((prev) => prev || json.segments[0]?.id || "");
    } catch {
      /* abort/timeout — kolejny refresh naprawi stan */
    }
  }, [projectId]);

  useEffect(() => {
    void (async () => {
      await refresh();
    })();
  }, [refresh]);

  const buildGraph = useCallback(
    (d: BoardData, segId: string, phases: Set<Phase>, editable: boolean) => {
      const nextNodes: Node[] = [];
      const nextEdges: Edge[] = [];

      PHASES.forEach((p, i) => {
        if (!phases.has(p.key)) return;
        nextNodes.push({
          id: `col-${p.key}`,
          position: { x: COL_X(i), y: 0 },
          data: { label: p.label },
          draggable: false,
          selectable: false,
          type: "default",
          style: {
            background: `${p.color}14`,
            border: `1px dashed ${p.color}66`,
            color: p.color,
            borderRadius: 10,
            fontSize: 11,
            fontWeight: 700,
            width: COL_WIDTH,
            padding: 8,
            textAlign: "center",
          },
        });
      });

      const stagesForSegment = d.stages.filter((s) => s.segmentId === segId);
      const elementsForSegment = d.elements.filter((e) => e.segmentId === segId);
      const stageById = new Map(stagesForSegment.map((s) => [s.id, s]));

      const byPhase = new Map<Phase, ElementRow[]>();
      for (const el of elementsForSegment) {
        const stage = stageById.get(el.stageId);
        const phase = stage?.phase as Phase | undefined;
        if (!phase || !phases.has(phase)) continue;
        if (!byPhase.has(phase)) byPhase.set(phase, []);
        byPhase.get(phase)!.push(el);
      }

      PHASES.forEach((p, colIdx) => {
        if (!phases.has(p.key)) return;
        const list = (byPhase.get(p.key) ?? []).sort(
          (a, b) => (a.position ?? 0) - (b.position ?? 0)
        );
        list.forEach((el, rowIdx) => {
          nextNodes.push({
            id: el.id,
            position: { x: COL_X(colIdx), y: ROW_START_Y + rowIdx * ROW_HEIGHT },
            data: { label: el.name },
            type: "default",
            draggable: editable,
            style: {
              background: "var(--card)",
              border: "1px solid var(--border)",
              color: "var(--foreground)",
              borderRadius: 10,
              fontSize: 12,
              width: COL_WIDTH,
              padding: "8px 10px",
            },
          });
        });
      });

      // Kanały (kolumna po prawej) — cel drag-connect element→kanał.
      const usedChannelIds = new Set(
        d.elementChannels
          .filter((ec) => elementsForSegment.some((e) => e.id === ec.funnelElementId))
          .map((ec) => ec.channelId)
      );
      d.channels.forEach((c, i) => {
        nextNodes.push({
          id: `ch-${c.id}`,
          position: { x: CHANNEL_COL_X, y: ROW_START_Y + i * 56 },
          data: { label: `${c.icon ?? "📣"} ${c.name}` },
          draggable: false,
          type: "default",
          style: {
            background: usedChannelIds.has(c.id) ? "var(--card)" : "transparent",
            border: "1px solid var(--border)",
            color: "var(--foreground)",
            borderRadius: 8,
            fontSize: 11,
            width: 190,
            padding: "6px 8px",
            opacity: usedChannelIds.has(c.id) ? 1 : 0.5,
          },
        });
      });

      for (const ec of d.elementChannels) {
        if (!elementsForSegment.some((e) => e.id === ec.funnelElementId)) continue;
        nextEdges.push({
          id: `ec-${ec.funnelElementId}-${ec.channelId}`,
          source: ec.funnelElementId,
          target: `ch-${ec.channelId}`,
          style: { stroke: "var(--border)", strokeWidth: 1.5 },
          markerEnd: { type: MarkerType.ArrowClosed },
        });
      }

      return { nodes: nextNodes, edges: nextEdges };
    },
    []
  );

  useEffect(() => {
    if (!data || !segmentId) return;
    const g = buildGraph(data, segmentId, visiblePhases, isEditor);
    setNodes(g.nodes);
    setEdges(g.edges);
  }, [data, segmentId, visiblePhases, buildGraph, setNodes, setEdges, isEditor]);

  const elementIds = useMemo(
    () => new Set((data?.elements ?? []).filter((e) => e.segmentId === segmentId).map((e) => e.id)),
    [data, segmentId]
  );

  const onNodeDragStop: OnNodeDrag = useCallback(
    async (_evt, node) => {
      if (!isEditor || !data || !elementIds.has(node.id)) return;
      const el = data.elements.find((e) => e.id === node.id);
      if (!el) return;
      const currentStage = data.stages.find((s) => s.id === el.stageId);
      const targetPhase = phaseAt(node.position.x + COL_WIDTH / 2);

      if (!targetPhase || targetPhase === currentStage?.phase) {
        // Powrót do siatki (brak realnej zmiany kolumny) — pełny rebuild z aktualnych danych.
        const g = buildGraph(data, segmentId, visiblePhases, isEditor);
        setNodes(g.nodes);
        return;
      }

      const targetStage = data.stages.find(
        (s) => s.segmentId === segmentId && s.phase === targetPhase
      );
      if (!targetStage) {
        setWarning(
          `Brak etapu „${PHASES.find((p) => p.key === targetPhase)?.label}" dla tego segmentu — utwórz go najpierw w zakładce Lejek.`
        );
        const g = buildGraph(data, segmentId, visiblePhases, isEditor);
        setNodes(g.nodes);
        return;
      }

      setWarning(null);
      await upsertFunnelElement({
        id: el.id,
        projectId,
        name: el.name,
        stageId: targetStage.id,
        segmentId: el.segmentId,
        position: el.position ?? 0,
        contentMd: el.contentMd ?? undefined,
        cta: el.cta ?? undefined,
        ctaUrl: el.ctaUrl ?? undefined,
        format: el.format ?? undefined,
        status: el.status ?? undefined,
      });
      await refresh();
    },
    [data, elementIds, segmentId, visiblePhases, buildGraph, setNodes, projectId, refresh, isEditor]
  );

  const onConnect = useCallback(
    async (conn: Connection) => {
      if (!isEditor || !conn.source || !conn.target) return;
      const isElementToChannel = elementIds.has(conn.source) && conn.target.startsWith("ch-");
      if (!isElementToChannel) return;
      setEdges((eds) => addEdge({ ...conn, markerEnd: { type: MarkerType.ArrowClosed } }, eds));
      const channelId = conn.target.replace(/^ch-/, "");
      try {
        await fetch(
          `/api/strategy-hub/projects/${projectId}/funnel-elements/${conn.source}/relations`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              channelIds: Array.from(
                new Set([
                  ...(data?.elementChannels
                    .filter((ec) => ec.funnelElementId === conn.source)
                    .map((ec) => ec.channelId) ?? []),
                  channelId,
                ])
              ),
            }),
          }
        );
      } finally {
        await refresh();
      }
    },
    [elementIds, projectId, data, setEdges, refresh, isEditor]
  );

  const autoLayout = useCallback(() => {
    if (!data || !segmentId) return;
    layoutSeq.current += 1;
    const g = buildGraph(data, segmentId, visiblePhases, isEditor);
    setNodes(g.nodes);
  }, [data, segmentId, visiblePhases, buildGraph, setNodes, isEditor]);

  useEffect(() => {
    if (!isEditor) return;
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "l") {
        e.preventDefault();
        autoLayout();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [autoLayout, isEditor]);

  const togglePhase = (p: Phase) => {
    setVisiblePhases((prev) => {
      const next = new Set(prev);
      if (next.has(p) && next.size === 1) return prev; // zawsze ≥1 faza widoczna
      if (next.has(p)) next.delete(p);
      else next.add(p);
      return next;
    });
  };

  if (!data) {
    return (
      <div className="h-[520px] flex items-center justify-center text-sm text-muted-foreground rounded-xl border border-border">
        Ładowanie planszy…
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          {data.segments.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setSegmentId(s.id)}
              className={cn(
                "rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
                segmentId === s.id
                  ? "border-brand/40 bg-brand/10 text-brand"
                  : "border-border text-muted-foreground hover:text-foreground"
              )}
            >
              {s.name}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          {PHASES.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => togglePhase(p.key)}
              className={cn(
                "rounded-full border px-2 py-0.5 text-[10px] font-semibold transition-colors",
                visiblePhases.has(p.key) ? "text-white" : "border-border text-muted-foreground/50"
              )}
              style={visiblePhases.has(p.key) ? { background: p.color, borderColor: p.color } : undefined}
              title={visiblePhases.has(p.key) ? `Ukryj ${p.key}` : `Pokaż ${p.key}`}
            >
              {p.key}
            </button>
          ))}
          {isEditor && (
            <button
              type="button"
              onClick={autoLayout}
              className="ml-1 flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[10px] font-medium text-muted-foreground hover:text-foreground"
              title="Auto-layout (⌘L)"
            >
              <LayoutGrid className="size-3" />
              ⌘L
            </button>
          )}
        </div>
      </div>

      {warning && (
        <div className="flex items-center gap-1.5 rounded-md border border-amber-500/30 bg-amber-500/10 px-2.5 py-1.5 text-[11px] text-amber-500">
          <AlertTriangle className="size-3.5 shrink-0" />
          {warning}
        </div>
      )}

      <div className="h-[520px] w-full rounded-xl border border-border overflow-hidden bg-card/20">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={isEditor ? onNodesChange : undefined}
          onEdgesChange={isEditor ? onEdgesChange : undefined}
          onNodeDragStop={isEditor ? onNodeDragStop : undefined}
          onConnect={isEditor ? onConnect : undefined}
          fitView
          proOptions={{ hideAttribution: true }}
          nodesConnectable={isEditor}
          nodesDraggable={isEditor}
        >
          <Background color="var(--border)" gap={20} />
          <Controls showInteractive={false} />
          <MiniMap pannable zoomable style={{ background: "var(--card)" }} />
        </ReactFlow>
      </div>
    </div>
  );
}
