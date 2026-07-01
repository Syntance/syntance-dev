/**
 * Read-only miniatura quadrantu pozycjonowania — używana na Strategy Canvas.
 * Współrzędne X/Y w zakresie [-1, 1]. Bez interakcji, bez sidebara.
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
  className?: string;
}

const SIZE = 120;
const PAD = 10;
const CHART = SIZE - PAD * 2;

function toPx(v: number, axis: "x" | "y") {
  const half = CHART / 2;
  if (axis === "x") return PAD + half + v * half;
  return PAD + half - v * half;
}

export function PositioningMini({
  ourX,
  ourY,
  ourLabel,
  competitors = [],
  className,
}: PositioningMiniProps) {
  const hasOur = ourX !== null && ourY !== null;

  return (
    <svg
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      className={className}
      role="img"
      aria-label="Miniatura pozycjonowania marki"
    >
      <rect
        x={PAD}
        y={PAD}
        width={CHART}
        height={CHART}
        fill="transparent"
        stroke="currentColor"
        strokeOpacity={0.15}
        rx={3}
      />
      <line
        x1={toPx(0, "x")}
        y1={PAD}
        x2={toPx(0, "x")}
        y2={SIZE - PAD}
        stroke="currentColor"
        strokeOpacity={0.12}
        strokeDasharray="2 2"
      />
      <line
        x1={PAD}
        y1={toPx(0, "y")}
        x2={SIZE - PAD}
        y2={toPx(0, "y")}
        stroke="currentColor"
        strokeOpacity={0.12}
        strokeDasharray="2 2"
      />
      {competitors.map((c, i) => (
        <circle
          key={`${c.label}-${i}`}
          cx={toPx(c.x, "x")}
          cy={toPx(c.y, "y")}
          r={3}
          fill="currentColor"
          fillOpacity={0.4}
        />
      ))}
      {hasOur && (
        <circle
          cx={toPx(ourX, "x")}
          cy={toPx(ourY, "y")}
          r={5}
          fill="oklch(0.7 0.18 60)"
          stroke="var(--background)"
          strokeWidth={1.5}
        >
          <title>{ourLabel || "Nasza marka"}</title>
        </circle>
      )}
    </svg>
  );
}
