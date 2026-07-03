"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { motion, useMotionTemplate } from "motion/react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ConstellationData, ConstellationNode } from "@/lib/strategy-hub/constellation-types";
import {
  CORE_NODE_ID,
  areaNodeId,
} from "@/lib/strategy-hub/constellation-types";
import type { StrategyArea } from "@/lib/strategy-hub/entities/entity-types";
import {
  mapFocusNodeId,
  onMapFocus,
  type MapFocusDetail,
} from "@/lib/strategy-hub/map-focus-bus";
import { computeRadialLayout } from "./radial-layout";
import { useCamera } from "./use-camera";
import { ConstellationNodeView, nodeRadius } from "./constellation-node";
import { EntityPanel } from "./entity-panel";
import { AreaNavigator } from "./area-navigator";

interface ConstellationViewProps {
  projectId: string;
  mode: "editor" | "client";
  initialFocus?: string;
}

function crossLinkPath(
  x1: number,
  y1: number,
  x2: number,
  y2: number
): string {
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const cx = mx * 0.35;
  const cy = my * 0.35;
  return `M ${x1} ${y1} Q ${cx} ${cy}, ${x2} ${y2}`;
}

export function ConstellationView({
  projectId,
  mode,
  initialFocus,
}: ConstellationViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [data, setData] = useState<ConstellationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [focusedId, setFocusedId] = useState<string | null>(initialFocus ?? null);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const [highlightedLinkIds, setHighlightedLinkIds] = useState<Set<string>>(
    () => new Set()
  );
  const [panelNode, setPanelNode] = useState<ConstellationNode | null>(null);
  const [liveMessage, setLiveMessage] = useState("");
  const [viewport, setViewport] = useState({ w: 960, h: 560 });

  const camera = useCamera();
  const svgTransform = useMotionTemplate`${camera.transform}`;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/strategy-hub/projects/${projectId}/constellation?mode=${mode}`,
        { signal: AbortSignal.timeout(15_000) }
      );
      if (!res.ok) {
        setError("Nie udało się załadować konstelacji");
        return;
      }
      const json = (await res.json()) as ConstellationData;
      setData(json);
    } catch {
      setError("Błąd połączenia z serwerem");
    } finally {
      setLoading(false);
    }
  }, [projectId, mode]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setViewport({ w: Math.max(320, width), h: Math.max(400, height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    camera.resetView(viewport.w, viewport.h);
  }, [viewport.w, viewport.h, camera]);

  const layout = useMemo(() => {
    if (!data) return new Map<string, { x: number; y: number; angle: number }>();
    return computeRadialLayout(
      data.nodes.map((n) => ({ id: n.id, parentId: n.parentId })),
      data.areasOrder,
      0,
      0
    );
  }, [data]);

  const nodeById = useMemo(() => {
    const map = new Map<string, ConstellationNode>();
    for (const n of data?.nodes ?? []) map.set(n.id, n);
    return map;
  }, [data]);

  const announceFocus = useCallback(
    (id: string) => {
      const node = nodeById.get(id);
      if (!node) return;
      setLiveMessage(`Fokus: ${node.label}`);
    },
    [nodeById]
  );

  const focusNodeById = useCallback(
    (id: string, zoom = true) => {
      const pos = layout.get(id);
      if (!pos) return;
      setFocusedId(id);
      announceFocus(id);
      if (zoom) {
        const node = nodeById.get(id);
        const targetScale =
          node?.kind === "entity" ? 1.25 : node?.kind === "area" ? 0.95 : 0.75;
        camera.focusNode(pos, viewport.w, viewport.h, targetScale);
      }
    },
    [layout, nodeById, announceFocus, camera, viewport]
  );

  useEffect(() => {
    if (initialFocus && layout.has(initialFocus)) {
      focusNodeById(initialFocus);
    }
  }, [initialFocus, layout, focusNodeById]);

  useEffect(() => {
    const handleMapFocus = (detail: MapFocusDetail) => {
      const nodeId = mapFocusNodeId(detail.entityType, detail.entityId);
      if (!layout.has(nodeId)) return;

      if (detail.mode === "focus") {
        setHighlightedLinkIds(new Set());
        setHighlightedId(null);
        focusNodeById(nodeId);
        return;
      }

      if (detail.mode === "highlight") {
        setHighlightedId(nodeId);
        setFocusedId(nodeId);
        announceFocus(nodeId);
        return;
      }

      if (detail.mode === "path") {
        setHighlightedId(nodeId);
        setFocusedId(nodeId);
        setHighlightedLinkIds(new Set(detail.pathIds ?? []));
        focusNodeById(nodeId);
      }
    };

    return onMapFocus(handleMapFocus);
  }, [layout, focusNodeById, announceFocus]);

  const entitiesInArea = useCallback(
    (area: StrategyArea) =>
      (data?.nodes ?? []).filter(
        (n) => n.kind === "entity" && n.parentId === areaNodeId(area)
      ),
    [data]
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!data) return;

    if (e.key === "Escape") {
      setPanelNode(null);
      setFocusedId(null);
      camera.resetView(viewport.w, viewport.h);
      return;
    }

    if (e.key === "Enter" && focusedId) {
      const node = nodeById.get(focusedId);
      if (node?.kind === "entity") setPanelNode(node);
      return;
    }

    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault();
      const areaIds = data.areasOrder.map((a) => areaNodeId(a));
      const idx = focusedId?.startsWith("area:")
        ? areaIds.indexOf(focusedId)
        : -1;
      const delta = e.key === "ArrowRight" ? 1 : -1;
      const nextIdx =
        idx < 0 ? 0 : (idx + delta + areaIds.length) % areaIds.length;
      focusNodeById(areaIds[nextIdx] ?? CORE_NODE_ID);
      return;
    }

    if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.preventDefault();
      const focused = focusedId ? nodeById.get(focusedId) : undefined;
      let area: StrategyArea | undefined;
      if (focused?.kind === "area") {
        area = data.areasOrder.find((a) => areaNodeId(a) === focused.id);
      } else if (focused?.parentId?.startsWith("area:")) {
        area = data.areasOrder.find((a) => areaNodeId(a) === focused.parentId);
      }
      if (!area) return;
      const ents = entitiesInArea(area);
      if (ents.length === 0) return;
      const curIdx =
        focused?.kind === "entity"
          ? ents.findIndex((n) => n.id === focused.id)
          : -1;
      const delta = e.key === "ArrowDown" ? 1 : -1;
      const nextIdx =
        curIdx < 0 ? 0 : (curIdx + delta + ents.length) % ents.length;
      const nextId = ents[nextIdx]?.id ?? ents[0]?.id;
      if (nextId) focusNodeById(nextId);
    }
  };

  const scale = camera.getScale();
  const showEntityLabels = scale >= 0.9;
  const showCrossLinks = scale >= 0.7;

  if (loading) {
    return (
      <div className="flex h-[520px] items-center justify-center gap-2 rounded-2xl border border-border bg-[oklch(0.13_0.02_260)] text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Ładowanie konstelacji…
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex h-[520px] items-center justify-center rounded-2xl border border-border bg-[oklch(0.13_0.02_260)] text-sm text-muted-foreground">
        {error ?? "Brak danych"}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative h-[min(72vh,640px)] min-h-[420px] overflow-hidden rounded-2xl border border-border",
        "bg-[oklch(0.13_0.02_260)]"
      )}
    >
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {liveMessage}
      </div>

      <svg
        width={viewport.w}
        height={viewport.h}
        tabIndex={0}
        role="img"
        aria-label="Widok konstelacji strategii"
        className="touch-none select-none outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
        onKeyDown={handleKeyDown}
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          e.currentTarget.setPointerCapture(e.pointerId);
          camera.panStart(e.clientX, e.clientY);
        }}
        onPointerMove={(e) => {
          if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
          camera.panMove(e.clientX, e.clientY);
        }}
        onPointerUp={(e) => {
          camera.panEnd();
          e.currentTarget.releasePointerCapture(e.pointerId);
        }}
        onWheel={(e) => {
          e.preventDefault();
          camera.zoomAt(e.clientX, e.clientY, e.deltaY);
        }}
      >
        <defs>
          <filter id="constellation-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <motion.g style={{ transform: svgTransform, transformOrigin: "0 0" }}>
          {data.links
            .filter((l) => l.kind === "tree")
            .map((link) => {
              const from = layout.get(link.sourceId);
              const to = layout.get(link.targetId);
              if (!from || !to) return null;
              return (
                <line
                  key={link.id}
                  x1={from.x}
                  y1={from.y}
                  x2={to.x}
                  y2={to.y}
                  stroke="oklch(0.45 0.02 260)"
                  strokeWidth={1}
                  strokeOpacity={0.35}
                />
              );
            })}

          {data.links
            .filter((l) => l.kind === "cross")
            .map((link) => {
              const show =
                showCrossLinks ||
                focusedId === link.sourceId ||
                focusedId === link.targetId ||
                highlightedLinkIds.has(link.id);
              if (!show) return null;
              const from = layout.get(link.sourceId);
              const to = layout.get(link.targetId);
              if (!from || !to) return null;
              const pathHighlighted = highlightedLinkIds.has(link.id);
              return (
                <path
                  key={link.id}
                  d={crossLinkPath(from.x, from.y, to.x, to.y)}
                  fill="none"
                  stroke={
                    pathHighlighted
                      ? "oklch(0.78 0.12 280)"
                      : link.aiGenerated
                        ? "#a78bfa"
                        : "oklch(0.65 0.04 260)"
                  }
                  strokeWidth={pathHighlighted ? 2.5 : 1.2}
                  strokeDasharray={link.aiGenerated ? "2 4" : "4 4"}
                  strokeOpacity={pathHighlighted ? 0.95 : 0.55}
                />
              );
            })}

          {data.nodes.map((node, index) => {
            const pos = layout.get(node.id);
            if (!pos) return null;
            const focused = focusedId === node.id;
            const highlighted = highlightedId === node.id;
            const showLabel =
              node.kind === "area" ||
              focused ||
              (node.kind === "entity" && showEntityLabels);
            return (
              <ConstellationNodeView
                key={node.id}
                node={node}
                x={pos.x}
                y={pos.y}
                radius={nodeRadius(node.kind)}
                focused={focused || highlighted}
                showLabel={showLabel}
                mode={mode}
                tabIndex={focused ? 0 : index === 0 ? 0 : -1}
                onFocus={() => setFocusedId(node.id)}
                onClick={() => {
                  focusNodeById(node.id, false);
                  if (node.kind === "entity") setPanelNode(node);
                }}
              />
            );
          })}
        </motion.g>
      </svg>

      <div className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center">
        <AreaNavigator
          areasOrder={data.areasOrder}
          focusedId={focusedId?.startsWith("area:") ? focusedId : null}
          onSelectArea={(id) => focusNodeById(id)}
        />
      </div>

      {panelNode && (
        <EntityPanel
          projectId={projectId}
          node={panelNode}
          links={data.links}
          allNodes={data.nodes}
          mode={mode}
          open
          onClose={() => setPanelNode(null)}
          onRelationAdded={() => void load()}
        />
      )}
    </div>
  );
}
