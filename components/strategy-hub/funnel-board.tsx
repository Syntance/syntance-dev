"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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

/**
 * Funnel Board 2.0 (logika Negacza): kolumny = etapy zakupu WYBRANEGO segmentu
 * (purchaseStages wg orderIdx) — nie hardcodowane fazy TOFU/MOFU/BOFU.
 * Faza etapu jest tylko kolorowym tagiem nagłówka kolumny.
 *
 * Drag klocka między kolumnami = zmiana stage_id wprost.
 * Drag-connect:
 *   element → kanał (prawa szyna)      = relacja „publikowany w"
 *   element → kampania (lewa szyna)    = relacja „promowany przez"
 *   element → nagłówek etapu           = relacja „prowadzi do etapu" (wyjście CTA)
 *   lead magnet → nagłówek etapu       = relacja „używany w etapie"
 * Pusta kolumna = ghost-cell luki (klik tworzy pierwszą treść etapu).
 */

const PHASE_TINTS: Record<string, string> = {
  TOFU: "#60a5fa",
  MOFU: "#a78bfa",
  BOFU: "#34d399",
  retention: "#fbbf24",
};

function phaseTint(phase: string | null): string | null {
  if (!phase) return null;
  const v = phase.toLowerCase();
  if (v.includes("tofu") || v.includes("świado")) return PHASE_TINTS.TOFU;
  if (v.includes("mofu") || v.includes("rozważ")) return PHASE_TINTS.MOFU;
  if (v.includes("bofu") || v.includes("decyz")) return PHASE_TINTS.BOFU;
  if (v.includes("reten") || v.includes("loja")) return PHASE_TINTS.retention;
  return null;
}

const COL_WIDTH = 250;
const COL_GAP = 40;
const LEFT_RAIL_WIDTH = 200;
const LEFT_RAIL_X = 20;
const COLS_START_X = LEFT_RAIL_X + LEFT_RAIL_WIDTH + 60;
const COL_X = (i: number) => COLS_START_X + i * (COL_WIDTH + COL_GAP);
const ROW_HEIGHT = 76;
const ROW_START_Y = 96;

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
interface ChannelRow {
  id: string;
  name: string;
  icon: string | null;
}
interface CampaignRow {
  id: string;
  name: string;
  segmentId: string | null;
  stageId: string | null;
}
interface LeadMagnetRow {
  id: string;
  name: string;
  segmentId: string | null;
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
  elementCampaigns: { funnelElementId: string; campaignId: string }[];
  magnetStages: { leadMagnetId: string; stageId: string }[];
  elementNextStages: { funnelElementId: string; stageId: string }[];
  channels: ChannelRow[];
  campaigns: CampaignRow[];
  leadMagnets: LeadMagnetRow[];
}

