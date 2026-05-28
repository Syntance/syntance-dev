"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type PointerEvent,
} from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, Loader2, Check, GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Quadrant chart pozycjonowania marki.
 * Współrzędne X/Y w zakresie [-1, 1], gdzie 0 = środek.
 */
export interface CompetitorMarker {
  id?: string;
  label: string;
  x: number;
  y: number;
}

interface PositioningEditorProps {
  axisXLabel: string;
  axisYLabel: string;
  ourX: number | null;
  ourY: number | null;
  ourLabel: string;
  competitors: CompetitorMarker[];
  statementMd: string;
  onSave: (
    patch: Partial<{
      axisXLabel: string | null;
      axisYLabel: string | null;
      ourX: number | null;
      ourY: number | null;
      ourLabel: string | null;
      competitorsOnQuadrant: CompetitorMarker[] | null;
      statementMd: string | null;
    }>
  ) => Promise<void>;
}

const SVG_SIZE = 320;
const PADDING = 24;
const CHART = SVG_SIZE - PADDING * 2;

function clamp(v: number, min = -1, max = 1) {
  return Math.max(min, Math.min(max, v));
}

/** Znormalizowane (-1..1) → pixel w SVG. */
function toPx(v: number, axis: "x" | "y") {
  const half = CHART / 2;
  if (axis === "x") return PADDING + half + v * half;
  return PADDING + half - v * half; // odwrócone Y (rośnie w dół)
}

