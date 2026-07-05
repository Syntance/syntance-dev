import {
  isEntityTypeKey,
  type EntityTypeKey,
} from "@/lib/strategy-hub/entities/entity-types";

export interface ThreadNode {
  ref: { type: EntityTypeKey; id: string };
  label: string;
  color: string;
  typeLabel: string;
  isFocus: boolean;
  href?: string;
}

export interface ThreadDecision {
  id: string;
  title: string;
  reasonMd: string | null;
  createdAt: string;
}

export interface ThreadEdge {
  from: number;
  to: number;
  relationLabel: string;
  decisions: ThreadDecision[];
  rationaleMd?: string;
}

export interface ThreadData {
  nodes: ThreadNode[];
  edges: ThreadEdge[];
  segmentId: string | null;
  segments: { id: string; name: string }[];
}

export interface EntityRef {
  type: EntityTypeKey;
  id: string;
}

export function parseThreadParam(raw: string | null): EntityRef | null {
  if (!raw) return null;
  const idx = raw.indexOf(":");
  if (idx <= 0) return null;
  const type = raw.slice(0, idx);
  const id = raw.slice(idx + 1);
  if (!isEntityTypeKey(type)) return null;
  return { type, id };
}

export function threadParamFromRef(ref: EntityRef): string {
  return `${ref.type}:${ref.id}`;
}
