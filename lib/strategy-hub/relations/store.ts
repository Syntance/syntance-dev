import "server-only";
import { and, eq, isNull, or } from "drizzle-orm";
import { db } from "@/db";
import { entityRelations } from "@/db/schema";
import { trackChange } from "@/lib/strategy-hub/track-change";
import {
  ENTITY_TYPE_META,
  type EntityTypeKey,
  type StrategyArea,
} from "@/lib/strategy-hub/entities/entity-types";
import type {
  EntityRef,
  RelationCreate,
  RelationPatch,
  RelationRow,
} from "./schemas";

function isEntityTypeKey(t: string): t is EntityTypeKey {
  return t in ENTITY_TYPE_META;
}

function parseEntityTypeKey(t: string): EntityTypeKey {
  if (!isEntityTypeKey(t)) {
    throw new Error(`Nieznany typ encji w DB: ${t}`);
  }
  return t;
}

function parseRelationSource(s: string): "human" | "ai" {
  if (s === "human" || s === "ai") return s;
  return "human";
}

function rowFromDb(r: typeof entityRelations.$inferSelect): RelationRow {
  return {
    id: r.id,
    projectId: r.projectId,
    pathId: r.pathId,
    sourceType: parseEntityTypeKey(r.sourceType),
    sourceId: r.sourceId,
    targetType: parseEntityTypeKey(r.targetType),
    targetId: r.targetId,
    relationType: r.relationType,
    strength: r.strength,
    rationaleMd: r.rationaleMd,
    source: parseRelationSource(r.source),
    confidence: r.confidence,
    createdBy: r.createdBy,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    deletedAt: r.deletedAt,
  };
}

function validateEntityRef(ref: EntityRef): void {
  if (!isEntityTypeKey(ref.type)) {
    throw new Error(`Nieznany typ encji: ${ref.type}`);
  }
}

function sameRef(a: EntityRef, b: EntityRef): boolean {
  return a.type === b.type && a.id === b.id;
}

async function findActiveDuplicate(
  projectId: string,
  data: RelationCreate
): Promise<RelationRow | undefined> {
  const [existing] = await db
    .select()
    .from(entityRelations)
    .where(
      and(
        eq(entityRelations.projectId, projectId),
        eq(entityRelations.sourceType, data.source.type),
        eq(entityRelations.sourceId, data.source.id),
        eq(entityRelations.targetType, data.target.type),
        eq(entityRelations.targetId, data.target.id),
        eq(entityRelations.relationType, data.relationType),
        isNull(entityRelations.deletedAt)
      )
    )
    .limit(1);
  return existing ? rowFromDb(existing) : undefined;
}

export async function listRelations(
  projectId: string,
  filters?: {
    type?: string;
    source?: "human" | "ai";
    entity?: EntityRef;
  }
): Promise<RelationRow[]> {
  const conditions = [
    eq(entityRelations.projectId, projectId),
    isNull(entityRelations.deletedAt),
  ];

  if (filters?.type) {
    conditions.push(eq(entityRelations.relationType, filters.type));
  }
  if (filters?.source) {
    conditions.push(eq(entityRelations.source, filters.source));
  }
  if (filters?.entity) {
    const e = filters.entity;
    conditions.push(
      or(
        and(
          eq(entityRelations.sourceType, e.type),
          eq(entityRelations.sourceId, e.id)
        ),
        and(
          eq(entityRelations.targetType, e.type),
          eq(entityRelations.targetId, e.id)
        )
      )!
    );
  }

  const rows = await db
    .select()
    .from(entityRelations)
    .where(and(...conditions));

  return rows.map(rowFromDb);
}

