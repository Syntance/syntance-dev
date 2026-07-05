import type { SceneData, ConstellationNode } from "@/lib/strategy-hub/constellation-types";
import {
  computeRadialLayout,
  type LayoutPosition,
} from "./radial-layout";

export type { LayoutPosition };

const COLUMN_X = 300;
const COLUMN_GAP = 72;
const MEMBER_RADIUS = 130;

function stackColumn(
  nodes: { id: string }[],
  x: number,
  positions: Map<string, LayoutPosition>
): void {
  if (nodes.length === 0) return;
  const totalH = (nodes.length - 1) * COLUMN_GAP;
  const startY = -totalH / 2;
  nodes.forEach((node, i) => {
    positions.set(node.id, { x, y: startY + i * COLUMN_GAP, angle: 0 });
  });
}

function memberRadial(
  centerId: string,
  members: { id: string }[],
  positions: Map<string, LayoutPosition>
): void {
  positions.set(centerId, { x: 0, y: 0, angle: 0 });
  if (members.length === 0) return;

  const step = (2 * Math.PI) / members.length;
  members.forEach((member, i) => {
    const angle = i * step - Math.PI / 2;
    positions.set(member.id, {
      x: MEMBER_RADIUS * Math.cos(angle),
      y: MEMBER_RADIUS * Math.sin(angle),
      angle,
    });
  });
}

/** Układ pozycji węzłów (środek świata 0,0 — kamera centruje w viewport). */
export function computeSceneLayout(data: SceneData): Map<string, LayoutPosition> {
  const positions = new Map<string, LayoutPosition>();

  if (data.scene.level === "organism") {
    const layoutNodes = [
      { id: data.center.id, parentId: null as string | null },
      ...data.members.map((m) => ({ id: m.id, parentId: m.parentId })),
    ];
    return computeRadialLayout(layoutNodes, data.areasOrder, 0, 0);
  }

  if (data.scene.level === "area") {
    memberRadial(data.center.id, data.members, positions);
    stackColumn(data.upstream, -COLUMN_X, positions);
    stackColumn(data.downstream, COLUMN_X, positions);
    return positions;
  }

  positions.set(data.center.id, { x: 0, y: 0, angle: 0 });
  stackColumn(data.upstream, -COLUMN_X, positions);
  stackColumn(data.downstream, COLUMN_X, positions);
  return positions;
}

export function allSceneNodes(data: SceneData): ConstellationNode[] {
  const nodes = [data.center, ...data.members, ...data.upstream, ...data.downstream];
  const seen = new Set<string>();
  return nodes.filter((n) => {
    if (seen.has(n.id)) return false;
    seen.add(n.id);
    return true;
  });
}