export function PositioningEditor({
  axisXLabel: axisXInit,
  axisYLabel: axisYInit,
  ourX,
  ourY,
  ourLabel: ourLabelInit,
  competitors,
  statementMd: statementInit,
  onSave,
}: PositioningEditorProps) {
  const [axisX, setAxisX] = useState(axisXInit);
  const [axisY, setAxisY] = useState(axisYInit);
  const [ourLabel, setOurLabel] = useState(ourLabelInit);
  const [our, setOur] = useState<{ x: number; y: number } | null>(
    ourX !== null && ourY !== null ? { x: ourX, y: ourY } : null
  );
  const [comps, setComps] = useState<CompetitorMarker[]>(competitors);
  const [statement, setStatement] = useState(statementInit);
  const [pending, startTransition] = useTransition();
  const [savedTick, setSavedTick] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<{ kind: "our" } | { kind: "comp"; idx: number } | null>(
    null
  );

  const flashSaved = useCallback(() => {
    setSavedTick(true);
    setTimeout(() => setSavedTick(false), 1500);
  }, []);

  const debouncedSave = useMemo(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    return (
      patch: Parameters<typeof onSave>[0],
      delay = 500
    ) => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        startTransition(async () => {
          try {
            await onSave(patch);
            flashSaved();
          } catch (err) {
            console.error(err);
          }
        });
      }, delay);
    };
  }, [onSave, flashSaved]);

  // ── Pointer → znormalizowane (-1..1) ──────────────────────────────
  const pointerToCoord = useCallback((e: PointerEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * SVG_SIZE;
    const py = ((e.clientY - rect.top) / rect.height) * SVG_SIZE;
    const half = CHART / 2;
    const x = clamp((px - PADDING - half) / half);
    const y = clamp(-(py - PADDING - half) / half);
    return { x, y };
  }, []);

  // ── Click na puste pole = ustaw nas, jeśli jeszcze brak punktu ────
  const handleSvgClick = (e: PointerEvent<SVGSVGElement>) => {
    if (dragRef.current) return;
    const coord = pointerToCoord(e);
    if (!coord) return;
    if (!our) {
      setOur(coord);
      debouncedSave({ ourX: coord.x, ourY: coord.y }, 0);
    }
  };

  // ── Drag ──────────────────────────────────────────────────────────
  const onPointerMove = (e: PointerEvent<SVGSVGElement>) => {
    if (!dragRef.current) return;
    const coord = pointerToCoord(e);
    if (!coord) return;
    if (dragRef.current.kind === "our") {
      setOur(coord);
    } else {
      const idx = dragRef.current.idx;
      setComps((prev) =>
        prev.map((c, i) => (i === idx ? { ...c, x: coord.x, y: coord.y } : c))
      );
    }
  };

  const onPointerUp = (e: PointerEvent<SVGSVGElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    const coord = pointerToCoord(e);
    if (coord && drag.kind === "our") {
      debouncedSave({ ourX: coord.x, ourY: coord.y }, 0);
    } else if (coord && drag.kind === "comp") {
      const idx = drag.idx;
      const updated = comps.map((c, i) =>
        i === idx ? { ...c, x: coord.x, y: coord.y } : c
      );
      debouncedSave({ competitorsOnQuadrant: updated }, 0);
    }
    dragRef.current = null;
    (e.target as Element).releasePointerCapture?.(e.pointerId);
  };

  // ── Add competitor ────────────────────────────────────────────────
  const addCompetitor = () => {
    const label = window.prompt("Nazwa konkurenta:");
    if (!label?.trim()) return;
    const next = [...comps, { label: label.trim(), x: 0, y: 0 }];
    setComps(next);
    debouncedSave({ competitorsOnQuadrant: next }, 0);
  };

  const removeCompetitor = (idx: number) => {
    const next = comps.filter((_, i) => i !== idx);
    setComps(next);
    debouncedSave({ competitorsOnQuadrant: next }, 0);
  };

  // ── Field handlers ────────────────────────────────────────────────
  const onAxisXChange = (v: string) => {
    setAxisX(v);
    debouncedSave({ axisXLabel: v || null });
  };
  const onAxisYChange = (v: string) => {
    setAxisY(v);
    debouncedSave({ axisYLabel: v || null });
  };
  const onOurLabelChange = (v: string) => {
    setOurLabel(v);
    debouncedSave({ ourLabel: v || null });
  };
  const onStatementChange = (v: string) => {
    setStatement(v);
    debouncedSave({ statementMd: v || null });
  };

  // Skróty osi: "Premium ↔ Tania" → ["Premium", "Tania"]
  const [axisXLeft, axisXRight] = useMemo(() => {
    const parts = axisX.split(/\s*[↔→\-/|]\s*/).map((s) => s.trim());
    return [parts[0] || "—", parts[1] || "—"];
  }, [axisX]);
  const [axisYBottom, axisYTop] = useMemo(() => {
    const parts = axisY.split(/\s*[↔→\-/|]\s*/).map((s) => s.trim());
    return [parts[0] || "—", parts[1] || "—"];
  }, [axisY]);

  return (
    <div className="flex flex-col">
      {/* Status bar */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border">
        <span className="text-xs text-muted-foreground mr-auto">
          {comps.length} {comps.length === 1 ? "konkurent" : "konkurentów"}
          {our ? " · pozycja ustawiona" : " · kliknij wykres żeby ustawić nas"}
        </span>
        {pending && (
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Loader2 className="size-3 animate-spin" />
            Zapisywanie…
          </span>
        )}
        {!pending && savedTick && (
          <span className="inline-flex items-center gap-1 text-xs text-success">
            <Check className="size-3" />
            Zapisano
          </span>
        )}
      </div>

      <div className="grid lg:grid-cols-[1fr_300px] gap-4 p-4">
        {/* ── Quadrant chart ────────────────────────────────── */}
        <div className="flex flex-col items-center">
          <div className="flex items-center gap-2 w-full mb-2">
            <Input
              value={axisX}
              onChange={(e) => onAxisXChange(e.target.value)}
              placeholder="Oś X (np. Tania ↔ Premium)"
              className="h-7 text-xs flex-1"
            />
            <Input
              value={axisY}
              onChange={(e) => onAxisYChange(e.target.value)}
              placeholder="Oś Y (np. Generic ↔ Personalised)"
              className="h-7 text-xs flex-1"
            />
          </div>
          <div className="relative w-full max-w-[420px] aspect-square">
            <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[11px] text-muted-foreground font-medium">
              {axisYTop}
            </span>
            <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[11px] text-muted-foreground font-medium">
              {axisYBottom}
            </span>
            <span className="absolute top-1/2 -left-1 -translate-y-1/2 -translate-x-full text-[11px] text-muted-foreground font-medium">
              {axisXLeft}
            </span>
            <span className="absolute top-1/2 -right-1 -translate-y-1/2 translate-x-full text-[11px] text-muted-foreground font-medium">
              {axisXRight}
            </span>
            <svg
              ref={svgRef}
              viewBox={`0 0 ${SVG_SIZE} ${SVG_SIZE}`}
              className="w-full h-full touch-none cursor-crosshair"
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onClick={handleSvgClick}
            >
              <rect
                x={PADDING}
                y={PADDING}
                width={CHART}
                height={CHART}
                fill="transparent"
                stroke="currentColor"
                strokeOpacity={0.15}
                rx={4}
              />
              <line
                x1={toPx(0, "x")}
                y1={PADDING}
                x2={toPx(0, "x")}
                y2={SVG_SIZE - PADDING}
                stroke="currentColor"
                strokeOpacity={0.2}
                strokeDasharray="3 3"
              />
              <line
                x1={PADDING}
                y1={toPx(0, "y")}
                x2={SVG_SIZE - PADDING}
                y2={toPx(0, "y")}
                stroke="currentColor"
                strokeOpacity={0.2}
                strokeDasharray="3 3"
              />
              {/* Konkurenci */}
              {comps.map((c, idx) => (
                <g
                  key={`${c.id ?? idx}-${c.label}`}
                  onPointerDown={(e) => {
                    dragRef.current = { kind: "comp", idx };
                    (e.target as Element).setPointerCapture?.(e.pointerId);
                  }}
                  className="cursor-grab active:cursor-grabbing"
                >
                  <circle
                    cx={toPx(c.x, "x")}
                    cy={toPx(c.y, "y")}
                    r={6}
                    fill="hsl(var(--muted-foreground))"
                    fillOpacity={0.6}
                    stroke="hsl(var(--background))"
                    strokeWidth={2}
                  />
                  <text
                    x={toPx(c.x, "x") + 9}
                    y={toPx(c.y, "y") + 3}
                    fontSize={10}
                    fill="currentColor"
                    fillOpacity={0.7}
                  >
                    {c.label}
                  </text>
                </g>
              ))}
              {/* Nasza marka */}
              {our && (
                <g
                  onPointerDown={(e) => {
                    dragRef.current = { kind: "our" };
                    (e.target as Element).setPointerCapture?.(e.pointerId);
                  }}
                  className="cursor-grab active:cursor-grabbing"
                >
                  <circle
                    cx={toPx(our.x, "x")}
                    cy={toPx(our.y, "y")}
                    r={9}
                    fill="oklch(0.7 0.18 60)"
                    stroke="hsl(var(--background))"
                    strokeWidth={2}
                  />
                  <text
                    x={toPx(our.x, "x") + 12}
                    y={toPx(our.y, "y") + 4}
                    fontSize={11}
                    fontWeight={600}
                    fill="currentColor"
                  >
                    {ourLabel || "Nasza marka"}
                  </text>
                </g>
              )}
            </svg>
          </div>
        </div>

        {/* ── Sidebar: my + konkurenci + statement ──────────── */}
        <div className="space-y-3">
          <div>
            <label className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">
              Nasza marka
            </label>
            <Input
              value={ourLabel}
              onChange={(e) => onOurLabelChange(e.target.value)}
              placeholder="np. Syntance"
              className="h-8 text-sm mt-1"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">
                Konkurenci
              </label>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={addCompetitor}
                className="h-6 gap-1 px-2 text-xs"
              >
                <Plus className="size-3" />
                Dodaj
              </Button>
            </div>
            {comps.length === 0 ? (
              <p className="text-xs text-muted-foreground/70">Brak konkurentów</p>
            ) : (
              <ul className="space-y-1">
                {comps.map((c, idx) => (
                  <li
                    key={`${c.id ?? idx}-${c.label}`}
                    className="group flex items-center gap-1 text-xs px-2 py-1 rounded bg-muted/30"
                  >
                    <GripVertical className="size-3 text-muted-foreground/50" />
                    <span className="truncate flex-1">{c.label}</span>
                    <span className="text-muted-foreground/60 tabular-nums">
                      ({c.x.toFixed(1)}, {c.y.toFixed(1)})
                    </span>
                    <button
                      type="button"
                      onClick={() => removeCompetitor(idx)}
                      className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
                      aria-label={`Usuń ${c.label}`}
                    >
                      <Trash2 className="size-3" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <label className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">
              Statement pozycjonowania
            </label>
            <textarea
              value={statement}
              onChange={(e) => onStatementChange(e.target.value)}
              placeholder="Dla [klient], który [potrzeba], jesteśmy [marką], która [korzyść], w przeciwieństwie do [konkurenta], my [różnica]."
              rows={4}
              className={cn(
                "w-full mt-1 px-2 py-1.5 text-sm rounded-md bg-muted/20 border border-border/40",
                "outline-none focus:ring-1 focus:ring-ring",
                "placeholder:text-muted-foreground/50 leading-snug"
              )}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