export async function createRelation(
  projectId: string,
  data: RelationCreate,
  opts: {
    source: "human" | "ai";
    confidence?: number;
    userId?: string | null;
    batchId?: string;
  }
): Promise<RelationRow> {
  validateEntityRef(data.source);
  validateEntityRef(data.target);

  if (sameRef(data.source, data.target)) {
    throw new Error("Relacja nie może łączyć encji samej ze sobą");
  }

  const duplicate = await findActiveDuplicate(projectId, data);
  if (duplicate) return duplicate;

  const now = new Date();
  const [inserted] = await db
    .insert(entityRelations)
    .values({
      projectId,
      pathId: data.pathId ?? null,
      sourceType: data.source.type,
      sourceId: data.source.id,
      targetType: data.target.type,
      targetId: data.target.id,
      relationType: data.relationType,
      strength: data.strength ?? null,
      rationaleMd: data.rationaleMd ?? null,
      source: opts.source,
      confidence: opts.confidence ?? null,
      createdBy: opts.userId ?? null,
      updatedAt: now,
    })
    .returning();

  if (!inserted) throw new Error("Nie udało się utworzyć relacji");

  const row = rowFromDb(inserted);
  await trackChange({
    projectId,
    entityType: "relation",
    entityId: row.id,
    patch: {
      __created: true,
      sourceType: row.sourceType,
      sourceId: row.sourceId,
      targetType: row.targetType,
      targetId: row.targetId,
      relationType: row.relationType,
    },
    source: opts.source,
    userId: opts.userId ?? null,
    batchId: opts.batchId,
  });

  return row;
}

export async function updateRelation(
  projectId: string,
  relationId: string,
  patch: RelationPatch,
  opts: { userId?: string | null; batchId?: string; source?: string }
): Promise<RelationRow | undefined> {
  const [existing] = await db
    .select()
    .from(entityRelations)
    .where(
      and(
        eq(entityRelations.id, relationId),
        eq(entityRelations.projectId, projectId),
        isNull(entityRelations.deletedAt)
      )
    )
    .limit(1);

  if (!existing) return undefined;

  const updates: Partial<typeof entityRelations.$inferInsert> = {
    updatedAt: new Date(),
  };

  if (patch.relationType !== undefined) {
    updates.relationType = patch.relationType;
  }
  if (patch.strength !== undefined) {
    updates.strength = patch.strength;
  }
  if (patch.rationaleMd !== undefined) {
    updates.rationaleMd = patch.rationaleMd;
  }

  const [updated] = await db
    .update(entityRelations)
    .set(updates)
    .where(eq(entityRelations.id, relationId))
    .returning();

  if (!updated) return undefined;

  await trackChange({
    projectId,
    entityType: "relation",
    entityId: relationId,
    patch: { ...patch },
    source: opts.source ?? "hub",
    userId: opts.userId ?? null,
  });

  return rowFromDb(updated);
}

export async function softDeleteRelation(
  projectId: string,
  relationId: string,
  opts: { userId?: string | null; batchId?: string; source?: string }
): Promise<boolean> {
  const [existing] = await db
    .select()
    .from(entityRelations)
    .where(
      and(
        eq(entityRelations.id, relationId),
        eq(entityRelations.projectId, projectId),
        isNull(entityRelations.deletedAt)
      )
    )
    .limit(1);

  if (!existing) return false;

  await db
    .update(entityRelations)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(eq(entityRelations.id, relationId));

  await trackChange({
    projectId,
    entityType: "relation",
    entityId: relationId,
    patch: { __deleted: true },
    source: opts.source ?? "hub",
    userId: opts.userId ?? null,
  });

  return true;
}

/** Przywraca soft-deleted relację (undo). */
export async function restoreRelation(
  projectId: string,
  relationId: string
): Promise<boolean> {
  const [existing] = await db
    .select()
    .from(entityRelations)
    .where(
      and(
        eq(entityRelations.id, relationId),
        eq(entityRelations.projectId, projectId)
      )
    )
    .limit(1);

  if (!existing || !existing.deletedAt) return false;

  await db
    .update(entityRelations)
    .set({ deletedAt: null, updatedAt: new Date() })
    .where(eq(entityRelations.id, relationId));

  return true;
}

interface Adjacency {
  neighbors: Map<string, Set<string>>;
  relations: RelationRow[];
}

function refKey(ref: EntityRef): string {
  return `${ref.type}:${ref.id}`;
}

function parseRefKey(key: string): EntityRef | null {
  const idx = key.indexOf(":");
  if (idx <= 0) return null;
  const type = key.slice(0, idx);
  const id = key.slice(idx + 1);
  if (!isEntityTypeKey(type)) return null;
  return { type, id };
}

