import { hierarchy, tree } from "d3-hierarchy";
import type { StrategyArea } from "@/lib/strategy-hub/entities/entity-types";
import { CORE_NODE_ID } from "@/lib/strategy-hub/constellation-types";

export interface LayoutInputNode {
  id: string;
  parentId: string | null;
}

export interface LayoutPosition {
  x: number;
  y: number;
  angle: number;
}

interface HierarchyDatum {
  id: string;
  children?: HierarchyDatum[];
}

const AREA_RADIUS = 220;
const ENTITY_BASE_RADIUS = 420;
const ENTITY_RING_STEP = 80;

function buildHierarchyData(nodes: LayoutInputNode[]): HierarchyDatum {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const childrenOf = new Map<string | null, LayoutInputNode[]>();

  for (const node of nodes) {
    const parent = node.parentId;
    const list = childrenOf.get(parent) ?? [];
    list.push(node);
    childrenOf.set(parent, list);
  }

  function build(id: string): HierarchyDatum {
    const kids = (childrenOf.get(id) ?? []).map((c) => build(c.id));
    return kids.length > 0 ? { id, children: kids } : { id };
  }

  const root = byId.get(CORE_NODE_ID);
  if (!root) {
    return { id: CORE_NODE_ID, children: [] };
  }
  return build(root.id);
}

function maxDepth(node: HierarchyDatum, depth = 0): number {
  if (!node.children?.length) return depth;
  return Math.max(...node.children.map((c) => maxDepth(c, depth + 1)));
}

/**
 * Układ radialny core → obszary → encje (d3-hierarchy tree + projekcja polarna).
 */
export function computeRadialLayout(
  nodes: LayoutInputNode[],
  areasOrder: StrategyArea[],
  cx: number,
  cy: number
): Map<string, LayoutPosition> {
  const rootData = buildHierarchyData(nodes);
  const depth = maxDepth(rootData);
  const outerRadius =
    depth <= 1
      ? AREA_RADIUS
      : depth === 2
        ? ENTITY_BASE_RADIUS
        : ENTITY_BASE_RADIUS + (depth - 2) * ENTITY_RING_STEP;

  const root = hierarchy(rootData, (d) => d.children ?? []);
  const layout = tree<HierarchyDatum>().size([2 * Math.PI, outerRadius])(root);

  const positions = new Map<string, LayoutPosition>();

  layout.each((node) => {
    const angle = node.x ?? 0;
    const radius = node.y ?? 0;
    positions.set(node.data.id, {
      x: cx + radius * Math.cos(angle - Math.PI / 2),
      y: cy + radius * Math.sin(angle - Math.PI / 2),
      angle,
    });
  });

  // Kąty obszarów rosną zgodnie z areasOrder (sortowanie sektorów).
  const areaAngles = areasOrder.map((_, i) => (i / areasOrder.length) * 2 * Math.PI);
  const areaOrderIndex = new Map(areasOrder.map((a, i) => [`area:${a}`, i]));

  const areaNodes = [...positions.entries()]
    .filter(([id]) => id.startsWith("area:"))
    .sort(([a], [b]) => {
      const ia = areaOrderIndex.get(a) ?? 999;
      const ib = areaOrderIndex.get(b) ?? 999;
      return ia - ib;
    });

  for (let i = 0; i < areaNodes.length; i++) {
    const [id, pos] = areaNodes[i];
    const targetAngle = areaAngles[i] ?? pos.angle;
    const radius = Math.hypot(pos.x - cx, pos.y - cy) || AREA_RADIUS;
    positions.set(id, {
      x: cx + radius * Math.cos(targetAngle - Math.PI / 2),
      y: cy + radius * Math.sin(targetAngle - Math.PI / 2),
      angle: targetAngle,
    });
  }

  return positions;
}

export function maxLayoutRadius(positions: Map<string, LayoutPosition>, cx: number, cy: number): number {
  let max = 0;
  for (const pos of positions.values()) {
    max = Math.max(max, Math.hypot(pos.x - cx, pos.y - cy));
  }
  return max;
}
