"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MarkerType,
  useReactFlow,
  getNodesBounds,
  getViewportForBounds,
  type Node,
  type Edge,
  type NodeMouseHandler,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { toPng, toSvg } from "html-to-image";
import { ArrowUpRight, Download, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  GraphEntityType,
  GraphNode,
  RelationGraphData,
} from "@/lib/strategy-hub/relation-graph";

const TYPE_LABEL: Record<GraphEntityType, string> = {
  segment: "Segment",
  stage: "Etap zakupu",
  element: "Element lejka",
  channel: "Kanał",
  kpi: "KPI",
  page: "Podstrona",
  campaign: "Kampania",
  geo: "GEO/AEO",
  offer: "Oferta",
  flow: "User flow",
  competitor: "Konkurent",
  objection: "Obiekcja",
};

const COLUMN_ORDER: GraphEntityType[] = [
  "segment",
  "competitor",
  "objection",
  "stage",
  "element",
  "channel",
  "kpi",
  "flow",
  "campaign",
  "geo",
  "page",
  "offer",
];

const COL_X: Record<GraphEntityType, number> = COLUMN_ORDER.reduce(
  (acc, t, i) => ({ ...acc, [t]: 40 + i * 220 }),
  {} as Record<GraphEntityType, number>
);

const ROW_H = 74;

interface RelationGraphProps {
  projectId: string;
  data: RelationGraphData;
}

export function RelationGraph({ projectId, data }: RelationGraphProps) {
  return (
    <ReactFlowProvider>
      <RelationGraphInner projectId={projectId} data={data} />
    </ReactFlowProvider>
  );
}