function stageIndexAt(x: number, stageCount: number): number | null {
  for (let i = 0; i < stageCount; i++) {
    const left = COL_X(i) - COL_GAP / 2;
    const right = COL_X(i) + COL_WIDTH + COL_GAP / 2;
    if (x >= left && x < right) return i;
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
  const [warning, setWarning] = useState<string | null>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

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

  const stagesForSegment = useMemo(
    () =>
      (data?.stages ?? [])
        .filter((s) => s.segmentId === segmentId)
        .sort((a, b) => (a.orderIdx ?? 0) - (b.orderIdx ?? 0)),
    [data, segmentId]
  );

  const buildGraph = useCallback(
    (d: BoardData, stages: StageRow[], editable: boolean) => {
      const nextNodes: Node[] = [];
      const nextEdges: Edge[] = [];
      const stageIds = new Set(stages.map((s) => s.id));
      const elementsForSegment = d.elements.filter((e) => stageIds.has(e.stageId));
      const elementIds = new Set(elementsForSegment.map((e) => e.id));

      // Kolumny = etapy zakupu segmentu.
      stages.forEach((stage, i) => {
        const tint = phaseTint(stage.phase);
        const salesOwned = stage.ownerSide === "sales" || stage.ownerSide === "shared";
        nextNodes.push({
          id: `col-${stage.id}`,
          position: { x: COL_X(i), y: 0 },
          data: {
            label: `${i + 1}. ${stage.name}${tint && stage.phase ? `  ·  ${stage.phase}` : ""}${salesOwned ? "  🤝" : ""}`,
          },
          draggable: false,
          connectable: editable,
          type: "default",
          style: {
            background: tint ? `${tint}14` : "var(--muted)",
            border: `1px dashed ${tint ?? "var(--border)"}`,
            color: tint ?? "var(--foreground)",
            borderRadius: 10,
            fontSize: 11,
            fontWeight: 700,
            width: COL_WIDTH,
            padding: 8,
            textAlign: "center",
          },
        });
      });

      const byStage = new Map<string, ElementRow[]>();
      for (const el of elementsForSegment) {
        if (!byStage.has(el.stageId)) byStage.set(el.stageId, []);
        byStage.get(el.stageId)!.push(el);
      }

      let maxRows = 0;
      stages.forEach((stage, colIdx) => {
        const list = (byStage.get(stage.id) ?? []).sort(
          (a, b) => (a.position ?? 0) - (b.position ?? 0)
        );
        maxRows = Math.max(maxRows, list.length);
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

        if (editable && list.length === 0) {
          // Ghost-cell luki: etap bez żadnej odpowiedzi treścią.
          nextNodes.push({
            id: `ghost-${stage.id}`,
            position: { x: COL_X(colIdx), y: ROW_START_Y },
            data: { label: "⚠ luka: brak treści — kliknij, aby dodać" },
            draggable: false,
            selectable: false,
            connectable: false,
            type: "default",
            style: {
              background: "transparent",
              border: "1px dashed #f59e0b99",
              color: "#d97706",
              borderRadius: 10,
              fontSize: 11,
              width: COL_WIDTH,
              padding: "10px 10px",
              textAlign: "center",
              cursor: "pointer",
            },
          });
        }
      });

      if (isEditorAddRow(editable)) {
        const addY = ROW_START_Y + Math.max(maxRows, 1) * ROW_HEIGHT + 12;
        stages.forEach((stage, colIdx) => {
          nextNodes.push({
            id: `add-${stage.id}`,
            position: { x: COL_X(colIdx), y: addY },
            data: { label: "+ dodaj treść" },
            draggable: false,
            selectable: false,
            connectable: false,
            type: "default",
            style: {
              background: "transparent",
              border: "1px dashed var(--border)",
              color: "var(--muted-foreground)",
              borderRadius: 8,
              fontSize: 11,
              width: COL_WIDTH,
              padding: "6px 8px",
              textAlign: "center",
              cursor: "pointer",
            },
          });
        });
      }

      // Prawa szyna: kanały.
      const channelColX = COL_X(stages.length) + 40;
      const usedChannelIds = new Set(
        d.elementChannels
          .filter((ec) => elementIds.has(ec.funnelElementId))
          .map((ec) => ec.channelId)
      );
      d.channels.forEach((c, i) => {
        nextNodes.push({
          id: `ch-${c.id}`,
          position: { x: channelColX, y: ROW_START_Y + i * 56 },
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

      // Lewa szyna: kampanie + lead magnety segmentu.
      const railCampaigns = d.campaigns.filter(
        (c) => !c.segmentId || c.segmentId === segmentIdOf(stages)
      );
      const railMagnets = d.leadMagnets.filter(
        (m) => !m.segmentId || m.segmentId === segmentIdOf(stages)
      );
      const usedCampaignIds = new Set(
        d.elementCampaigns
          .filter((ec) => elementIds.has(ec.funnelElementId))
          .map((ec) => ec.campaignId)
      );
      const usedMagnetIds = new Set(
        d.magnetStages.filter((ms) => stageIds.has(ms.stageId)).map((ms) => ms.leadMagnetId)
      );

      let railY = ROW_START_Y;
      if (railCampaigns.length > 0) {
        nextNodes.push(railHeader("rail-camp", "🟪 Kampanie", LEFT_RAIL_X, railY - 34));
      }
      railCampaigns.forEach((c) => {
        nextNodes.push({
          id: `camp-${c.id}`,
          position: { x: LEFT_RAIL_X, y: railY },
          data: { label: c.name },
          draggable: false,
          type: "default",
          style: {
            background: usedCampaignIds.has(c.id) ? "var(--card)" : "transparent",
            border: "1px solid #a78bfa66",
            color: "var(--foreground)",
            borderRadius: 8,
            fontSize: 11,
            width: LEFT_RAIL_WIDTH,
            padding: "6px 8px",
            opacity: usedCampaignIds.has(c.id) ? 1 : 0.6,
          },
        });
        railY += 52;
      });
      if (railMagnets.length > 0) {
        railY += 30;
        nextNodes.push(railHeader("rail-lm", "🧲 Lead magnety", LEFT_RAIL_X, railY - 34));
      }
      railMagnets.forEach((m) => {
        nextNodes.push({
          id: `lm-${m.id}`,
          position: { x: LEFT_RAIL_X, y: railY },
          data: { label: m.name },
          draggable: false,
          type: "default",
          style: {
            background: usedMagnetIds.has(m.id) ? "var(--card)" : "transparent",
            border: "1px solid #fdba7466",
            color: "var(--foreground)",
            borderRadius: 8,
            fontSize: 11,
            width: LEFT_RAIL_WIDTH,
            padding: "6px 8px",
            opacity: usedMagnetIds.has(m.id) ? 1 : 0.6,
          },
        });
        railY += 52;
      });

      // Krawędzie.
      for (const ec of d.elementChannels) {
        if (!elementIds.has(ec.funnelElementId)) continue;
        nextEdges.push({
          id: `ec-${ec.funnelElementId}-${ec.channelId}`,
          source: ec.funnelElementId,
          target: `ch-${ec.channelId}`,
          label: "publikowany w",
          labelStyle: { fontSize: 9, fill: "var(--muted-foreground)" },
          style: { stroke: "var(--border)", strokeWidth: 1.5 },
          markerEnd: { type: MarkerType.ArrowClosed },
        });
      }
      for (const ec of d.elementCampaigns) {
        if (!elementIds.has(ec.funnelElementId)) continue;
        nextEdges.push({
          id: `ecmp-${ec.funnelElementId}-${ec.campaignId}`,
          source: ec.funnelElementId,
          target: `camp-${ec.campaignId}`,
          label: "promowany przez",
          labelStyle: { fontSize: 9, fill: "var(--muted-foreground)" },
          style: { stroke: "#a78bfa88", strokeWidth: 1.5 },
          markerEnd: { type: MarkerType.ArrowClosed },
        });
      }
      for (const ms of d.magnetStages) {
        if (!stageIds.has(ms.stageId)) continue;
        nextEdges.push({
          id: `ms-${ms.leadMagnetId}-${ms.stageId}`,
          source: `lm-${ms.leadMagnetId}`,
          target: `col-${ms.stageId}`,
          label: "używany w etapie",
          labelStyle: { fontSize: 9, fill: "var(--muted-foreground)" },
          style: { stroke: "#fdba7488", strokeWidth: 1.5 },
          markerEnd: { type: MarkerType.ArrowClosed },
        });
      }
      for (const ns of d.elementNextStages) {
        if (!elementIds.has(ns.funnelElementId) || !stageIds.has(ns.stageId)) continue;
        nextEdges.push({
          id: `next-${ns.funnelElementId}-${ns.stageId}`,
          source: ns.funnelElementId,
          target: `col-${ns.stageId}`,
          label: "prowadzi do etapu",
          labelStyle: { fontSize: 9, fill: "var(--muted-foreground)" },
          style: { stroke: "#34d39988", strokeWidth: 1.5, strokeDasharray: "4 3" },
          markerEnd: { type: MarkerType.ArrowClosed },
        });
      }

      return { nodes: nextNodes, edges: nextEdges };
    },
    []
  );

  useEffect(() => {
    if (!data || !segmentId) return;
    const g = buildGraph(data, stagesForSegment, isEditor);
    setNodes(g.nodes);
    setEdges(g.edges);
  }, [data, segmentId, stagesForSegment, buildGraph, setNodes, setEdges, isEditor]);

  const elementIds = useMemo(() => {
    const stageIds = new Set(stagesForSegment.map((s) => s.id));
    return new Set(
      (data?.elements ?? []).filter((e) => stageIds.has(e.stageId)).map((e) => e.id)
    );
  }, [data, stagesForSegment]);

  const createElement = useCallback(
    async (stageId: string) => {
      const stage = stagesForSegment.find((s) => s.id === stageId);
      if (!stage) return;
      await upsertFunnelElement({
        projectId,
        name: "Nowa treść",
        stageId,
        segmentId: stage.segmentId,
        position: (data?.elements ?? []).filter((e) => e.stageId === stageId).length,
      });
      await refresh();
    },
    [projectId, stagesForSegment, data, refresh]
  );

  const onNodeClick = useCallback(
    (_evt: React.MouseEvent, node: Node) => {
      if (!isEditor) return;
      if (node.id.startsWith("ghost-")) {
        void createElement(node.id.replace(/^ghost-/, ""));
      } else if (node.id.startsWith("add-")) {
        void createElement(node.id.replace(/^add-/, ""));
      }
    },
    [isEditor, createElement]
  );

  const onNodeDragStop: OnNodeDrag = useCallback(
    async (_evt, node) => {
      if (!isEditor || !data || !elementIds.has(node.id)) return;
      const el = data.elements.find((e) => e.id === node.id);
      if (!el) return;

      const targetIdx = stageIndexAt(node.position.x + COL_WIDTH / 2, stagesForSegment.length);
      const targetStage = targetIdx !== null ? stagesForSegment[targetIdx] : null;

      if (!targetStage || targetStage.id === el.stageId) {
        const g = buildGraph(data, stagesForSegment, isEditor);
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
    [data, elementIds, stagesForSegment, buildGraph, setNodes, projectId, refresh, isEditor]
  );

  const postRelation = useCallback(
    async (
      source: { type: string; id: string },
      target: { type: string; id: string },
      relationType: string
    ) => {
      try {
        await fetch(`/api/strategy-hub/projects/${projectId}/relations`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ source, target, relationType }),
          signal: AbortSignal.timeout(8000),
        });
      } finally {
        await refresh();
      }
    },
    [projectId, refresh]
  );

  const onConnect = useCallback(
    async (conn: Connection) => {
      if (!isEditor || !conn.source || !conn.target) return;
      const src = conn.source;
      const tgt = conn.target;

      // element → kanał = „publikowany w" (istniejący endpoint relacji elementu).
      if (elementIds.has(src) && tgt.startsWith("ch-")) {
        setEdges((eds) => addEdge({ ...conn, markerEnd: { type: MarkerType.ArrowClosed } }, eds));
        const channelId = tgt.replace(/^ch-/, "");
        try {
          await fetch(
            `/api/strategy-hub/projects/${projectId}/funnel-elements/${src}/relations`,
            {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                channelIds: Array.from(
                  new Set([
                    ...(data?.elementChannels
                      .filter((ec) => ec.funnelElementId === src)
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
        return;
      }

      // element → kampania = „promowany przez".
      if (elementIds.has(src) && tgt.startsWith("camp-")) {
        await postRelation(
          { type: "element", id: src },
          { type: "campaign", id: tgt.replace(/^camp-/, "") },
          "promowany_przez"
        );
        return;
      }

      // element → nagłówek etapu = „prowadzi do etapu" (wyjście CTA do przodu).
      if (elementIds.has(src) && tgt.startsWith("col-")) {
        await postRelation(
          { type: "element", id: src },
          { type: "stage", id: tgt.replace(/^col-/, "") },
          "prowadzi_do_etapu"
        );
        return;
      }

      // lead magnet → nagłówek etapu = „używany w etapie".
      if (src.startsWith("lm-") && tgt.startsWith("col-")) {
        await postRelation(
          { type: "lead_magnet", id: src.replace(/^lm-/, "") },
          { type: "stage", id: tgt.replace(/^col-/, "") },
          "uzywany_w_etapie"
        );
        return;
      }
    },
    [isEditor, elementIds, projectId, data, setEdges, refresh, postRelation]
  );

  const autoLayout = useCallback(() => {
    if (!data || !segmentId) return;
    const g = buildGraph(data, stagesForSegment, isEditor);
    setNodes(g.nodes);
  }, [data, segmentId, stagesForSegment, buildGraph, setNodes, isEditor]);

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
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground">
            kolumny = etapy zakupu segmentu (edytuj w Podróży zakupowej)
          </span>
          {isEditor && (
            <button
              type="button"
              onClick={autoLayout}
              className="flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[10px] font-medium text-muted-foreground hover:text-foreground"
              title="Auto-layout (⌘L)"
            >
              <LayoutGrid className="size-3" />
              ⌘L
            </button>
          )}
        </div>
      </div>

      {stagesForSegment.length === 0 && segmentId && (
        <div className="flex items-center gap-1.5 rounded-md border border-amber-500/30 bg-amber-500/10 px-2.5 py-1.5 text-[11px] text-amber-500">
          <AlertTriangle className="size-3.5 shrink-0" />
          Ten segment nie ma jeszcze etapów zakupu — zdefiniuj podróż zakupową w
          module Rynek → Podróż zakupowa.
        </div>
      )}

      {warning && (
        <div className="flex items-center gap-1.5 rounded-md border border-amber-500/30 bg-amber-500/10 px-2.5 py-1.5 text-[11px] text-amber-500">
          <AlertTriangle className="size-3.5 shrink-0" />
          {warning}
        </div>
      )}

      <div className="h-[560px] w-full rounded-xl border border-border overflow-hidden bg-card/20">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={isEditor ? onNodesChange : undefined}
          onEdgesChange={isEditor ? onEdgesChange : undefined}
          onNodeDragStop={isEditor ? onNodeDragStop : undefined}
          onNodeClick={isEditor ? onNodeClick : undefined}
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

function segmentIdOf(stages: StageRow[]): string | null {
  return stages[0]?.segmentId ?? null;
}

function isEditorAddRow(editable: boolean): boolean {
  return editable;
}

function railHeader(id: string, label: string, x: number, y: number): Node {
  return {
    id,
    position: { x, y },
    data: { label },
    draggable: false,
    selectable: false,
    connectable: false,
    type: "default",
    style: {
      background: "transparent",
      border: "none",
      color: "var(--muted-foreground)",
      fontSize: 10,
      fontWeight: 700,
      width: LEFT_RAIL_WIDTH,
      padding: 0,
      textAlign: "left",
      boxShadow: "none",
    },
  };
}
