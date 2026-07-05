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
import {
  ENTITY_TYPE_META,
  type EntityTypeKey,
} from "@/lib/strategy-hub/entities/entity-types";
import {
  mapFocusNodeId,
  onMapFocus,
  type MapFocusDetail,
} from "@/lib/strategy-hub/map-focus-bus";
import { useCamera } from "./use-camera";
import { ConstellationNodeView } from "./constellation-node";
import { EntityPanel } from "./entity-panel";
import { CorePanel } from "./core-panel";
import { computeSceneLayout, allSceneNodes } from "./scene-layout";
import { KONST, generateStars } from "./constellation-theme";

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

/** Punkt oddalony o `trim` od (x2,y2) w stronę (x1,y1) — strzałka nie ginie pod węzłem. */
function trimEnd(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  trim: number
): { x: number; y: number } {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const t = Math.max(0, 1 - trim / len);
  return { x: x1 + dx * t, y: y1 + dy * t };
}

/** Łuk krawędzi skrzydła — delikatnie ugięty ku osi poziomej centrum. */
function wingLinkPath(x1: number, y1: number, x2: number, y2: number): string {
  const cx = (x1 + x2) / 2;
  const cy = ((y1 + y2) / 2) * 0.55;
  return `M ${x1} ${y1} Q ${cx} ${cy}, ${x2} ${y2}`;
}

