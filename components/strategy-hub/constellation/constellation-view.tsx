"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, useMotionTemplate } from "motion/react";
import { ChevronRight, Info, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  ConstellationNode,
  ConstellationScene,
  SceneData,
} from "@/lib/strategy-hub/constellation-types";
import {
  CORE_NODE_ID,
  areaNodeId,
  parseEntityNodeId,
} from "@/lib/strategy-hub/constellation-types";
import type { EntityTypeKey } from "@/lib/strategy-hub/entities/entity-types";
import {
  mapFocusNodeId,
  onMapFocus,
  type MapFocusDetail,
} from "@/lib/strategy-hub/map-focus-bus";
import { useCamera } from "./use-camera";
import { ConstellationNodeView, nodeRadius } from "./constellation-node";
import { EntityPanel } from "./entity-panel";
import { CorePanel } from "./core-panel";
import { computeSceneLayout, allSceneNodes } from "./scene-layout";

interface ConstellationViewProps {
  projectId: string;
  mode: "editor" | "client";
  basePath?: string;
  initialScene?: SceneData;
  fullscreen?: boolean;
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

function sceneToQuery(scene: ConstellationScene): string {
  const params = new URLSearchParams();
  if (scene.level === "organism") {
    params.set("level", "organism");
  } else if (scene.level === "area") {
    params.set("level", "area");
    params.set("area", scene.area);
  } else {
    params.set("level", "entity");
    params.set("type", scene.ref.type);
    params.set("id", scene.ref.id);
  }
  return params.toString();
}

function sceneQueryFromSearchParams(sp: URLSearchParams): string {
  const focus = sp.get("focus");
  if (focus) return `focus=${encodeURIComponent(focus)}`;

  const parts: string[] = [];
  const level = sp.get("level");
  if (level) parts.push(`level=${level}`);
  const area = sp.get("area");
  if (area) parts.push(`area=${area}`);
  const type = sp.get("type") ?? sp.get("entityType");
  const id = sp.get("id") ?? sp.get("entityId");
  if (type) parts.push(`type=${type}`);
  if (id) parts.push(`id=${id}`);
  return parts.join("&");
}

function buildSceneApiUrl(
  projectId: string,
  mode: "editor" | "client",
  query: string
): string {
  const q = query ? `${query}&mode=${mode}` : `mode=${mode}`;
  return `/api/strategy-hub/projects/${projectId}/constellation?${q}`;
}

function sceneLiveMessage(data: SceneData): string {
  if (data.scene.level === "organism") {
    return `Organizm strategii, ${data.members.length} elementów`;
  }
  if (data.scene.level === "area") {
    return `Obszar ${data.center.label}, ${data.members.length} elementów, ${data.upstream.length} wpływających, ${data.downstream.length} wynikających`;
  }
  return `Element ${data.center.label}, ${data.upstream.length} wpływających, ${data.downstream.length} wynikających`;
}

export function ConstellationView({
  projectId,
  mode,
  basePath,
  initialScene,
  fullscreen = false,
}: ConstellationViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const containerRef = useRef<HTMLDivElement>(null);

  const pageBase =
    basePath ?? `/strategy-hub/projects/${projectId}/constellation`;

  const [data, setData] = useState<SceneData | null>(initialScene ?? null);
  const [loading, setLoading] = useState(!initialScene);
  const [error, setError] = useState<string | null>(null);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const [highlightedLinkIds, setHighlightedLinkIds] = useState<Set<string>>(
    () => new Set()
  );
  const [panelNode, setPanelNode] = useState<ConstellationNode | null>(null);
  const [corePanelOpen, setCorePanelOpen] = useState(false);
  const [liveMessage, setLiveMessage] = useState("");
  const [viewport, setViewport] = useState({ w: 960, h: 560 });
  const areaMembersRef = useRef<ConstellationNode[]>([]);

  const camera = useCamera();
  const svgTransform = useMotionTemplate`${camera.transform}`;

  const sceneQuery = sceneQueryFromSearchParams(searchParams);
  const apiUrl = buildSceneApiUrl(projectId, mode, sceneQuery);

  const fetchScene = useCallback(
    (url: string) =>
      fetch(url, { signal: AbortSignal.timeout(15_000) })
        .then((res) => {
          if (!res.ok) throw new Error("Nie udało się załadować sceny");
          return res.json() as Promise<SceneData>;
        }),
    []
  );

  const [prevApiUrl, setPrevApiUrl] = useState(apiUrl);
  if (apiUrl !== prevApiUrl) {
    setPrevApiUrl(apiUrl);
    setLoading(true);
    setError(null);
  }

  useEffect(() => {
    let cancelled = false;
    void fetchScene(apiUrl)
      .then((json) => {
        if (cancelled) return;
        setData(json);
        setLiveMessage(sceneLiveMessage(json));
        setPanelNode(null);
        setCorePanelOpen(false);
        if (json.scene.level === "entity") {
          const areaCrumb = json.breadcrumb.find((b) => b.scene.level === "area");
          if (areaCrumb?.scene.level === "area") {
            const areaQ = sceneToQuery(areaCrumb.scene);
            void fetchScene(buildSceneApiUrl(projectId, mode, areaQ)).then(
              (areaData) => {
                if (!cancelled) areaMembersRef.current = areaData.members;
              }
            );
          }
        } else if (json.scene.level === "area") {
          areaMembersRef.current = json.members;
        }
      })
      .catch(() => {
        if (!cancelled) setError("Błąd połączenia z serwerem");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [apiUrl, fetchScene, mode, projectId]);

  const navigateToScene = useCallback(
    (scene: ConstellationScene) => {
      const q = sceneToQuery(scene);
      const href = q ? `${pageBase}?${q}` : pageBase;
      router.push(href);
    },
    [pageBase, router]
  );

  const navigateToEntity = useCallback(
    (entityType: string, entityId: string) => {
      navigateToScene({
        level: "entity",
        ref: { type: entityType as EntityTypeKey, id: entityId },
      });
    },
    [navigateToScene]
  );

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
    if (!data) return;
    camera.resetView(viewport.w, viewport.h);
  }, [data?.scene, viewport.w, viewport.h, camera, data]);

  const layout = useMemo(() => {
    if (!data) return new Map<string, { x: number; y: number; angle: number }>();
    return computeSceneLayout(data);
  }, [data]);

  const nodeById = useMemo(() => {
    const map = new Map<string, ConstellationNode>();
    if (!data) return map;
    for (const n of allSceneNodes(data)) map.set(n.id, n);
    return map;
  }, [data]);

  const allNodesFlat = useMemo((): ConstellationNode[] => {
    if (!data) return [];
    return allSceneNodes(data);
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
          node?.kind === "entity"
            ? data?.scene.level === "entity"
              ? 1.15
              : 1.25
            : node?.kind === "area"
              ? 1.05
              : 0.85;
        camera.focusNode(pos, viewport.w, viewport.h, targetScale);
      }
    },
    [layout, nodeById, announceFocus, camera, viewport, data?.scene.level]
  );

  const focusParam = searchParams.get("focus");
  const [prevFocusParam, setPrevFocusParam] = useState(focusParam);
  if (
    focusParam &&
    focusParam !== prevFocusParam &&
    layout.has(focusParam)
  ) {
    setPrevFocusParam(focusParam);
    setFocusedId(focusParam);
    const node = nodeById.get(focusParam);
    if (node) setLiveMessage(`Fokus: ${node.label}`);
  }

  useEffect(() => {
    if (!focusParam || !layout.has(focusParam)) return;
    const pos = layout.get(focusParam);
    if (!pos) return;
    const node = nodeById.get(focusParam);
    const targetScale =
      node?.kind === "entity"
        ? data?.scene.level === "entity"
          ? 1.15
          : 1.25
        : node?.kind === "area"
          ? 1.05
          : 0.85;
    camera.focusNode(pos, viewport.w, viewport.h, targetScale);
  }, [focusParam, layout, nodeById, camera, viewport, data?.scene.level]);

  useEffect(() => {
    const handleMapFocus = (detail: MapFocusDetail) => {
      if (detail.mode === "focus" || detail.mode === "path") {
        setHighlightedLinkIds(new Set());
        setHighlightedId(null);
        navigateToEntity(detail.entityType, detail.entityId);
        if (detail.mode === "path") {
          setHighlightedLinkIds(new Set(detail.pathIds ?? []));
        }
        return;
      }

      const nodeId = mapFocusNodeId(detail.entityType, detail.entityId);
      if (detail.mode === "highlight") {
        if (layout.has(nodeId)) {
          setHighlightedId(nodeId);
          setFocusedId(nodeId);
          announceFocus(nodeId);
        } else {
          navigateToEntity(detail.entityType, detail.entityId);
        }
      }
    };

    return onMapFocus(handleMapFocus);
  }, [layout, announceFocus, navigateToEntity]);

  const handleNodeActivate = useCallback(
    (node: ConstellationNode) => {
      if (!data) return;

      if (node.kind === "core" && data.scene.level === "organism") {
        setCorePanelOpen(true);
        setPanelNode(null);
        focusNodeById(node.id, false);
        return;
      }

      if (node.kind === "area") {
        const area = data.areasOrder.find((a) => areaNodeId(a) === node.id);
        if (area) navigateToScene({ level: "area", area });
        return;
      }

      if (node.kind === "entity") {
        const parsed = parseEntityNodeId(node.id);
        if (parsed) navigateToScene({ level: "entity", ref: parsed });
      }
    },
    [data, focusNodeById, navigateToScene]
  );

  const goUpScene = useCallback(() => {
    if (!data) return;
    if (data.scene.level === "entity") {
      const areaCrumb = data.breadcrumb.find((b) => b.scene.level === "area");
      if (areaCrumb?.scene.level === "area") {
        navigateToScene(areaCrumb.scene);
        return;
      }
    }
    if (data.scene.level === "area" || data.scene.level === "entity") {
      navigateToScene({ level: "organism" });
    }
  }, [data, navigateToScene]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!data) return;

    if (e.key === "Escape") {
      if (panelNode) {
        setPanelNode(null);
        return;
      }
      if (corePanelOpen) {
        setCorePanelOpen(false);
        return;
      }
      if (data.scene.level !== "organism") {
        goUpScene();
        return;
      }
      setFocusedId(null);
      camera.resetView(viewport.w, viewport.h);
      return;
    }

    if (e.key === "Enter" && focusedId) {
      const node = nodeById.get(focusedId);
      if (node?.kind === "entity") setPanelNode(node);
      if (node?.kind === "core") setCorePanelOpen(true);
      return;
    }

    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault();
      const delta = e.key === "ArrowRight" ? 1 : -1;

      if (data.scene.level === "area") {
        const idx = data.areasOrder.indexOf(data.scene.area);
        const nextIdx = (idx + delta + data.areasOrder.length) % data.areasOrder.length;
        const nextArea = data.areasOrder[nextIdx];
        if (nextArea) navigateToScene({ level: "area", area: nextArea });
        return;
      }

      if (data.scene.level === "entity") {
        const members = areaMembersRef.current;
        if (members.length === 0) return;
        const curIdx = focusedId
          ? members.findIndex((n) => n.id === focusedId)
          : members.findIndex((n) => n.id === data.center.id);
        const baseIdx = curIdx < 0 ? 0 : curIdx;
        const nextIdx = (baseIdx + delta + members.length) % members.length;
        const next = members[nextIdx];
        if (next) {
          const parsed = parseEntityNodeId(next.id);
          if (parsed) navigateToScene({ level: "entity", ref: parsed });
        }
        return;
      }

      const areaIds = data.areasOrder.map((a) => areaNodeId(a));
      const idx = focusedId?.startsWith("area:")
        ? areaIds.indexOf(focusedId)
        : -1;
      const nextIdx =
        idx < 0 ? 0 : (idx + delta + areaIds.length) % areaIds.length;
      focusNodeById(areaIds[nextIdx] ?? CORE_NODE_ID);
    }
  };

  const scale = camera.getScale();
  const showEntityLabels =
    data?.scene.level === "organism" ? scale >= 0.9 : scale >= 0.75;
  const showCrossLinks = scale >= 0.65;

  const sideColumnHeader = data?.center.label ?? "";

  if (loading && !data) {
    return (
      <div
        className={cn(
          "flex items-center justify-center gap-2 text-sm text-muted-foreground",
          fullscreen
            ? "h-full min-h-[420px] bg-[oklch(0.13_0.02_260)]"
            : "h-[520px] rounded-2xl border border-border bg-[oklch(0.13_0.02_260)]"
        )}
      >
        <Loader2 className="size-4 animate-spin" /> Ładowanie konstelacji…
      </div>
    );
  }

  if (error || !data) {
    return (
      <div
        className={cn(
          "flex items-center justify-center text-sm text-muted-foreground",
          fullscreen
            ? "h-full min-h-[420px] bg-[oklch(0.13_0.02_260)]"
            : "h-[520px] rounded-2xl border border-border bg-[oklch(0.13_0.02_260)]"
        )}
      >
        {error ?? "Brak danych"}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative overflow-hidden bg-[oklch(0.13_0.02_260)]",
        fullscreen
          ? "h-full min-h-0 flex-1"
          : "h-[min(72vh,640px)] min-h-[420px] rounded-2xl border border-border"
      )}
    >
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {liveMessage}
      </div>

      {data.breadcrumb.length > 0 && (
        <nav
          aria-label="Ścieżka nawigacji konstelacji"
          className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-center gap-1 px-4 py-3 text-xs"
        >
          <ol className="pointer-events-auto flex flex-wrap items-center gap-1 rounded-full border border-border/60 bg-card/90 px-3 py-1.5 shadow-sm backdrop-blur">
            {data.breadcrumb.map((crumb, i) => (
              <li key={`${crumb.label}-${i}`} className="flex items-center gap-1">
                {i > 0 && (
                  <ChevronRight
                    className="size-3 text-muted-foreground"
                    aria-hidden
                  />
                )}
                {i < data.breadcrumb.length - 1 ? (
                  <button
                    type="button"
                    onClick={() => navigateToScene(crumb.scene)}
                    className="text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50 rounded px-1"
                  >
                    {crumb.label}
                  </button>
                ) : (
                  <span className="font-medium text-foreground">{crumb.label}</span>
                )}
              </li>
            ))}
          </ol>
        </nav>
      )}

      {(data.scene.level === "area" || data.scene.level === "entity") && (
        <>
          <div
            data-testid="scene-upstream"
            className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 max-w-[140px]"
          >
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Wpływa na: {sideColumnHeader}
            </p>
          </div>
          <div
            data-testid="scene-downstream"
            className="pointer-events-none absolute right-3 top-1/2 z-10 -translate-y-1/2 max-w-[140px] text-right"
          >
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Wynika z tego
            </p>
          </div>
        </>
      )}

      {loading && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-[oklch(0.13_0.02_260)]/60">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      )}

      <svg
        width={viewport.w}
        height={viewport.h}
        tabIndex={0}
        role="img"
        aria-label="Widok konstelacji strategii"
        className="touch-none size-full select-none outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
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
          {data.links.map((link) => {
            const from = layout.get(link.sourceId);
            const to = layout.get(link.targetId);
            if (!from || !to) return null;

            if (link.kind === "tree") {
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
            }

            const show =
              showCrossLinks ||
              focusedId === link.sourceId ||
              focusedId === link.targetId ||
              highlightedLinkIds.has(link.id);
            if (!show) return null;

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

          {allNodesFlat.map((node, index) => {
            const pos = layout.get(node.id);
            if (!pos) return null;
            const focused = focusedId === node.id;
            const highlighted = highlightedId === node.id;
            const isSide =
              data.upstream.some((n) => n.id === node.id) ||
              data.downstream.some((n) => n.id === node.id);
            const isCenter = node.id === data.center.id;
            const showLabel =
              node.kind === "area" ||
              focused ||
              isCenter ||
              (node.kind === "entity" && showEntityLabels && !isSide) ||
              (isSide && focused);
            const radius =
              isCenter && data.scene.level === "entity"
                ? nodeRadius("area")
                : isSide
                  ? nodeRadius("entity") * 0.85
                  : nodeRadius(node.kind);

            return (
              <ConstellationNodeView
                key={node.id}
                node={node}
                x={pos.x}
                y={pos.y}
                radius={radius}
                focused={focused || highlighted}
                showLabel={showLabel}
                mode={mode}
                tabIndex={focused ? 0 : index === 0 ? 0 : -1}
                onFocus={() => setFocusedId(node.id)}
                onClick={() => {
                  focusNodeById(node.id, false);
                  handleNodeActivate(node);
                }}
              />
            );
          })}
        </motion.g>
      </svg>

      {focusedId &&
        nodeById.get(focusedId)?.kind === "entity" &&
        !panelNode && (
          <div className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center">
            <button
              type="button"
              onClick={() => {
                const node = nodeById.get(focusedId);
                if (node) setPanelNode(node);
              }}
              className="pointer-events-auto inline-flex items-center gap-1.5 rounded-full border border-border/80 bg-card/90 px-3 py-1.5 text-xs font-medium text-foreground shadow-lg backdrop-blur hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50"
            >
              <Info className="size-3.5" />
              Szczegóły
            </button>
          </div>
        )}

      {panelNode && (
        <EntityPanel
          projectId={projectId}
          node={panelNode}
          links={data.links}
          allNodes={allNodesFlat}
          mode={mode}
          open
          onClose={() => setPanelNode(null)}
          onRelationAdded={() => {
            void fetchScene(apiUrl).then(setData);
          }}
        />
      )}

      {corePanelOpen && data.singletons && (
        <CorePanel
          projectLabel={data.center.label}
          health={data.health}
          singletons={data.singletons}
          open
          onClose={() => setCorePanelOpen(false)}
        />
      )}
    </div>
  );
}
