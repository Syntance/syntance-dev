import { cn } from "@/lib/utils";

interface HealthRingProps {
  /** 0-100 */
  score: number;
  size?: number;
  className?: string;
}

/**
 * Pierścień health score (SVG donut). Kolor dostosowany do progu:
 * <40 neutralny, 40-79 brand, >=80 success.
 */
export function HealthRing({ score, size = 96, className }: HealthRingProps) {
  const clamped = Math.max(0, Math.min(100, Math.round(score)));
  const stroke = 8;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - clamped / 100);

  const color =
    clamped >= 80
      ? "var(--success)"
      : clamped >= 40
        ? "var(--brand)"
        : "var(--muted-foreground)";

  return (
    <div
      className={cn("relative shrink-0", className)}
      style={{ width: size, height: size }}
      role="img"
      aria-label={`Health score ${clamped} procent`}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          className="stroke-muted"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          stroke={color}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-500"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-semibold tabular-nums">{clamped}</span>
        <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
          score
        </span>
      </div>
    </div>
  );
}
