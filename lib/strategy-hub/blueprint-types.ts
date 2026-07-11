import {
  ENTITY_TYPE_META,
  type EntityTypeKey,
} from "@/lib/strategy-hub/entities/entity-types";
import type { NodeStatus } from "@/lib/strategy-hub/strategy-map-types";

export interface BlueprintCellItem {
  ref: { type: EntityTypeKey; id: string };
  label: string;
  color: string;
  status?: NodeStatus;
  viaLabel?: string;
}

export type BlueprintRow = "tresci" | "kanaly" | "sprzedaz" | "strona" | "kpi";

export interface BlueprintStageColumn {
  stage: {
    id: string;
    name: string;
    phase: string | null;
    orderIdx: number;
    trigger: string | null;
    questions: string | null;
  };
  cells: Record<BlueprintRow, BlueprintCellItem[]>;
  gaps: BlueprintRow[];
}

export interface BlueprintData {
  segments: {
    id: string;
    name: string;
    icon: string | null;
    priority: number;
  }[];
  selected: {
    id: string;
    name: string;
    personaName: string | null;
    problemSummary: string | null;
  } | null;
  columns: BlueprintStageColumn[];
  gapCount: number;
}

const ROW_AREA: Record<BlueprintRow, string> = {
  tresci: "lejek",
  kanaly: "kanaly",
  sprzedaz: "sprzedaz",
  strona: "strona",
  kpi: "kpi",
};

export function blueprintGapHref(
  projectId: string,
  row: BlueprintRow
): string {
  const area = ROW_AREA[row];
  const sample = Object.values(ENTITY_TYPE_META).find((m) => m.area === area);
  return sample?.href(projectId) ?? ENTITY_TYPE_META.element.href(projectId);
}

export type { EntityTypeKey };
