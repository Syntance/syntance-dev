"use client";

import { cn } from "@/lib/utils";
import type { ConstellationNode } from "@/lib/strategy-hub/constellation-types";
import type { NodeStatus } from "@/lib/strategy-hub/strategy-map-types";
import { StatusDot } from "@/components/strategy-hub/strategy-map/status-dot";

const STATUS_RING: Record<NodeStatus, string> = {
  ready: "#22c55e",
  in_progress: "#fbbf24",
  empty: "#f87171",
  review: "#fbbf24",
};

interface ConstellationNodeProps {
  node: ConstellationNode;
  x: number;
  y: number;
  radius: number;
  focused: boolean;
  showLabel: boolean;
  mode: "editor" | "client";
  tabIndex: number;
  onFocus: () => void;
  onClick: () => void;
}

export function ConstellationNodeView({
  node,
  x,
  y,
  radius,
  focused,
  showLabel,
  mode,
  tabIndex,
  onFocus,
  onClick,
}: ConstellationNodeProps) {
  const label =
    node.kind === "area" && node.childCount
      ? `${node.label} (+${node.childCount})`
      : node.label;

  const ariaParts = [label];
  if (node.kind === "area" && node.status) {
    ariaParts.push(`status: ${node.status}`);
  }
  if (node.score != null) ariaParts.push(`kompletność ${node.score}%`);

  return (
    <g transform={`translate(${x}, ${y})`}>
      {focused && (
        <circle
          r={radius + 10}
          fill="none"
          stroke={node.color}
          strokeWidth={2}
          strokeOpacity={0.45}
          filter="url(#constellation-glow)"
        />
      )}

      {node.kind === "area" && node.status && (
        <circle
          r={radius + 4}
          fill="none"
          stroke={STATUS_RING[node.status]}
          strokeWidth={2}
          strokeOpacity={0.85}
        />
      )}

      <circle
        r={radius}
        fill={node.color}
        fillOpacity={node.kind === "core" ? 0.95 : 0.82}
        stroke="oklch(0.22 0.02 260)"
        strokeWidth={1.5}
        className={cn(focused && "stroke-brand/60")}
      />

      {node.kind === "core" && node.score != null && (
        <text
          y={4}
          textAnchor="middle"
          className="fill-white text-[11px] font-semibold pointer-events-none select-none"
        >
          {node.score}%
        </text>
      )}

      {showLabel && node.kind !== "core" && (
        <text
          y={radius + 14}
          textAnchor="middle"
          className="fill-foreground/90 text-[10px] pointer-events-none select-none"
        >
          {label.length > 22 ? `${label.slice(0, 20)}…` : label}
        </text>
      )}

      <circle r={radius + 6} fill="transparent" />

      <foreignObject x={-(radius + 8)} y={-(radius + 8)} width={(radius + 8) * 2} height={(radius + 8) * 2}>
        <button
          type="button"
          tabIndex={tabIndex}
          aria-label={ariaParts.join(", ")}
          onFocus={onFocus}
          onClick={onClick}
          className="size-full rounded-full opacity-0 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        >
          {node.kind === "area" && node.status && (
            <span className="sr-only">
              <StatusDot status={node.status} mode={mode} />
            </span>
          )}
        </button>
      </foreignObject>
    </g>
  );
}

function nodeRadius(kind: ConstellationNode["kind"]): number {
  if (kind === "core") return 36;
  if (kind === "area") return 28;
  return 10;
}

export { nodeRadius };