/** Punkt na krzywej kwadratowej w parametrze t (etykieta relacji). */
function quadPoint(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  t: number
): { x: number; y: number } {
  const cx = (x1 + x2) / 2;
  const cy = ((y1 + y2) / 2) * 0.55;
  const mt = 1 - t;
  return {
    x: mt * mt * x1 + 2 * mt * t * cx + t * t * x2,
    y: mt * mt * y1 + 2 * mt * t * cy + t * t * y2,
  };
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

/** Etykieta z prefiksem typu dla węzłów skrzydeł („Segment: MŚP B2B"). */
function sideLabel(node: ConstellationNode): string {
  if (node.kind === "area") return node.label;
  const meta = node.entityType ? ENTITY_TYPE_META[node.entityType] : null;
  return meta ? `${meta.label}: ${node.label}` : node.label;
}

/** Pierwsze słowo nazwy — watermark sceny elementu. */
function watermarkWord(label: string): string {
  const word = label.split(/\s+/)[0] ?? label;
  return word.length > 12 ? word.slice(0, 12) : word;
}

const DISPLAY_FONT =
  "var(--font-konst, Georgia, 'Times New Roman', serif)";

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

  const upIds = useMemo(
    () => new Set((data?.upstream ?? []).map((n) => n.id)),
    [data]
  );
  const downIds = useMemo(
    () => new Set((data?.downstream ?? []).map((n) => n.id)),
    [data]
  );

  /** Liczba krawędzi per węzeł — waga wpływa na promień encji. */
  const degreeById = useMemo(() => {
    const map = new Map<string, number>();
    for (const link of data?.links ?? []) {
      map.set(link.sourceId, (map.get(link.sourceId) ?? 0) + 1);
      map.set(link.targetId, (map.get(link.targetId) ?? 0) + 1);
    }
    return map;
  }, [data]);

  /** Obszar-przodek węzła (rozjaśnianie gałęzi fokusowanego obszaru na organizmie). */
  const areaOfNode = useCallback(
    (id: string): string | null => {
      if (id.startsWith("area:")) return id;
      const node = nodeById.get(id);
      if (!node?.parentId) return null;
      if (node.parentId.startsWith("area:")) return node.parentId;
      return null;
    },
    [nodeById]
  );

  const stars = useMemo(
    () => generateStars(projectId, 150, viewport.w, viewport.h),
    [projectId, viewport.w, viewport.h]
  );

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

  /** Cykl ‹ › — obszary (organizm/obszar) lub encje obszaru (element). */
  const cycle = useCallback(
    (delta: number) => {
      if (!data) return;

      if (data.scene.level === "area") {
        const idx = data.areasOrder.indexOf(data.scene.area);
        const nextIdx =
          (idx + delta + data.areasOrder.length) % data.areasOrder.length;
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
    },
    [data, focusedId, focusNodeById, navigateToScene]
  );

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
      cycle(e.key === "ArrowRight" ? 1 : -1);
    }
  };

  const scale = camera.getScale();
  const isOrganism = data?.scene.level === "organism";
  const isEntityScene = data?.scene.level === "entity";
  const showEntityLabels = isOrganism ? scale >= 0.9 : scale >= 0.7;
  const showCrossLinks = scale >= 0.65;

  /** Fokusowany obszar (organizm) — jego gałęzie świecą jaśniej. */
  const focusedArea = isOrganism
    ? focusedId?.startsWith("area:")
      ? focusedId
      : focusedId
        ? areaOfNode(focusedId)
        : null
    : null;

  // ── Treść dolnej etykiety (duży serif) ──────────────────────────────────
  let displayLabel = "";
  let displaySub = "";
  if (data) {
    if (isOrganism) {
      if (focusedArea) {
        const areaNode = nodeById.get(focusedArea);
        const count = data.members.filter(
          (m) => m.parentId === focusedArea
        ).length;
        displayLabel = areaNode?.label ?? "";
        displaySub = `${count} elementów · Enter — wejdź w obszar`;
      } else {
        displayLabel = data.center.label;
        displaySub = `zdrowie ${data.health}% · ${data.members.length} elementów`;
      }
    } else if (data.scene.level === "area") {
      displayLabel = data.center.label;
      displaySub = `${data.members.length} elementów · ${data.upstream.length} wpływające · ${data.downstream.length} wynikające`;
    } else {
      const meta = data.center.entityType
        ? ENTITY_TYPE_META[data.center.entityType]
        : null;
      displayLabel = data.center.label;
      displaySub = `${meta?.label ?? "Element"} · ${data.upstream.length} wpływające · ${data.downstream.length} wynikające`;
    }
  }

  const watermark =
    data?.scene.level === "area"
      ? data.center.label
      : isEntityScene && data
        ? watermarkWord(data.center.label)
        : null;

  const chromeShell = cn(
    "dark relative overflow-hidden",
    fullscreen
      ? "h-full min-h-0 flex-1"
      : "h-[min(72vh,640px)] min-h-[420px] rounded-2xl border border-[#3A342A]"
  );

  if (loading && !data) {
    return (
      <div
        className={cn(
          chromeShell,
          "flex items-center justify-center gap-2 text-sm"
        )}
        style={{ backgroundColor: KONST.bg, color: KONST.muted }}
      >
        <Loader2 className="size-4 animate-spin" /> Ładowanie konstelacji…
      </div>
    );
  }

  if (error || !data) {
    return (
      <div
        className={cn(chromeShell, "flex items-center justify-center text-sm")}
        style={{ backgroundColor: KONST.bg, color: KONST.muted }}
      >
        {error ?? "Brak danych"}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={chromeShell}
      style={{ backgroundColor: KONST.bg }}
    >
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {liveMessage}
      </div>

      {watermark && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 z-0 flex items-center justify-center overflow-hidden"
        >
          <span
            className="select-none uppercase"
            style={{
              fontFamily: DISPLAY_FONT,
              fontWeight: 300,
              fontSize: "clamp(72px, 14vw, 150px)",
              letterSpacing: "0.22em",
              color: KONST.watermark,
              whiteSpace: "nowrap",
            }}
          >
            {watermark}
          </span>
        </div>
      )}

      {data.breadcrumb.length > 0 && (
        <nav
          aria-label="Ścieżka nawigacji konstelacji"
          className="pointer-events-none absolute inset-x-0 top-0 z-10 flex justify-center px-4 py-3 text-xs"
        >
          <ol
            className="pointer-events-auto flex flex-wrap items-center gap-1 rounded-full border px-3.5 py-1.5 backdrop-blur"
            style={{
              backgroundColor: KONST.chromeBg,
              borderColor: KONST.chromeBorder,
            }}
          >
            {data.breadcrumb.map((crumb, i) => (
              <li key={`${crumb.label}-${i}`} className="flex items-center gap-1">
                {i > 0 && (
                  <ChevronRight
                    className="size-3"
                    style={{ color: KONST.muted }}
                    aria-hidden
                  />
                )}
                {i < data.breadcrumb.length - 1 ? (
                  <button
                    type="button"
                    onClick={() => navigateToScene(crumb.scene)}
                    className="rounded px-1 transition-colors hover:text-[#E9E1C6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#EFE7CE]/60"
                    style={{ color: KONST.muted }}
                  >
                    {crumb.label}
                  </button>
                ) : (
                  <span className="px-1 font-medium" style={{ color: KONST.label }}>
                    {crumb.label}
                  </span>
                )}
              </li>
            ))}
            <li aria-hidden style={{ color: KONST.muted }}>
              · {data.health}%
            </li>
          </ol>
        </nav>
      )}

      {(data.scene.level === "area" || isEntityScene) && (
        <>
          <div
            data-testid="scene-upstream"
            className="pointer-events-none absolute left-6 top-[16%] z-10"
          >
            <p
              className="text-[11px] uppercase"
              style={{ color: KONST.up, letterSpacing: "0.32em" }}
            >
              Wpływa
            </p>
          </div>
          <div
            data-testid="scene-downstream"
            className="pointer-events-none absolute right-6 top-[16%] z-10 text-right"
          >
            <p
              className="text-[11px] uppercase"
              style={{ color: KONST.down, letterSpacing: "0.32em" }}
            >
              Wynika
            </p>
          </div>
        </>
      )}

      {loading && (
        <div
          className="absolute inset-0 z-30 flex items-center justify-center"
          style={{ backgroundColor: "rgba(22,19,14,0.6)" }}
        >
          <Loader2 className="size-5 animate-spin" style={{ color: KONST.muted }} />
        </div>
      )}

      <svg
        width={viewport.w}
        height={viewport.h}
        tabIndex={0}
        role="img"
        aria-label="Widok konstelacji strategii"
        className="touch-none relative z-[1] size-full select-none outline-none focus-visible:ring-2 focus-visible:ring-[#EFE7CE]/40"
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
          <marker
            id="konst-arrow-up"
            viewBox="0 0 8 8"
            refX="7"
            refY="4"
            markerWidth="6"
            markerHeight="6"
            orient="auto"
          >
            <path d="M1 1 L7 4 L1 7" fill="none" stroke={KONST.up} strokeWidth="1.2" />
          </marker>
          <marker
            id="konst-arrow-down"
            viewBox="0 0 8 8"
            refX="7"
            refY="4"
            markerWidth="6"
            markerHeight="6"
            orient="auto"
          >
            <path d="M1 1 L7 4 L1 7" fill="none" stroke={KONST.down} strokeWidth="1.2" />
          </marker>
        </defs>

        <g aria-hidden>
          {stars.map((s, i) => (
            <circle
              key={i}
              cx={s.x}
              cy={s.y}
              r={s.r}
              fill={KONST.star}
              opacity={s.o}
            />
          ))}
        </g>

        <motion.g style={{ transform: svgTransform, transformOrigin: "0 0" }}>
          {isOrganism && (
            <g fill="none" stroke={KONST.node} aria-hidden>
              <circle r={220} strokeOpacity={0.05} />
              <circle r={330} strokeOpacity={0.035} />
              <circle r={440} strokeOpacity={0.025} />
            </g>
          )}

          {/* Syntetyczne krawędzie skrzydeł — gdy API nie zwraca linku dla węzła zależności. */}
          {[...upIds, ...downIds].map((sideId) => {
            const hasLink = data.links.some(
              (l) => l.sourceId === sideId || l.targetId === sideId
            );
            if (hasLink) return null;
            const from = layout.get(sideId);
            const to = layout.get(data.center.id);
            if (!from || !to) return null;
            const isUp = upIds.has(sideId);
            const end = isUp
              ? trimEnd(from.x, from.y, to.x, to.y, 24)
              : trimEnd(to.x, to.y, from.x, from.y, 17);
            return (
              <path
                key={`wing-${sideId}`}
                d={
                  isUp
                    ? wingLinkPath(from.x, from.y, end.x, end.y)
                    : wingLinkPath(to.x, to.y, end.x, end.y)
                }
                fill="none"
                stroke={isUp ? KONST.up : KONST.down}
                strokeWidth={1}
                strokeDasharray="2 4"
                strokeOpacity={0.42}
                markerEnd={
                  isUp ? "url(#konst-arrow-up)" : "url(#konst-arrow-down)"
                }
              />
            );
          })}

          {data.links.map((link) => {
            const from = layout.get(link.sourceId);
            const to = layout.get(link.targetId);
            if (!from || !to) return null;

            const pathHighlighted = highlightedLinkIds.has(link.id);
            const isUpWing = upIds.has(link.sourceId) || upIds.has(link.targetId);
            const isDownWing =
              !isUpWing && (downIds.has(link.sourceId) || downIds.has(link.targetId));

            // Krawędź do skrzydła zależności — tinta + strzałka + etykieta relacji.
            if (isUpWing || isDownWing) {
              const tint = isUpWing ? KONST.up : KONST.down;
              const marker = isUpWing
                ? "url(#konst-arrow-up)"
                : "url(#konst-arrow-down)";
              const labelPos =
                isEntityScene && link.relationLabel
                  ? quadPoint(from.x, from.y, to.x, to.y, 0.42)
                  : null;
              const wingEnd = trimEnd(from.x, from.y, to.x, to.y, 18);
              return (
                <g key={link.id}>
                  <path
                    d={wingLinkPath(from.x, from.y, wingEnd.x, wingEnd.y)}
                    fill="none"
                    stroke={pathHighlighted ? KONST.pathHighlight : tint}
                    strokeWidth={pathHighlighted ? 2 : 1}
                    strokeDasharray="2 4"
                    strokeOpacity={pathHighlighted ? 0.95 : 0.42}
                    markerEnd={marker}
                  />
                  {labelPos && (
                    <text
                      x={labelPos.x}
                      y={labelPos.y - 6}
                      textAnchor="middle"
                      fill={isUpWing ? KONST.upEdgeLabel : KONST.downEdgeLabel}
                      style={{
                        fontSize: 11,
                        fontStyle: "italic",
                        letterSpacing: "0.04em",
                      }}
                      className="pointer-events-none select-none"
                    >
                      {link.relationLabel}
                    </text>
                  )}
                </g>
              );
            }

            if (link.kind === "tree") {
              const bright =
                focusedArea != null &&
                (areaOfNode(link.sourceId) === focusedArea ||
                  areaOfNode(link.targetId) === focusedArea);
              return (
                <line
                  key={link.id}
                  x1={from.x}
                  y1={from.y}
                  x2={to.x}
                  y2={to.y}
                  stroke={bright ? KONST.edgeBright : KONST.edge}
                  strokeWidth={1}
                />
              );
            }

            const show =
              showCrossLinks ||
              focusedId === link.sourceId ||
              focusedId === link.targetId ||
              pathHighlighted;
            if (!show) return null;

            return (
              <path
                key={link.id}
                d={crossLinkPath(from.x, from.y, to.x, to.y)}
                fill="none"
                stroke={
                  pathHighlighted
                    ? KONST.pathHighlight
                    : link.aiGenerated
                      ? KONST.crossAi
                      : KONST.cross
                }
                strokeWidth={pathHighlighted ? 2.2 : 1}
                strokeDasharray="2 4"
                strokeOpacity={pathHighlighted ? 0.95 : 1}
              />
            );
          })}

          {allNodesFlat.map((node, index) => {
            const pos = layout.get(node.id);
            if (!pos) return null;
            const focused = focusedId === node.id;
            const highlighted = highlightedId === node.id;
            const isUp = upIds.has(node.id);
            const isDown = downIds.has(node.id);
            const isSide = isUp || isDown;
            const isCenter = node.id === data.center.id;

            const showLabel =
              !(isCenter && isEntityScene) &&
              (node.kind === "area" ||
                focused ||
                isSide ||
                (node.kind === "entity" && showEntityLabels && !isSide));

            const degree = degreeById.get(node.id) ?? 0;
            let radius: number;
            if (node.kind === "core") {
              radius = 30;
            } else if (node.kind === "area") {
              radius = 16;
            } else if (isCenter && isEntityScene) {
              radius = 15;
            } else if (isSide) {
              radius = 11;
            } else {
              const base = isOrganism ? 3.2 : 5;
              radius = base + Math.min(2.5, degree * 0.35);
            }

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
                sideTint={isUp ? "up" : isDown ? "down" : null}
                isSceneCenter={isCenter && isEntityScene}
                labelText={isSide ? sideLabel(node) : undefined}
                coreSeed={projectId}
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

      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-[2]"
        style={{ background: KONST.bgVignette }}
      />

      <div className="pointer-events-none absolute inset-x-0 bottom-5 z-10 flex items-end justify-center gap-6 px-6">
        <button
          type="button"
          onClick={() => cycle(-1)}
          aria-label="Poprzedni"
          className="pointer-events-auto mb-2 inline-flex size-9 items-center justify-center rounded-full text-xl transition-colors hover:text-[#E9E1C6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#EFE7CE]/60"
          style={{ color: KONST.label }}
        >
          ‹
        </button>
        <div className="max-w-[70%] text-center">
          <p
            className="select-none uppercase leading-tight"
            style={{
              fontFamily: DISPLAY_FONT,
              fontWeight: 300,
              fontSize: isEntityScene
                ? "clamp(18px, 2.6vw, 26px)"
                : "clamp(22px, 3.6vw, 38px)",
              letterSpacing: "0.3em",
              color: KONST.display,
              textIndent: "0.3em",
            }}
          >
            {displayLabel}
          </p>
          {displaySub && (
            <p
              className="mt-1.5 select-none text-[11px]"
              style={{ color: KONST.muted, letterSpacing: "0.18em" }}
            >
              {displaySub}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => cycle(1)}
          aria-label="Następny"
          className="pointer-events-auto mb-2 inline-flex size-9 items-center justify-center rounded-full text-xl transition-colors hover:text-[#E9E1C6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#EFE7CE]/60"
          style={{ color: KONST.label }}
        >
          ›
        </button>
      </div>

      {focusedId &&
        nodeById.get(focusedId)?.kind === "entity" &&
        !panelNode && (
          <div className="pointer-events-none absolute bottom-5 right-5 z-10">
            <button
              type="button"
              onClick={() => {
                const node = nodeById.get(focusedId);
                if (node) setPanelNode(node);
              }}
              className="pointer-events-auto inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium backdrop-blur transition-colors hover:text-[#E9E1C6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#EFE7CE]/60"
              style={{
                backgroundColor: KONST.chromeBg,
                borderColor: KONST.chromeBorder,
                color: KONST.label,
              }}
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
