"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  motion,
  useReducedMotion,
  type Transition,
} from "motion/react";
import { KONST } from "@/components/strategy-hub/constellation/constellation-theme";
import { SegmentSelector } from "@/components/strategy-hub/segment-selector";
import { DecisionOverlay } from "@/components/strategy-hub/strategy-map/decision-overlay";
import {
  DRAW_EDGE,
  SPRING_POP,
  STAGGER_THREAD,
} from "@/components/strategy-hub/konst-animation";
import type {
  ThreadData,
  ThreadDecision,
  ThreadEdge,
  ThreadNode,
} from "@/lib/strategy-hub/thread-types";
import {
  parseThreadParam,
  threadParamFromRef,
} from "@/lib/strategy-hub/thread-types";

const DISPLAY_FONT =
  "var(--font-konst, Georgia, 'Times New Roman', serif)";

export interface ThreadViewProps {
  projectId: string;
  mode: "editor" | "client";
  pageBase: string;
  threadParam: string;
  viewport: { w: number; h: number };
  onClose: () => void;
}

function truncateLabel(label: string, max: number, nodeCount: number): string {
  const limit = nodeCount > 6 ? 18 : max;
  if (label.length <= limit) return label;
  return `${label.slice(0, limit)}…`;
}

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat("pl-PL", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function quadPath(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  lift: number
): string {
  const cx = (x1 + x2) / 2;
  const cy = Math.min(y1, y2) - lift;
  return `M ${x1} ${y1} Q ${cx} ${cy}, ${x2} ${y2}`;
}

function quadMid(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  lift: number,
  t = 0.5
): { x: number; y: number } {
  const cx = (x1 + x2) / 2;
  const cy = Math.min(y1, y2) - lift;
  const mt = 1 - t;
  return {
    x: mt * mt * x1 + 2 * mt * t * cx + t * t * x2,
    y: mt * mt * y1 + 2 * mt * t * cy + t * t * y2,
  };
}

interface DecisionMarkerProps {
  edge: ThreadEdge;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  axisY: number;
  index: number;
  reducedMotion: boolean;
  totalNodes: number;
  onOpenDecision: (d: ThreadDecision) => void;
}

function DecisionMarkers({
  edge,
  x1,
  x2,
  axisY,
  index,
  reducedMotion,
  totalNodes,
  onOpenDecision,
}: DecisionMarkerProps) {
  const midX = (x1 + x2) / 2;
  const baseY = axisY + 36 + index * 56;

  if (edge.rationaleMd && edge.decisions.length === 0) {
    return (
      <g aria-label="Uzasadnienie relacji">
        <line
          x1={midX}
          y1={axisY + 14}
          x2={midX}
          y2={baseY - 8}
          stroke={KONST.spark}
          strokeOpacity={0.35}
          strokeWidth={1}
          strokeDasharray="1 4"
        />
        <circle
          cx={midX}
          cy={baseY}
          r={5}
          fill={KONST.spark}
          fillOpacity={0.6}
        />
        <foreignObject x={midX + 12} y={baseY - 14} width={200} height={48}>
          <p
            className="line-clamp-2 text-[11px]"
            style={{ color: KONST.muted }}
          >
            {edge.rationaleMd}
          </p>
        </foreignObject>
      </g>
    );
  }

  return (
    <>
      {edge.decisions.map((dec, di) => {
        const y = baseY + di * 56;
        return (
          <g key={dec.id} aria-label={`Decyzja: ${dec.title}`}>
            <line
              x1={midX}
              y1={axisY + 14}
              x2={midX}
              y2={y - 12}
              stroke={KONST.spark}
              strokeOpacity={0.35}
              strokeWidth={1}
              strokeDasharray="1 4"
            />
            <motion.g
              initial={reducedMotion ? false : { opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={
                reducedMotion
                  ? { duration: 0 }
                  : {
                      delay:
                        STAGGER_THREAD * totalNodes +
                        DRAW_EDGE.duration +
                        0.05,
                      duration: 0.25,
                    }
              }
            >
              <rect
                x={midX - 9}
                y={y - 9}
                width={18}
                height={18}
                rx={1}
                fill="#211D15"
                stroke={KONST.spark}
                strokeWidth={1.1}
                transform={`rotate(45 ${midX} ${y})`}
                className="cursor-pointer"
                onClick={() => onOpenDecision(dec)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") onOpenDecision(dec);
                }}
                tabIndex={0}
                role="button"
              />
              <text
                x={midX}
                y={y + 4}
                textAnchor="middle"
                fill={KONST.spark}
                fontSize={10}
                pointerEvents="none"
              >
                D
              </text>
              <foreignObject x={midX + 14} y={y - 16} width={220} height={56}>
                <div className="pointer-events-none">
                  <p
                    className="truncate text-[11px] font-medium"
                    style={{ color: KONST.downText }}
                  >
                    {dec.title}
                  </p>
                  <p className="text-[11px]" style={{ color: KONST.muted }}>
                    {formatDate(dec.createdAt)}
                  </p>
                  {dec.reasonMd && (
                    <p
                      className="line-clamp-2 text-[11px]"
                      style={{ color: KONST.muted }}
                    >
                      {dec.reasonMd}
                    </p>
                  )}
                </div>
              </foreignObject>
            </motion.g>
          </g>
        );
      })}
    </>
  );
}

export function ThreadView({
  projectId,
  mode,
  pageBase,
  threadParam,
  viewport,
  onClose,
}: ThreadViewProps) {
  const router = useRouter();
  const reducedMotion = useReducedMotion();
  const [data, setData] = useState<ThreadData | null>(null);
  const [focusedNodeIdx, setFocusedNodeIdx] = useState(0);
  const [decisionOpen, setDecisionOpen] = useState<ThreadDecision | null>(null);
  const [hoverNode, setHoverNode] = useState<number | null>(null);

  const ref = useMemo(() => parseThreadParam(threadParam), [threadParam]);

  const [fetchKey, setFetchKey] = useState(threadParam);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  if (threadParam !== fetchKey) {
    setFetchKey(threadParam);
    setLoading(true);
    setError(null);
  }

  useEffect(() => {
    if (!ref) return;
    let cancelled = false;
    const q = new URLSearchParams({
      type: ref.type,
      id: ref.id,
      mode,
    });
    void fetch(
      `/api/strategy-hub/projects/${projectId}/constellation/thread?${q}`,
      { signal: AbortSignal.timeout(15_000) }
    )
      .then((res) => {
        if (!res.ok) throw new Error("Nie udało się załadować nitki");
        return res.json() as Promise<ThreadData>;
      })
      .then((json) => {
        if (cancelled) return;
        setData(json);
        const fi = json.nodes.findIndex((n) => n.isFocus);
        setFocusedNodeIdx(fi >= 0 ? fi : 0);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Błąd nitki");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, ref, mode]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const focusNode = data?.nodes.find((n) => n.isFocus);
  const decisionCount = data?.edges.reduce((s, e) => s + e.decisions.length, 0) ?? 0;

  const paddingX = 64;
  const axisY = viewport.h * 0.42;
  const nodeCount = data?.nodes.length ?? 0;
  const span = Math.max(viewport.w - paddingX * 2, 320);
  const step = nodeCount > 1 ? span / (nodeCount - 1) : 0;

  const nodePositions = useMemo(() => {
    if (!data) return [];
    return data.nodes.map((_, i) => ({
      x: paddingX + (nodeCount > 1 ? step * i : span / 2),
      y: axisY,
    }));
  }, [data, nodeCount, paddingX, span, step, axisY]);

  const navigateToNode = useCallback(
    (node: ThreadNode) => {
      const href = `${pageBase}?level=entity&type=${node.ref.type}&id=${node.ref.id}`;
      router.push(href);
    },
    [pageBase, router]
  );

  const onSegmentSelect = useCallback(
    (segmentId: string) => {
      const param = threadParamFromRef({ type: "segment", id: segmentId });
      const sp = new URLSearchParams(window.location.search);
      sp.set("thread", param);
      router.replace(`${pageBase}?${sp.toString()}`);
    },
    [pageBase, router]
  );

  const popTransition = (delay: number): Transition =>
    reducedMotion
      ? { duration: 0 }
      : { ...SPRING_POP, delay };

  const drawTransition = (delay: number): Transition =>
    reducedMotion
      ? { duration: 0 }
      : { ...DRAW_EDGE, delay };

  if (loading) {
    return (
      <div
        className="absolute inset-0 z-20 flex items-center justify-center text-sm"
        style={{ color: KONST.muted }}
      >
        Ładowanie nitki…
      </div>
    );
  }

  if (error || !data || !focusNode) {
    return (
      <div
        className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 text-sm"
        style={{ color: KONST.muted }}
      >
        <p>{error ?? "Brak danych nitki"}</p>
        <button
          type="button"
          className="rounded-full border px-3 py-1 text-xs"
          style={{ borderColor: KONST.chromeBorder, color: KONST.label }}
          onClick={onClose}
        >
          Zamknij
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="pointer-events-none absolute inset-x-0 top-3 z-30 flex items-center justify-between px-4">
        <div className="pointer-events-auto flex items-center gap-2">
          <span
            className="inline-flex items-center rounded-full border px-3 py-1 text-[11px] tracking-[0.08em]"
            style={{
              backgroundColor: KONST.chromeBg,
              borderColor: KONST.chromeBorder,
              color: KONST.label,
            }}
          >
            Nitka · {focusNode.label}
          </span>
          {data.segments.length > 1 && (
            <SegmentSelector
              segments={data.segments}
              selectedId={data.segmentId}
              onSelect={onSegmentSelect}
            />
          )}
        </div>
        <button
          type="button"
          aria-label="Zamknij nitkę"
          className="pointer-events-auto inline-flex size-9 items-center justify-center rounded-full text-lg transition-colors hover:text-[#E9E1C6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#EFE7CE]/60"
          style={{ color: KONST.muted }}
          onClick={onClose}
        >
          ✕
        </button>
      </div>

      <svg
        role="img"
        aria-label="Widok nitki strategii"
        className="absolute inset-0 z-10 size-full"
        viewBox={`0 0 ${viewport.w} ${viewport.h}`}
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <marker
            id="konst-arrow-thread"
            viewBox="0 0 6 6"
            refX="5"
            refY="3"
            markerWidth="6"
            markerHeight="6"
            orient="auto"
          >
            <path d="M0,0 L6,3 L0,6 Z" fill={KONST.down} fillOpacity={0.45} />
          </marker>
        </defs>

        {data.edges.map((edge, ei) => {
          const from = nodePositions[edge.from];
          const to = nodePositions[edge.to];
          if (!from || !to) return null;
          const path = quadPath(from.x, from.y, to.x, to.y, 24);
          const labelPt = quadMid(from.x, from.y, to.x, to.y, 24, 0.5);
          return (
            <g key={`edge-${ei}`}>
              <motion.path
                d={path}
                fill="none"
                stroke={KONST.down}
                strokeOpacity={0.45}
                strokeWidth={1}
                strokeDasharray="2 4"
                markerEnd="url(#konst-arrow-thread)"
                initial={
                  reducedMotion ? { pathLength: 1 } : { pathLength: 0 }
                }
                animate={{ pathLength: 1 }}
                transition={drawTransition(STAGGER_THREAD * (edge.from + 1))}
              />
              <motion.text
                x={labelPt.x}
                y={labelPt.y - 8}
                textAnchor="middle"
                fill="#C6A876"
                fontSize={11}
                fontStyle="italic"
                initial={reducedMotion ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={
                  reducedMotion
                    ? { duration: 0 }
                    : {
                        delay:
                          STAGGER_THREAD * (edge.from + 1) + DRAW_EDGE.duration,
                        duration: 0.2,
                      }
                }
              >
                {edge.relationLabel}
              </motion.text>
              <DecisionMarkers
                edge={edge}
                x1={from.x}
                y1={from.y}
                x2={to.x}
                y2={to.y}
                axisY={axisY}
                index={ei}
                reducedMotion={!!reducedMotion}
                totalNodes={nodeCount}
                onOpenDecision={setDecisionOpen}
              />
            </g>
          );
        })}

        {data.nodes.map((node, ni) => {
          const pos = nodePositions[ni];
          if (!pos) return null;
          const r = node.isFocus ? 14 : 11;
          const hovered = hoverNode === ni || focusedNodeIdx === ni;
          return (
            <g
              key={`${node.ref.type}:${node.ref.id}`}
              transform={`translate(${pos.x}, ${pos.y})`}
              className="cursor-pointer"
              tabIndex={focusedNodeIdx === ni ? 0 : -1}
              role="button"
              aria-label={`${node.typeLabel}: ${node.label}`}
              onMouseEnter={() => setHoverNode(ni)}
              onMouseLeave={() => setHoverNode(null)}
              onFocus={() => setFocusedNodeIdx(ni)}
              onClick={() => navigateToNode(node)}
              onKeyDown={(e) => {
                if (e.key === "ArrowLeft" && ni > 0) {
                  e.preventDefault();
                  setFocusedNodeIdx(ni - 1);
                }
                if (e.key === "ArrowRight" && ni < data.nodes.length - 1) {
                  e.preventDefault();
                  setFocusedNodeIdx(ni + 1);
                }
                if (e.key === "Enter") navigateToNode(node);
              }}
            >
              {node.isFocus && (
                <circle
                  r={r + 6}
                  fill="none"
                  stroke={node.color}
                  strokeOpacity={0.3}
                  strokeWidth={1.4}
                />
              )}
              <motion.circle
                r={r}
                fill="#1C1B18"
                stroke={node.color}
                strokeWidth={1.4}
                initial={reducedMotion ? false : { scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={popTransition(STAGGER_THREAD * ni)}
                style={{
                  stroke: hovered ? KONST.nodeBright : node.color,
                }}
              />
              <circle r={3} fill="#EFE7CE" />
              <text
                y={r + 14}
                textAnchor="middle"
                fill={KONST.muted}
                fontSize={11}
                letterSpacing="0.08em"
              >
                {node.typeLabel.toUpperCase()}
              </text>
              <text
                y={r + 28}
                textAnchor="middle"
                fill={node.isFocus || hovered ? KONST.display : "#B7AE97"}
                fontSize={11}
                letterSpacing="0.08em"
              >
                {truncateLabel(node.label, 24, nodeCount)}
              </text>
            </g>
          );
        })}
      </svg>

      <div
        className="pointer-events-none absolute inset-x-0 bottom-6 z-30 flex flex-col items-center text-center"
        style={{ fontFamily: DISPLAY_FONT }}
      >
        <p
          className="text-2xl tracking-[0.35em]"
          style={{ color: KONST.display }}
        >
          NITKA
        </p>
        <p
          className="mt-1 text-[11px] tracking-[0.18em]"
          style={{ color: KONST.muted }}
        >
          {focusNode.label} · {data.nodes.length} ogniw · {decisionCount}{" "}
          decyzji
        </p>
      </div>

      {decisionOpen && (
        <DecisionOverlay
          projectId={projectId}
          entityType={focusNode.ref.type}
          entityId={focusNode.ref.id}
          entityLabel={decisionOpen.title}
          open
          onClose={() => setDecisionOpen(null)}
        />
      )}
    </>
  );
}
