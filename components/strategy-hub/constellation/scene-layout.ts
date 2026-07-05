import type { SceneData, ConstellationNode } from "@/lib/strategy-hub/constellation-types";
import { areaNodeId } from "@/lib/strategy-hub/constellation-types";
import type { LayoutPosition } from "./radial-layout";
import { seededRandom } from "./constellation-theme";

export type { LayoutPosition };

const AREA_RING_RADIUS = 250;
const SCATTER_MIN = 310;
const SCATTER_SPREAD = 190;

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
    // Rozsiane w przestrzeni: rdzeń w centrum, 7 obszarów na pierścieniu,
    // encje jako luźna chmura punktów w sektorze swojego obszaru (seed = id węzła).
    positions.set(data.center.id, { x: 0, y: 0, angle: 0 });

    const sector = (2 * Math.PI) / Math.max(1, data.areasOrder.length);
    const areaAngle = new Map<string, number>();
    data.areasOrder.forEach((area, i) => {
      const angle = i * sector - Math.PI / 2;
      const id = areaNodeId(area);
      areaAngle.set(id, angle);
      positions.set(id, {
        x: AREA_RING_RADIUS * Math.cos(angle),
        y: AREA_RING_RADIUS * Math.sin(angle),
        angle,
      });
    });

    const byId = new Map(data.members.map((m) => [m.id, m]));
    const resolveArea = (node: ConstellationNode): string | null => {
      let cur: ConstellationNode | undefined = node;
      for (let hop = 0; cur && hop < 6; hop++) {
        if (!cur.parentId) return null;
        if (cur.parentId.startsWith("area:")) return cur.parentId;
        cur = byId.get(cur.parentId);
      }
      return null;
    };

    for (const member of data.members) {
      if (positions.has(member.id)) continue;
      const rand = seededRandom(`scatter:${member.id}`);
      const anchor = resolveArea(member);
      const baseAngle = anchor != null ? (areaAngle.get(anchor) ?? 0) : rand() * 2 * Math.PI;
      const jitter = anchor != null ? (rand() - 0.5) * sector * 0.88 : 0;
      const angle = baseAngle + jitter;
      const radius = SCATTER_MIN + Math.pow(rand(), 0.85) * SCATTER_SPREAD;
      positions.set(member.id, {
        x: radius * Math.cos(angle),
        y: radius * Math.sin(angle),
        angle,
      });
    }
    return positions;
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
