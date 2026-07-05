"use client";

import { useMemo } from "react";
import { motion, useReducedMotion } from "motion/react";
import type { ConstellationNode } from "@/lib/strategy-hub/constellation-types";
import type { NodeStatus } from "@/lib/strategy-hub/strategy-map-types";
import type { StrategyArea } from "@/lib/strategy-hub/entities/entity-types";
import { StatusDot } from "@/components/strategy-hub/strategy-map/status-dot";
import { AreaGlyph } from "./area-glyphs";
import { KONST, generateCoreBurst } from "./constellation-theme";

const STATUS_ARC: Record<NodeStatus, string> = {
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
  /** Węzeł skrzydła zależności — chłodny (wpływa) lub ciepły (wynika). */
  sideTint?: "up" | "down" | null;
  /** Encja będąca centrum sceny „element" — ring w kolorze typu. */
  isSceneCenter?: boolean;
  /** Nadpisanie tekstu etykiety (np. prefiks typu na skrzydłach). */
  labelText?: string;
  /** Seed rozbłysku rdzenia (projectId) — unikalny wzór per projekt. */
  coreSeed?: string;
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
  sideTint = null,
  isSceneCenter = false,
  labelText,
  coreSeed,
}: ConstellationNodeProps) {
  const reduce = useReducedMotion();

  const burst = useMemo(
    () =>
      node.kind === "core"
        ? generateCoreBurst(coreSeed ?? node.id, radius * 0.85)
        : null,
    [node.kind, coreSeed, node.id, radius]
  );

  const areaKey =
    node.kind === "area" ? (node.id.slice(5) as StrategyArea) : null;

  const rawLabel = labelText ?? node.label;
  const label =
    node.kind === "area" && node.childCount
      ? `${rawLabel} +${node.childCount}`
      : rawLabel;

  const ariaParts = [label];
  if (node.kind === "area" && node.status) {
    ariaParts.push(`status: ${node.status}`);
  }
  if (node.score != null) ariaParts.push(`kompletność ${node.score}%`);

  const tint = sideTint === "up" ? KONST.up : sideTint === "down" ? KONST.down : null;
  const tintDot = sideTint === "up" ? KONST.upDot : KONST.downDot;
  const labelFill =
    sideTint === "up"
      ? KONST.upText
      : sideTint === "down"
        ? KONST.downText
        : focused
          ? KONST.label
          : KONST.muted;

  return (
    <g transform={`translate(${x}, ${y})`}>
      {focused && node.kind !== "core" && (
        <circle
          r={radius + 9}
          fill="none"
          stroke={KONST.node}
          strokeWidth={1.2}
          strokeOpacity={0.5}
          filter="url(#constellation-glow)"
        />
      )}

      {node.kind === "core" && burst && (
        <motion.g
          animate={reduce ? undefined : { scale: [1, 1.035, 1] }}
          transition={
            reduce ? undefined : { duration: 8, repeat: Infinity, ease: "easeInOut" }
          }
        >
          <circle r={radius * 1.3} fill={KONST.spark} opacity={0.05} />
          <circle r={radius * 0.7} fill={KONST.spark} opacity={0.09} />
          <g stroke={KONST.spark} strokeOpacity={0.08} strokeWidth={1}>
            {burst.sparkAngles.map((a, i) => (
              <line
                key={i}
                x1={0}
                y1={0}
                x2={Math.cos(a) * radius * 1.15}
                y2={Math.sin(a) * radius * 1.15}
              />
            ))}
          </g>
          {burst.particles.map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r={p.r} fill={p.color} />
          ))}
        </motion.g>
      )}

      {node.kind === "area" && areaKey && (
        <>
          {focused && (
            <circle
              r={radius + 6}
              fill="none"
              stroke={node.color}
              strokeWidth={1}
              strokeOpacity={0.35}
            />
          )}
          {node.status && node.score != null && node.score > 0 && (
            <circle
              r={radius + 4}
              fill="none"
              stroke={STATUS_ARC[node.status]}
              strokeWidth={1.5}
              strokeOpacity={0.65}
              pathLength={100}
              strokeDasharray={`${Math.min(100, node.score)} 100`}
              strokeLinecap="round"
              transform="rotate(-90)"
            />
          )}
          <circle
            r={radius}
            fill={KONST.chrome}
            stroke={node.color}
            strokeWidth={focused ? 2 : 1.5}
            strokeOpacity={focused ? 1 : 0.8}
          />
          <AreaGlyph area={areaKey} color={KONST.node} />
        </>
      )}

      {node.kind === "entity" && isSceneCenter && (
        <>
          <circle
            r={radius + 8}
            fill="none"
            stroke={node.color}
            strokeWidth={1}
            strokeOpacity={0.3}
          />
          <circle
            r={radius}
            fill={KONST.chrome}
            stroke={node.color}
            strokeWidth={2}
          />
          <circle r={Math.max(2.5, radius / 3.5)} fill={KONST.node} />
        </>
      )}

      {node.kind === "entity" && !isSceneCenter && tint && (
        <>
          <circle
            r={radius}
            fill={KONST.chromeSide}
            stroke={tint}
            strokeWidth={1.2}
            strokeOpacity={0.7}
          />
          <circle r={3} fill={tintDot} />
        </>
      )}

      {node.kind === "entity" && !isSceneCenter && !tint && (
        <>
          {node.status === "review" && (
            <circle
              r={radius + 3.5}
              fill="none"
              stroke={KONST.review}
              strokeWidth={1.1}
              strokeOpacity={0.75}
            />
          )}
          {node.status === "empty" && (
            <circle
              r={radius + 3.5}
              fill="none"
              stroke={KONST.empty}
              strokeWidth={1}
            />
          )}
          <circle
            r={radius}
            fill={focused ? KONST.nodeBright : KONST.node}
            fillOpacity={focused ? 1 : 0.92}
          />
        </>
      )}

      {showLabel && node.kind === "area" && (
        <text
          y={radius + 18}
          textAnchor="middle"
          fill={focused ? KONST.label : KONST.muted}
          style={{ fontSize: 11, letterSpacing: "0.22em" }}
          className="pointer-events-none select-none uppercase"
        >
          {label.length > 22 ? `${label.slice(0, 20)}…` : label}
        </text>
      )}

      {showLabel && node.kind === "entity" && (
        <text
          y={radius + 15}
          textAnchor="middle"
          fill={labelFill}
          style={{ fontSize: 11, letterSpacing: "0.08em" }}
          className="pointer-events-none select-none"
        >
          {label.length > 26 ? `${label.slice(0, 24)}…` : label}
        </text>
      )}

      <circle r={radius + 6} fill="transparent" />

      <foreignObject
        x={-(radius + 8)}
        y={-(radius + 8)}
        width={(radius + 8) * 2}
        height={(radius + 8) * 2}
      >
        <button
          type="button"
          tabIndex={tabIndex}
          aria-label={ariaParts.join(", ")}
          onFocus={onFocus}
          onClick={onClick}
          className="size-full rounded-full opacity-0 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#EFE7CE]/70"
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
  if (kind === "core") return 30;
  if (kind === "area") return 16;
  return 4.5;
}

export { nodeRadius };
