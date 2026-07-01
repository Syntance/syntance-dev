/**
 * Read-only quadrat pozycjonowania — miniatura (Canvas) lub pełny widok (portal klienta).
 * Współrzędne X/Y w zakresie [-1, 1]. Bez interakcji.
 */

export interface MiniMarker {
  label: string;
  x: number;
  y: number;
}

interface PositioningMiniProps {
  ourX: number | null;
  ourY: number | null;
  ourLabel?: string | null;
  competitors?: MiniMarker[];
  axisXLabel?: string | null;
  axisYLabel?: string | null;
  statementMd?: string | null;
  variant?: "mini" | "full";
  className?: string;
}

const MINI_SIZE = 120;
const FULL_SIZE = 360;
const PAD_MINI = 10;
const PAD_FULL = 36;

function toPx(v: number, axis: "x" | "y", size: number, pad: number) {
  const chart = size - pad * 2;
  const half = chart / 2;
  if (axis === "x") return pad + half + v * half;
  return pad + half - v * half;
}

function parseCompetitors(raw: unknown): MiniMarker[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (c): c is { label: string; x: number; y: number } =>
        typeof c === "object" &&
        c !== null &&
        typeof (c as { label?: unknown }).label === "string" &&
        typeof (c as { x?: unknown }).x === "number" &&
        typeof (c as { y?: unknown }).y === "number"
    )
    .map((c) => ({ label: c.label, x: c.x, y: c.y }));
}

export function parsePositioningCompetitors(raw: unknown): MiniMarker[] {
  return parseCompetitors(raw);
}

export function PositioningMini({
  ourX,
  ourY,
  ourLabel,
  competitors = [],
  axisXLabel,
  axisYLabel,
  statementMd,
  variant = "mini",
  className,
}: PositioningMiniProps) {
  const hasOur = ourX !== null && ourY !== null;
  const isFull = variant === "full";
  const size = isFull ? FULL_SIZE : MINI_SIZE;
  const pad = isFull ? PAD_FULL : PAD_MINI;
  const chart = size - pad * 2;

  const chartSvg = (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      className={isFull ? "w-full max-w-md mx-auto" : className}
      role="img"
      aria-label="Quadrat pozycjonowania marki"
    >
      {isFull && axisYLabel && (
        <text
          x={pad - 8}
          y={size / 2}
          textAnchor="middle"
          transform={`rotate(-90 ${pad - 8} ${size / 2})`}
          className="fill-muted-foreground text-[10px]"
        >
          {axisYLabel}
        </text>
      )}
      {isFull && axisXLabel && (
        <text
          x={size / 2}
          y={size - 6}
          textAnchor="middle"
          className="fill-muted-foreground text-[10px]"
        >
          {axisXLabel}
        </text>
      )}
      <rect
        x={pad}
        y={pad}
        width={chart}
        height={chart}
        fill="transparent"
        stroke="currentColor"
        strokeOpacity={0.15}
        rx={isFull ? 8 : 3}
      />
      <line
        x1={toPx(0, "x", size, pad)}
        y1={pad}
        x2={toPx(0, "x", size, pad)}
        y2={size - pad}
        stroke="currentColor"
        strokeOpacity={0.12}
        strokeDasharray="2 2"
      />
      <line
        x1={pad}
        y1={toPx(0, "y", size, pad)}
        x2={size - pad}
        y2={toPx(0, "y", size, pad)}
        stroke="currentColor"
        strokeOpacity={0.12}
        strokeDasharray="2 2"
      />
      {competitors.map((c, i) => (
        <g key={`${c.label}-${i}`}>
          <circle
            cx={toPx(c.x, "x", size, pad)}
            cy={toPx(c.y, "y", size, pad)}
            r={isFull ? 5 : 3}
            fill="currentColor"
            fillOpacity={0.4}
          />
          {isFull && (
            <text
              x={toPx(c.x, "x", size, pad) + 8}
              y={toPx(c.y, "y", size, pad) + 4}
              className="fill-muted-foreground text-[9px]"
            >
              {c.label}
            </text>
          )}
        </g>
      ))}
      {hasOur && (
        <g>
          <circle
            cx={toPx(ourX, "x", size, pad)}
            cy={toPx(ourY, "y", size, pad)}
            r={isFull ? 8 : 5}
            fill="oklch(0.7 0.18 60)"
            stroke="var(--background)"
            strokeWidth={isFull ? 2 : 1.5}
          />
          {isFull && ourLabel && (
            <text
              x={toPx(ourX, "x", size, pad) + 10}
              y={toPx(ourY, "y", size, pad) - 6}
              className="fill-brand text-[10px] font-medium"
            >
              {ourLabel}
            </text>
          )}
          {!isFull && <title>{ourLabel || "Nasza marka"}</title>}
        </g>
      )}
    </svg>
  );

  if (!isFull) return chartSvg;

  const hasStatement = Boolean(statementMd?.trim());

  return (
    <div className={className}>
      <div className="rounded-xl border border-border bg-card/50 p-6">
        {chartSvg}
        {hasOur && ourLabel && !isFull && null}
      </div>
      {hasStatement && (
        <div className="mt-4 rounded-xl border border-border bg-card/40 p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
            Statement pozycjonowania
          </h3>
          <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap">
            {statementMd}
          </p>
        </div>
      )}
    </div>
  );
}
