"use client";

import { useMemo, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MarkerType,
  type Node,
  type Edge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  ENTITY_COLORS,
  ENTITY_LABELS,
  PHASE_COLORS,
  PHASE_LABELS,
  type InfluenceGraph,
  type InfluenceEntityType,
  type FunnelPhase,
} from "@/lib/strategy-hub/strategy-map-types";

// Kolejność kolumn lewo→prawo (3 strefy: przyczyna → oś → skutek).
const COLUMN: Record<InfluenceEntityType, number> = {
  stage: 0,
  objection: 0,
  problem: 0,
  goal: 0,
  element: 1,
  flow: 2,
  channel: 2,
  kpi: 2,
  campaign: 2,
  geo: 2,
  page: 3,
  seo: 4,
};

const COL_X = [40, 380, 720, 1020, 1320];
const ROW_H = 88;

type ColorMode = "type" | "phase";

interface InfluenceViewProps {
  graph: InfluenceGraph;
  onBack: () => void;
}

export function InfluenceView({ graph, onBack }: InfluenceViewProps) {
  const [colorMode, setColorMode] = useState<ColorMode>("type");
  const [segmentId, setSegmentId] = useState<string>("__all__");
  const [phase, setPhase] = useState<FunnelPhase | "__all__">("__all__");
  const [elementId, setElementId] = useState<string>(() => graph.elements[0]?.id ?? "");
  const [focusId, setFocusId] = useState<string | null>(null);

  // Elementy spełniające filtry segment/faza.
  const filteredElements = useMemo(() => {
    return graph.elements.filter((el) => {
      if (segmentId !== "__all__" && el.segmentId !== segmentId) return false;
      if (phase !== "__all__" && el.phase !== phase) return false;
      return true;
    });
  }, [graph.elements, segmentId, phase]);

  // Domyślnie 1 element; przy aktywnym filtrze segment/faza pokaż wszystkie z filtra.
  const focusElementIds = useMemo(() => {
    if (segmentId !== "__all__" || phase !== "__all__") {
      return new Set(filteredElements.map((e) => `el-${e.id}`));
    }
    return new Set(elementId ? [`el-${elementId}`] : []);
  }, [segmentId, phase, filteredElements, elementId]);

  // Podgraf widoczny dla wybranego focusu (przyczyny + łańcuch skutków).
  const { nodes, edges } = useMemo(() => {
    if (focusElementIds.size === 0) return { nodes: [], edges: [] };

    const visible = new Set<string>(focusElementIds);
    // Przyczyny: 1 skok do elementów.
    for (const l of graph.links) {
      if (visible.has(l.target)) visible.add(l.source);
    }
    // Skutki: BFS w przód od elementów.
    const queue = [...focusElementIds];
    while (queue.length) {
      const cur = queue.shift()!;
      for (const l of graph.links) {
        if (l.source === cur && !visible.has(l.target)) {
          visible.add(l.target);
          queue.push(l.target);
        }
      }
    }

    const visNodes = graph.nodes.filter((n) => visible.has(n.id));
    const visLinks = graph.links.filter(
      (l) => visible.has(l.source) && visible.has(l.target)
    );

    // Łańcuch skupienia (focus mode) — węzły połączone z focusId.
    const chain = new Set<string>();
    if (focusId) {
      chain.add(focusId);
      let added = true;
      while (added) {
        added = false;
        for (const l of visLinks) {
          if (chain.has(l.source) && !chain.has(l.target)) {
            chain.add(l.target);
            added = true;
          }
          if (chain.has(l.target) && !chain.has(l.source)) {
            chain.add(l.source);
            added = true;
          }
        }
      }
    }

    // Pozycje: kolumna wg typu, wiersz wg kolejności w kolumnie.
    const colCount: Record<number, number> = {};
    const disconnectedEls = new Set(
      graph.elements.filter((e) => e.disconnected).map((e) => `el-${e.id}`)
    );

    const rfNodes: Node[] = visNodes.map((n) => {
      const col = COLUMN[n.type];
      const row = colCount[col] ?? 0;
      colCount[col] = row + 1;
      const color =
        colorMode === "phase" && n.phase
          ? PHASE_COLORS[n.phase]
          : ENTITY_COLORS[n.type];
      const dimmed = focusId ? !chain.has(n.id) : false;
      const missing = n.type === "element" && disconnectedEls.has(n.id);
      return {
        id: n.id,
        position: { x: COL_X[col], y: 40 + row * ROW_H },
        data: { label: n.label },
        type: "default",
        style: {
          background: `${color}1a`,
          border: `${missing ? 2 : 1}px solid ${missing ? "#ef4444" : `${color}88`}`,
          borderRadius: 10,
          fontSize: 11,
          fontWeight: n.type === "element" ? 600 : 500,
          color: "var(--foreground)",
          width: 150,
          padding: "6px 8px",
          opacity: dimmed ? 0.25 : 1,
          boxShadow: n.type === "element" ? `0 0 0 1px ${color}44` : undefined,
        },
      };
    });

    const rfEdges: Edge[] = visLinks.map((l) => {
      const dimmed = focusId ? !(chain.has(l.source) && chain.has(l.target)) : false;
      const strong = l.strength === "strong";
      const weak = l.strength === "weak";
      return {
        id: l.id,
        source: l.source,
        target: l.target,
        label: l.label,
        labelStyle: { fontSize: 9, fill: "var(--muted-foreground)" },
        labelBgStyle: { fill: "var(--card)", fillOpacity: 0.85 },
        style: {
          stroke: "var(--muted-foreground)",
          strokeWidth: strong ? 2 : 1,
          strokeDasharray: weak ? "4 3" : undefined,
          opacity: dimmed ? 0.12 : 0.55,
        },
        markerEnd: { type: MarkerType.ArrowClosed, color: "var(--muted-foreground)" },
      };
    });

    return { nodes: rfNodes, edges: rfEdges };
  }, [graph, focusElementIds, focusId, colorMode]);

  const usedTypes = useMemo(() => {
    const set = new Set<InfluenceEntityType>();
    for (const n of graph.nodes) set.add(n.type);
    return [...set];
  }, [graph.nodes]);

  const hasData = graph.elements.length > 0;

  return (
    <div className="space-y-3">
      {/* Pasek narzędzi */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-medium hover:border-brand/40"
        >
          <ArrowLeft className="size-3.5" /> Mapa
        </button>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          {/* Color toggle */}
          <div className="flex rounded-lg border border-border bg-card p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setColorMode("type")}
              className={cn(
                "rounded-md px-2 py-1 transition-colors",
                colorMode === "type" ? "bg-brand/15 text-brand" : "text-muted-foreground"
              )}
            >
              Po typie
            </button>
            <button
              type="button"
              onClick={() => setColorMode("phase")}
              className={cn(
                "rounded-md px-2 py-1 transition-colors",
                colorMode === "phase" ? "bg-brand/15 text-brand" : "text-muted-foreground"
              )}
            >
              Po fazie
            </button>
          </div>

          {/* Element focus (gdy brak filtra segment/faza) */}
          {segmentId === "__all__" && phase === "__all__" && (
            <select
              value={elementId}
              onChange={(e) => setElementId(e.target.value)}
              className="rounded-lg border border-border bg-card px-2 py-1.5 text-xs"
            >
              {graph.elements.map((el) => (
                <option key={el.id} value={el.id}>
                  {el.label}
                  {el.phase ? ` · ${el.phase}` : ""}
                </option>
              ))}
            </select>
          )}

          <select
            value={segmentId}
            onChange={(e) => setSegmentId(e.target.value)}
            className="rounded-lg border border-border bg-card px-2 py-1.5 text-xs"
          >
            <option value="__all__">Wszystkie segmenty</option>
            {graph.segments.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>

          <select
            value={phase}
            onChange={(e) => setPhase(e.target.value as FunnelPhase | "__all__")}
            className="rounded-lg border border-border bg-card px-2 py-1.5 text-xs"
          >
            <option value="__all__">Wszystkie fazy</option>
            {(["TOFU", "MOFU", "BOFU", "retention"] as FunnelPhase[]).map((p) => (
              <option key={p} value={p}>
                {PHASE_LABELS[p]}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Legenda */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
        {colorMode === "type"
          ? usedTypes.map((t) => (
              <span key={t} className="inline-flex items-center gap-1">
                <span className="size-2 rounded-full" style={{ background: ENTITY_COLORS[t] }} />
                {ENTITY_LABELS[t]}
              </span>
            ))
          : (Object.keys(PHASE_COLORS) as FunnelPhase[]).map((p) => (
              <span key={p} className="inline-flex items-center gap-1">
                <span className="size-2 rounded-full" style={{ background: PHASE_COLORS[p] }} />
                {PHASE_LABELS[p]}
              </span>
            ))}
        <span className="inline-flex items-center gap-1">
          <span className="size-2 rounded-sm border-2 border-red-500" /> niepodłączony
        </span>
      </div>

      <div className="h-[520px] overflow-hidden rounded-2xl border border-border bg-card">
        {hasData ? (
          <ReactFlow
            nodes={nodes}
            edges={edges}
            fitView
            minZoom={0.2}
            proOptions={{ hideAttribution: true }}
            onNodeClick={(_, n) => setFocusId((cur) => (cur === n.id ? null : n.id))}
            onPaneClick={() => setFocusId(null)}
            nodesDraggable={false}
            nodesConnectable={false}
          >
            <Background gap={24} size={1} color="var(--border)" />
            <Controls showInteractive={false} />
          </ReactFlow>
        ) : (
          <div className="flex h-full items-center justify-center text-center text-sm text-muted-foreground">
            <div>
              <p>Brak elementów lejka do zwizualizowania.</p>
              <p className="mt-1 text-xs text-muted-foreground/60">
                Uzupełnij lejek i powiązania, aby zobaczyć graf wpływu.
              </p>
            </div>
          </div>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        Kliknij węzeł, aby skupić jego łańcuch wpływu (przyczyny → element → skutki).
        Styl linii koduje siłę relacji.
      </p>
    </div>
  );
}