function buildAdjacency(relations: RelationRow[]): Adjacency {
  const neighbors = new Map<string, Set<string>>();
  const addNeighbor = (from: string, to: string) => {
    let set = neighbors.get(from);
    if (!set) {
      set = new Set();
      neighbors.set(from, set);
    }
    set.add(to);
  };

  for (const r of relations) {
    const sk = refKey({ type: r.sourceType, id: r.sourceId });
    const tk = refKey({ type: r.targetType, id: r.targetId });
    addNeighbor(sk, tk);
    addNeighbor(tk, sk);
  }

  return { neighbors, relations };
}

export async function getNeighbors(
  projectId: string,
  ref: EntityRef,
  depth: 1 | 2 = 1
): Promise<{ nodes: EntityRef[]; relations: RelationRow[] }> {
  const allRelations = await listRelations(projectId);
  const { neighbors } = buildAdjacency(allRelations);
  const start = refKey(ref);
  const visited = new Set<string>([start]);
  const frontier = [start];
  const includedRelations = new Set<string>();

  for (let d = 0; d < depth; d++) {
    const next: string[] = [];
    for (const node of frontier) {
      const nbs = neighbors.get(node);
      if (!nbs) continue;
      for (const nb of nbs) {
        for (const r of allRelations) {
          const sk = refKey({ type: r.sourceType, id: r.sourceId });
          const tk = refKey({ type: r.targetType, id: r.targetId });
          if (
            (sk === node && tk === nb) ||
            (sk === nb && tk === node)
          ) {
            includedRelations.add(r.id);
          }
        }
        if (!visited.has(nb)) {
          visited.add(nb);
          next.push(nb);
        }
      }
    }
    frontier.length = 0;
    frontier.push(...next);
  }

  visited.delete(start);
  const nodes: EntityRef[] = [];
  for (const key of visited) {
    const parsed = parseRefKey(key);
    if (parsed) nodes.push(parsed);
  }

  const relations = allRelations.filter((r) => includedRelations.has(r.id));
  return { nodes, relations };
}

export async function findPath(
  projectId: string,
  a: EntityRef,
  b: EntityRef,
  maxDepth = 4
): Promise<RelationRow[] | null> {
  const allRelations = await listRelations(projectId);
  const { neighbors } = buildAdjacency(allRelations);
  const start = refKey(a);
  const goal = refKey(b);

  if (start === goal) return [];

  const queue: { key: string; path: RelationRow[]; depth: number }[] = [
    { key: start, path: [], depth: 0 },
  ];
  const visited = new Set<string>([start]);

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current.depth >= maxDepth) continue;

    const nbs = neighbors.get(current.key);
    if (!nbs) continue;

    for (const nb of nbs) {
      const edge = allRelations.find((r) => {
        const sk = refKey({ type: r.sourceType, id: r.sourceId });
        const tk = refKey({ type: r.targetType, id: r.targetId });
        return (
          (sk === current.key && tk === nb) ||
          (sk === nb && tk === current.key)
        );
      });
      if (!edge) continue;

      const newPath = [...current.path, edge];
      if (nb === goal) return newPath;

      if (!visited.has(nb)) {
        visited.add(nb);
        queue.push({ key: nb, path: newPath, depth: current.depth + 1 });
      }
    }
  }

  return null;
}

export async function getSubgraph(
  projectId: string,
  scope: { area?: StrategyArea; refs?: EntityRef[] }
): Promise<{ relations: RelationRow[] }> {
  let relations = await listRelations(projectId);

  if (scope.area) {
    const typesInArea = new Set(
      Object.entries(ENTITY_TYPE_META)
        .filter(([, m]) => m.area === scope.area)
        .map(([k]) => k)
    );
    relations = relations.filter(
      (r) => typesInArea.has(r.sourceType) || typesInArea.has(r.targetType)
    );
  }

  if (scope.refs && scope.refs.length > 0) {
    const refSet = new Set(scope.refs.map(refKey));
    relations = relations.filter((r) => {
      const sk = refKey({ type: r.sourceType, id: r.sourceId });
      const tk = refKey({ type: r.targetType, id: r.targetId });
      return refSet.has(sk) || refSet.has(tk);
    });
  }

  return { relations };
}

/** Relacje projektu pogrupowane po typie (dla grafów UI). */
export async function listProjectRelationsByType(
  projectId: string,
  relationTypes: string[]
): Promise<RelationRow[]> {
  const all = await listRelations(projectId);
  const typeSet = new Set(relationTypes);
  return all.filter((r) => typeSet.has(r.relationType));
}

export { type EntityRef, type RelationRow };