function RelationGraphInner({ projectId, data }: RelationGraphProps) {
  const flowRef = useRef<HTMLDivElement>(null);
  const { getNodes } = useReactFlow();
  const [hiddenTypes, setHiddenTypes] = useState<Set<GraphEntityType>>(new Set());
  const [selected, setSelected] = useState<GraphNode | null>(null);
  const [saving, setSaving] = useState<"idle" | "saving" | "saved">("idle");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const usedTypes = useMemo(() => {
    const set = new Set<GraphEntityType>();
    for (const n of data.nodes) set.add(n.type);
    return COLUMN_ORDER.filter((t) => set.has(t));
  }, [data.nodes]);

  const byId = useMemo(() => new Map(data.nodes.map((n) => [n.id, n])), [data.nodes]);

  const { initialNodes, initialEdges } = useMemo(() => {
    const colCount: Record<string, number> = {};
    const visibleNodes = data.nodes.filter((n) => !hiddenTypes.has(n.type));
    const visibleIds = new Set(visibleNodes.map((n) => n.id));

    const rfNodes: Node[] = visibleNodes.map((n) => {
      const saved = data.savedLayout?.[n.id];
      let position = saved;
      if (!position) {
        const row = colCount[n.type] ?? 0;
        colCount[n.type] = row + 1;
        position = { x: COL_X[n.type] ?? 40, y: 40 + row * ROW_H };
      }
      return {
        id: n.id,
        position,
        data: { label: n.label, meta: n.meta, gnode: n },
        type: "default",
        style: {
          background: `${n.color}1a`,
          border: `1px solid ${n.color}88`,
          borderRadius: 10,
          fontSize: 11,
          fontWeight: 500,
          color: "var(--foreground)",
          width: 172,
          padding: "6px 8px",
        },
      };
    });

    const rfEdges: Edge[] = data.edges
      .filter((e) => visibleIds.has(e.source) && visibleIds.has(e.target))
      .map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        label: e.label,
        labelStyle: { fontSize: 9, fill: "var(--muted-foreground)" },
        labelBgStyle: { fill: "var(--card)", fillOpacity: 0.85 },
        style: {
          stroke: "var(--muted-foreground)",
          strokeWidth: 1,
          opacity: 0.5,
        },
        markerEnd: { type: MarkerType.ArrowClosed, color: "var(--muted-foreground)" },
      }));

    return { initialNodes: rfNodes, initialEdges: rfEdges };
  }, [data, hiddenTypes]);

  const persistLayout = useCallback(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      setSaving("saving");
      const layout: Record<string, { x: number; y: number }> = {};
      for (const n of getNodes()) layout[n.id] = n.position;
      try {
        await fetch(`/api/strategy-hub/projects/${projectId}/relation-graph`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ layout }),
        });
        setSaving("saved");
        setTimeout(() => setSaving("idle"), 1500);
      } catch {
        setSaving("idle");
      }
    }, 700);
  }, [getNodes, projectId]);

  const onNodeClick: NodeMouseHandler = useCallback(
    (_e, node) => {
      const gnode = byId.get(node.id);
      if (gnode) setSelected(gnode);
    },
    [byId]
  );

  const toggleType = (t: GraphEntityType) => {
    setHiddenTypes((cur) => {
      const next = new Set(cur);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      return next;
    });
  };

  const exportImage = async (format: "png" | "svg") => {
    const el = flowRef.current?.querySelector(".react-flow__viewport") as HTMLElement | null;
    const viewportEl = flowRef.current?.querySelector(".react-flow") as HTMLElement | null;
    if (!el || !viewportEl) return;
    const bounds = getNodesBounds(getNodes());
    const padding = 60;
    const width = bounds.width + padding * 2;
    const height = bounds.height + padding * 2;
    const vp = getViewportForBounds(bounds, width, height, 0.2, 2, padding);
    const fn = format === "png" ? toPng : toSvg;
    const dataUrl = await fn(el, {
      backgroundColor: "var(--background)",
      width,
      height,
      style: {
        width: `${width}px`,
        height: `${height}px`,
        transform: `translate(${vp.x}px, ${vp.y}px) scale(${vp.zoom})`,
      },
    });
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `graf-relacji.${format}`;
    a.click();

    fetch(`/api/strategy-hub/projects/${projectId}/exports`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: format === "png" ? "png_map" : "svg_graph" }),
    }).catch(() => {});
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          {usedTypes.map((t) => {
            const color = data.nodes.find((n) => n.type === t)?.color ?? "#999";
            const active = !hiddenTypes.has(t);
            return (
              <button
                key={t}
                type="button"
                onClick={() => toggleType(t)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-[11px] font-medium transition-opacity",
                  active ? "opacity-100" : "opacity-35"
                )}
                style={{ borderColor: `${color}88`, background: `${color}14` }}
              >
                <span className="size-1.5 rounded-full" style={{ background: color }} />
                {TYPE_LABEL[t]}
              </button>
            );
          })}
        </div>
        <div className="ml-auto flex items-center gap-2">
          {saving !== "idle" && (
            <span className="text-[11px] text-muted-foreground">
              {saving === "saving" ? "Zapisywanie…" : "Zapisano ✓"}
            </span>
          )}
          <button
            type="button"
            onClick={() => exportImage("png")}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-medium hover:border-brand/40"
          >
            <Download className="size-3.5" /> PNG
          </button>
          <button
            type="button"
            onClick={() => exportImage("svg")}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-medium hover:border-brand/40"
          >
            <Download className="size-3.5" /> SVG
          </button>
        </div>
      </div>

      <div ref={flowRef} className="relative h-[640px] overflow-hidden rounded-2xl border border-border">
        <ReactFlow
          nodes={initialNodes}
          edges={initialEdges}
          onNodeClick={onNodeClick}
          onNodeDragStop={persistLayout}
          fitView
          proOptions={{ hideAttribution: true }}
        >
          <Background />
          <Controls showInteractive={false} />
        </ReactFlow>

        {selected && (
          <div className="absolute right-3 top-3 z-10 w-64 rounded-xl border border-border bg-card/95 p-3 shadow-lg backdrop-blur">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <span
                  className="rounded-full px-1.5 py-0.5 text-[10px] font-medium"
                  style={{ background: `${selected.color}22`, color: selected.color }}
                >
                  {TYPE_LABEL[selected.type]}
                </span>
                <h4 className="mt-1 truncate text-sm font-semibold">{selected.label}</h4>
                {selected.meta && (
                  <p className="text-xs text-muted-foreground">{selected.meta}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-muted"
                aria-label="Zamknij"
              >
                <X className="size-3.5" />
              </button>
            </div>
            <Link
              href={selected.href}
              className="mt-2 inline-flex items-center gap-1 rounded-lg bg-brand/10 px-2.5 py-1.5 text-xs font-medium text-brand hover:bg-brand/20"
            >
              Otwórz w edytorze <ArrowUpRight className="size-3.5" />
            </Link>
          </div>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        {data.nodes.length} encji · {data.edges.length} relacji. Przeciągnij węzeł, by
        zapisać własny układ.
      </p>
    </div>
  );
}
