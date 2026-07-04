/**
 * Typy widoku Konstelacji — client-safe (bez server-only).
 */

import type { EntityTypeKey, StrategyArea } from "@/lib/strategy-hub/entities/entity-types";
import type { NodeStatus } from "@/lib/strategy-hub/strategy-map-types";

export type ConstellationNodeKind = "core" | "area" | "entity";

export interface ConstellationNode {
  id: string;
  kind: ConstellationNodeKind;
  entityType?: EntityTypeKey;
  label: string;
  color: string;
  status?: NodeStatus;
  score?: number;
  href?: string;
  parentId: string | null;
  childCount?: number;
}

export interface ConstellationLink {
  id: string;
  sourceId: string;
  targetId: string;
  kind: "tree" | "cross";
  relationLabel?: string;
  aiGenerated?: boolean;
}

export interface ConstellationData {
  nodes: ConstellationNode[];
  links: ConstellationLink[];
  areasOrder: StrategyArea[];
  health: number;
}

export type ConstellationScene =
  | { level: "organism" }
  | { level: "area"; area: StrategyArea }
  | { level: "entity"; ref: { type: EntityTypeKey; id: string } };

export interface CoreSingletons {
  uvpMd: string | null;
  positioningMd: string | null;
}

export interface SceneData {
  scene: ConstellationScene;
  center: ConstellationNode;
  members: ConstellationNode[];
  upstream: ConstellationNode[];
  downstream: ConstellationNode[];
  links: ConstellationLink[];
  breadcrumb: { label: string; scene: ConstellationScene }[];
  areasOrder: StrategyArea[];
  health: number;
  /** Treść singletonów rdzenia — tylko scena organism. */
  singletons?: CoreSingletons;
}

/** Etykiety i kolory 7 modułów makro-mapy (zgodne z ENTITY_TYPE_META obszarów). */
export const AREA_META: Record<
  StrategyArea,
  { label: string; color: string; hrefSegment: string }
> = {
  fundament: { label: "Fundament", color: "#818cf8", hrefSegment: "foundation/business" },
  segmenty: { label: "Segmenty", color: "#38bdf8", hrefSegment: "market/segments" },
  lejek: { label: "Lejek", color: "#34d399", hrefSegment: "execution/funnel" },
  kanaly: { label: "Kanały", color: "#a16207", hrefSegment: "execution/channels" },
  przekaz: { label: "Przekaz", color: "#fb923c", hrefSegment: "execution/copy" },
  strona: { label: "Strona", color: "#475569", hrefSegment: "execution/sites" },
  kpi: { label: "KPI", color: "#f472b6", hrefSegment: "measurement/kpi" },
};

export const CORE_NODE_ID = "core";

export function areaNodeId(area: StrategyArea): string {
  return `area:${area}`;
}

export function entityNodeId(type: EntityTypeKey, id: string): string {
  return `${type}:${id}`;
}

export function parseEntityNodeId(
  nodeId: string
): { type: EntityTypeKey; id: string } | null {
  const idx = nodeId.indexOf(":");
  if (idx <= 0) return null;
  const type = nodeId.slice(0, idx);
  const id = nodeId.slice(idx + 1);
  if (!type || !id) return null;
  return { type: type as EntityTypeKey, id };
}
