"use client";

import { useMemo } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  useNodesState,
  useEdgesState,
  MarkerType,
  type Node,
  type Edge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

export interface ActivityRow {
  id: string;
  channelId: string;
  channelName?: string;
  segmentId?: string | null;
  stage?: string | null;
  weeklyCount?: number | null;
  monthlyBudget?: number | null;
  cadence?: string | null;
  whatToPublishMd?: string | null;
}
export interface ChannelRow {
  id: string;
  name: string;
  icon?: string | null;
}

const STAGES = [
  { key: "TOFU", label: "TOFU — Świadomość", color: "#60a5fa" },
  { key: "MOFU", label: "MOFU — Rozważanie", color: "#a78bfa" },
  { key: "BOFU", label: "BOFU — Decyzja", color: "#34d399" },
  { key: "retention", label: "Retencja", color: "#fbbf24" },
] as const;

const stageColor = (k: string) =>
  STAGES.find((s) => s.key === k)?.color ?? "#94a3b8";

function buildGraph(
  channels: ChannelRow[],
  activities: ActivityRow[]
): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  // Pipeline etapów (poziomy rdzeń lejka)
  STAGES.forEach((s, i) => {
    nodes.push({
      id: `stage-${s.key}`,
      position: { x: i * 260, y: 260 },
      data: { label: s.label },
      type: "default",
      style: {
        background: `${s.color}1a`,
        border: `1px solid ${s.color}66`,
        color: "var(--foreground)",
        borderRadius: 12,
        fontSize: 12,
        fontWeight: 600,
        width: 200,
        padding: 10,
      },
    });
    if (i > 0) {
      edges.push({
        id: `flow-${i}`,
        source: `stage-${STAGES[i - 1].key}`,
        target: `stage-${s.key}`,
        animated: true,
        style: { stroke: "var(--border)", strokeWidth: 2 },
        markerEnd: { type: MarkerType.ArrowClosed },
      });
    }
  });

  // Kanały zasilające etapy
  const usedChannels = channels.filter((c) =>
    activities.some((a) => a.channelId === c.id)
  );
  usedChannels.forEach((c, i) => {
    nodes.push({
      id: `ch-${c.id}`,
      position: { x: i * 200, y: 20 },
      data: { label: `${c.icon ?? "📣"} ${c.name}` },
      type: "default",
      style: {
        background: "var(--card)",
        border: "1px solid var(--border)",
        color: "var(--foreground)",
        borderRadius: 10,
        fontSize: 12,
        width: 170,
        padding: 8,
      },
    });
  });

  // Krawędzie kanał → etap (po unikalnych parach)
  const seen = new Set<string>();
  for (const a of activities) {
    if (!a.stage) continue;
    const key = `${a.channelId}-${a.stage}`;
    if (seen.has(key)) continue;
    seen.add(key);
    edges.push({
      id: `e-${key}`,
      source: `ch-${a.channelId}`,
      target: `stage-${a.stage}`,
      style: { stroke: stageColor(a.stage), strokeWidth: 1.5 },
      markerEnd: { type: MarkerType.ArrowClosed, color: stageColor(a.stage) },
    });
  }

  return { nodes, edges };
}

export default function FunnelFlow({
  channels,
  activities,
}: {
  channels: ChannelRow[];
  activities: ActivityRow[];
}) {
  const initial = useMemo(
    () => buildGraph(channels, activities),
    [channels, activities]
  );
  const [nodes, , onNodesChange] = useNodesState(initial.nodes);
  const [edges, , onEdgesChange] = useEdgesState(initial.edges);

  const hasData = activities.length > 0;

  return (
    <div className="h-[420px] w-full rounded-xl border border-border overflow-hidden bg-card/20">
      {hasData ? (
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          fitView
          proOptions={{ hideAttribution: true }}
          nodesConnectable={false}
        >
          <Background color="var(--border)" gap={20} />
          <Controls showInteractive={false} />
        </ReactFlow>
      ) : (
        <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
          Dodaj aktywności kanałów, aby zobaczyć przepływ lejka.
        </div>
      )}
    </div>
  );
}
