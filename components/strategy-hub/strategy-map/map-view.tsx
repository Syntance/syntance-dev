"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import {
  AnimatePresence,
  motion,
  useReducedMotion,
} from "motion/react";
import {
  X,
  ChevronLeft,
  ChevronRight,
  ArrowUpRight,
  Network,
  Lock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { statusEmoji } from "./status-dot";
import type {
  StrategyNode,
  StrategyEdge,
  StrategyNodeKey,
  MapSubcategory,
  NodeStatus,
} from "@/lib/strategy-hub/strategy-map-types";

// ── Geometria fixed layout ────────────────────────────────────────────────────
const NODE_W = 168;
const NODE_H = 68;
const STEP_X = 248;
const CENTER_Y = 232;
const MARGIN_X = 48;

interface MapViewProps {
  nodes: StrategyNode[];
  edges: StrategyEdge[];
  order: StrategyNodeKey[];
  mode: "editor" | "client";
  /** Czy widok mapy jest aktualnie aktywny (widoczny). */
  active: boolean;
  /** Inkrement uruchamia tryb prezentacji. */
  presentSignal: number;
  onOpenInfluence: () => void;
}

interface Positioned {
  node: StrategyNode;
  index: number;
  cx: number;
}

export function MapView({
  nodes,
  edges,
  order,
  mode,
  active,
  presentSignal,
  onOpenInfluence,
}: MapViewProps) {
  const reduce = useReducedMotion();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [expandedKey, setExpandedKey] = useState<StrategyNodeKey | null>(null);
  const [openSub, setOpenSub] = useState<{ nodeKey: StrategyNodeKey; subIdx: number } | null>(null);
  const [presenting, setPresenting] = useState(false);
  const [step, setStep] = useState(0);

  const ordered = useMemo<Positioned[]>(() => {
    const byKey = new Map(nodes.map((n) => [n.key, n]));
    return order
      .map((key, i) => {
        const node = byKey.get(key);
        if (!node) return null;
        return { node, index: i, cx: MARGIN_X + i * STEP_X + NODE_W / 2 };
      })
      .filter((x): x is Positioned => x !== null);
  }, [nodes, order]);

  const posByKey = useMemo(
    () => new Map(ordered.map((p) => [p.node.key, p])),
    [ordered]
  );

  const canvasW = MARGIN_X * 2 + (ordered.length - 1) * STEP_X + NODE_W;
  const canvasH = 464;

  // Status mapy zależności — które węzły są zablokowane (upstream pusty, tylko editor).
  const lockedKeys = useMemo(() => {
    if (mode === "client") return new Set<StrategyNodeKey>();
    const statusByKey = new Map(nodes.map((n) => [n.key, n.status]));
    const locked = new Set<StrategyNodeKey>();
    for (const e of edges) {
      const up = statusByKey.get(e.from);
      if (up === "empty") locked.add(e.to);
    }
    return locked;
  }, [nodes, edges, mode]);

  const scrollToNode = useCallback(
    (key: StrategyNodeKey) => {
      const el = scrollRef.current;
      const pos = posByKey.get(key);
      if (!el || !pos) return;
      const targetLeft = pos.cx - el.clientWidth / 2;
      el.scrollTo({ left: Math.max(0, targetLeft), behavior: reduce ? "auto" : "smooth" });
    },
    [posByKey, reduce]
  );

  const toggleNode = useCallback((key: StrategyNodeKey) => {
    setOpenSub(null);
    setExpandedKey((cur) => (cur === key ? null : key));
  }, []);

  // ── Tryb prezentacji ──
  const stopPresentation = useCallback(() => {
    setPresenting(false);
    setExpandedKey(null);
    setOpenSub(null);
  }, []);

  useEffect(() => {
    if (presentSignal === 0) return;
    setPresenting(true);
    setStep(0);
  }, [presentSignal]);

  useEffect(() => {
    if (!presenting) return;
    const key = order[step];
    if (!key) {
      stopPresentation();
      return;
    }
    setExpandedKey(key);
    setOpenSub(null);
    scrollToNode(key);
    const t = setTimeout(() => {
      setStep((s) => s + 1);
    }, reduce ? 1600 : 3200);
    return () => clearTimeout(t);
  }, [presenting, step, order, scrollToNode, stopPresentation, reduce]);

  // ── Klawiatura ──
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (openSub) setOpenSub(null);
      else if (presenting) stopPresentation();
      else if (expandedKey) setExpandedKey(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, openSub, presenting, expandedKey, stopPresentation]);

  const activeNode = expandedKey ? posByKey.get(expandedKey)?.node : null;
  const openSubData =
    openSub && activeNode && openSub.nodeKey === expandedKey
      ? activeNode.subcategories[openSub.subIdx]
      : null;

  return (
    <div className="relative">
      {presenting && (
        <div className="absolute left-1/2 top-2 z-30 -translate-x-1/2">
          <div className="flex items-center gap-3 rounded-full border border-border bg-card/90 px-4 py-1.5 text-xs shadow-lg backdrop-blur">
            <span className="font-medium">
              Prezentacja · krok {Math.min(step + 1, order.length)} / {order.length}
            </span>
            <button
              type="button"
              onClick={stopPresentation}
              className="text-muted-foreground hover:text-foreground"
            >
              Zatrzymaj
            </button>
          </div>
        </div>
      )}

      <div
        ref={scrollRef}
        className="overflow-x-auto overflow-y-hidden rounded-2xl border border-border bg-[radial-gradient(circle_at_1px_1px,var(--border)_1px,transparent_0)] bg-size-[24px_24px]"
      >
        <div
          className="relative"
          style={{ width: canvasW, height: canvasH }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setExpandedKey(null);
              setOpenSub(null);
            }
          }}
        >
          {/* Krawędzie zależności */}
          <svg
            className="pointer-events-none absolute inset-0"
            width={canvasW}
            height={canvasH}
          >
            <defs>
              <marker
                id="sm-arrow"
                viewBox="0 0 10 10"
                refX="9"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--muted-foreground)" />
              </marker>
            </defs>
            {edges.map((e) => {
              const from = posByKey.get(e.from);
              const to = posByKey.get(e.to);
              if (!from || !to) return null;
              const x1 = from.cx + NODE_W / 2;
              const x2 = to.cx - NODE_W / 2;
              const gap = to.index - from.index;
              const dimmed = expandedKey && expandedKey !== e.from && expandedKey !== e.to;
              // Łuk dla skoków, prosta krzywa dla sąsiadów.
              const arc = gap > 1 ? -28 * gap : 0;
              const my = CENTER_Y + arc;
              const cx1 = x1 + (x2 - x1) * 0.4;
              const cx2 = x1 + (x2 - x1) * 0.6;
              return (
                <path
                  key={`${e.from}-${e.to}`}
                  d={`M ${x1} ${CENTER_Y} C ${cx1} ${my}, ${cx2} ${my}, ${x2} ${CENTER_Y}`}
                  fill="none"
                  stroke="var(--muted-foreground)"
                  strokeWidth={1.5}
                  strokeOpacity={dimmed ? 0.12 : 0.4}
                  markerEnd="url(#sm-arrow)"
                />
              );
            })}
          </svg>

          {/* Węzły L1 + gałęzie L2 */}
          {ordered.map(({ node, cx }) => {
            const isExpanded = expandedKey === node.key;
            const dimmed = expandedKey != null && !isExpanded;
            const locked = lockedKeys.has(node.key);
            return (
              <div key={node.key}>
                <L1Node
                  node={node}
                  cx={cx}
                  expanded={isExpanded}
                  dimmed={dimmed}
                  locked={locked}
                  mode={mode}
                  reduce={!!reduce}
                  onClick={() => !locked && toggleNode(node.key)}
                  onOpenInfluence={node.key === "lejek" ? onOpenInfluence : undefined}
                />
                <AnimatePresence>
                  {isExpanded && (
                    <L2Branches
                      key={`l2-${node.key}`}
                      node={node}
                      cx={cx}
                      reduce={!!reduce}
                      onOpen={(subIdx) => setOpenSub({ nodeKey: node.key, subIdx })}
                    />
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </div>

      {/* Karta L3 */}
      <AnimatePresence>
        {openSubData && activeNode && (
          <L3Card
            key={`${activeNode.key}-${openSub!.subIdx}`}
            node={activeNode}
            subIdx={openSub!.subIdx}
            mode={mode}
            reduce={!!reduce}
            onClose={() => setOpenSub(null)}
            onNav={(dir) => {
              const len = activeNode.subcategories.length;
              setOpenSub((cur) =>
                cur
                  ? { nodeKey: cur.nodeKey, subIdx: (cur.subIdx + dir + len) % len }
                  : cur
              );
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Węzeł L1 ──────────────────────────────────────────────────────────────────

function L1Node({
  node,
  cx,
  expanded,
  dimmed,
  locked,
  mode,
  reduce,
  onClick,
  onOpenInfluence,
}: {
  node: StrategyNode;
  cx: number;
  expanded: boolean;
  dimmed: boolean;
  locked: boolean;
  mode: "editor" | "client";
  reduce: boolean;
  onClick: () => void;
  onOpenInfluence?: () => void;
}) {
  return (
    <motion.div
      className="absolute z-10"
      style={{ left: cx - NODE_W / 2, top: CENTER_Y - NODE_H / 2, width: NODE_W }}
      animate={{
        opacity: dimmed ? 0.35 : 1,
        scale: expanded && !reduce ? 1.04 : 1,
      }}
      transition={{ duration: reduce ? 0 : 0.25 }}
    >
      <button
        type="button"
        onClick={onClick}
        disabled={locked}
        aria-expanded={expanded}
        className={cn(
          "group relative flex w-full flex-col items-start gap-1 rounded-xl border bg-card px-3 py-2.5 text-left shadow-sm transition-colors",
          expanded ? "border-brand/60 ring-2 ring-brand/20" : "border-border hover:border-brand/40",
          locked && "cursor-not-allowed opacity-50"
        )}
        title={locked ? "Najpierw uzupełnij poprzedni moduł" : undefined}
        style={{ height: NODE_H }}
      >
        <div className="flex w-full items-center gap-2">
          <span className="text-base leading-none">{node.icon}</span>
          <span className="min-w-0 flex-1 truncate text-sm font-semibold">
            {node.label}
          </span>
          {locked ? (
            <Lock className="size-3.5 text-muted-foreground" />
          ) : (
            <span className="text-xs leading-none">{statusEmoji(node.status, mode)}</span>
          )}
        </div>
        <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={cn(
              "h-full rounded-full",
              node.score >= 80 ? "bg-success" : node.score > 0 ? "bg-amber-400" : "bg-red-400/60"
            )}
            style={{ width: `${node.score}%` }}
          />
        </div>
      </button>

      {expanded && onOpenInfluence && (
        <button
          type="button"
          onClick={onOpenInfluence}
          className="absolute -right-1 -top-1 z-20 inline-flex items-center gap-1 rounded-full border border-brand/40 bg-card px-2 py-0.5 text-[10px] font-medium text-brand shadow hover:bg-brand/10"
        >
          <Network className="size-3" /> Graf wpływu
        </button>
      )}
    </motion.div>
  );
}

// ── Gałęzie L2 (wyrastają góra/dół) ────────────────────────────────────────────

function L2Branches({
  node,
  cx,
  reduce,
  onOpen,
}: {
  node: StrategyNode;
  cx: number;
  reduce: boolean;
  onOpen: (subIdx: number) => void;
}) {
  // Naprzemiennie: parzyste w dół, nieparzyste w górę.
  const up: { sub: MapSubcategory; idx: number }[] = [];
  const down: { sub: MapSubcategory; idx: number }[] = [];
  node.subcategories.forEach((sub, idx) => {
    (idx % 2 === 0 ? down : up).push({ sub, idx });
  });

  const chipH = 34;
  const chipGap = 8;
  const offsetFromNode = NODE_H / 2 + 16;

  return (
    <>
      {up.map(({ sub, idx }, i) => (
        <Chip
          key={sub.id}
          sub={sub}
          cx={cx}
          y={CENTER_Y - offsetFromNode - (i + 1) * (chipH + chipGap)}
          delay={reduce ? 0 : i * 0.04}
          reduce={reduce}
          onClick={() => onOpen(idx)}
        />
      ))}
      {down.map(({ sub, idx }, i) => (
        <Chip
          key={sub.id}
          sub={sub}
          cx={cx}
          y={CENTER_Y + offsetFromNode + i * (chipH + chipGap)}
          delay={reduce ? 0 : i * 0.04}
          reduce={reduce}
          onClick={() => onOpen(idx)}
        />
      ))}
    </>
  );
}

function Chip({
  sub,
  cx,
  y,
  delay,
  reduce,
  onClick,
}: {
  sub: MapSubcategory;
  cx: number;
  y: number;
  delay: number;
  reduce: boolean;
  onClick: () => void;
}) {
  const W = 188;
  return (
    <motion.button
      type="button"
      layoutId={`sub-${sub.id}`}
      onClick={onClick}
      className="absolute z-20 flex items-center gap-2 rounded-lg border border-border bg-card px-2.5 py-1.5 text-left shadow-sm transition-colors hover:border-brand/50"
      style={{ left: cx - W / 2, top: y, width: W }}
      initial={reduce ? false : { opacity: 0, y: CENTER_Y - y > 0 ? 8 : -8, scale: 0.92 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={reduce ? undefined : { opacity: 0, scale: 0.92 }}
      transition={{ delay, duration: reduce ? 0 : 0.2 }}
    >
      <span className="min-w-0 flex-1 truncate text-xs font-medium">
        {sub.label}
      </span>
      <span className="shrink-0 rounded-full bg-muted px-1.5 text-[10px] tabular-nums text-muted-foreground">
        {sub.count}
      </span>
    </motion.button>
  );
}

// ── Karta L3 ────────────────────────────────────────────────────────────────

function L3Card({
  node,
  subIdx,
  mode,
  reduce,
  onClose,
  onNav,
}: {
  node: StrategyNode;
  subIdx: number;
  mode: "editor" | "client";
  reduce: boolean;
  onClose: () => void;
  onNav: (dir: 1 | -1) => void;
}) {
  const sub = node.subcategories[subIdx];
  const [showAll, setShowAll] = useState(false);
  const preview = showAll ? sub.items : sub.items.slice(0, 5);

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div
        className="absolute inset-0 bg-background/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <motion.div
        layoutId={`sub-${sub.id}`}
        className="relative z-10 flex max-h-[80vh] w-full max-w-lg flex-col rounded-2xl border border-border bg-card shadow-2xl"
        initial={reduce ? false : { scale: 0.96 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 320, damping: 30 }}
      >
        <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>{node.icon}</span>
              <span>{node.label}</span>
            </div>
            <h3 className="mt-0.5 truncate text-base font-semibold">{sub.label}</h3>
            <p className="text-xs text-muted-foreground">{sub.count} pozycji</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Zamknij"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {sub.items.length === 0 ? (
            <p className="text-sm text-muted-foreground">Brak danych w tej sekcji.</p>
          ) : (
            <ul className="space-y-2.5">
              {preview.map((item) => (
                <li key={item.id} className="flex items-baseline gap-2 text-sm">
                  <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-brand/60" />
                  <div className="min-w-0">
                    <span className="text-foreground/90">{item.label}</span>
                    {item.note && (
                      <span className="block text-xs text-muted-foreground">
                        {item.note}
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
          {sub.items.length > 5 && (
            <button
              type="button"
              onClick={() => setShowAll((v) => !v)}
              className="mt-3 text-xs font-medium text-brand hover:underline"
            >
              {showAll ? "Zwiń" : `Rozwiń pełną treść (+${sub.items.length - 5})`}
            </button>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-border px-5 py-3">
          <button
            type="button"
            onClick={() => onNav(-1)}
            className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="size-3.5" /> Poprzedni
          </button>
          {mode === "editor" && (
            <Link
              href={node.href}
              className="inline-flex items-center gap-1 rounded-lg bg-brand/10 px-2.5 py-1.5 text-xs font-medium text-brand hover:bg-brand/20"
            >
              Edytuj <ArrowUpRight className="size-3.5" />
            </Link>
          )}
          <button
            type="button"
            onClick={() => onNav(1)}
            className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            Następny <ChevronRight className="size-3.5" />
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

export type { NodeStatus };
