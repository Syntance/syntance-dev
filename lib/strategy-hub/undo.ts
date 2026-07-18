import "server-only";
import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { changeHistory } from "@/db/schema";
import {
  ENTITY_TYPE_META,
  type EntityTypeKey,
} from "@/lib/strategy-hub/entities/entity-types";
import { getListEntity } from "@/lib/strategy-hub/entities/registry";
import {
  restoreRelation,
  softDeleteRelation,
  updateRelation,
} from "@/lib/strategy-hub/relations/store";
import { trackChange } from "@/lib/strategy-hub/track-change";

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function registryKeyForEntityType(entityType: string): string | null {
  if (entityType in ENTITY_TYPE_META) {
    return ENTITY_TYPE_META[entityType as EntityTypeKey].registryKey;
  }
  return null;
}

function readBeforeValue(beforeJson: unknown): unknown {
  if (!isRecord(beforeJson)) return undefined;
  if ("value" in beforeJson) return beforeJson.value;
  return beforeJson;
}

async function undoEntityEntry(
  projectId: string,
  entityType: string,
  entityId: string,
  field: string,
  beforeJson: unknown
): Promise<boolean> {
  if (field === "__created") {
    const key = registryKeyForEntityType(entityType);
    const def = key ? getListEntity(key) : undefined;
    if (def) return def.softDelete(projectId, entityId);
    return false;
  }

  if (field === "__deleted") {
    const key = registryKeyForEntityType(entityType);
    const def = key ? getListEntity(key) : undefined;
    if (def?.restore) return def.restore(projectId, entityId);
    return false;
  }

  const key = registryKeyForEntityType(entityType);
  const def = key ? getListEntity(key) : undefined;
  if (!def) return false;

  const patch: Record<string, unknown> = {
    [field]: readBeforeValue(beforeJson),
  };
  const parsed = def.patchSchema.safeParse(patch);
  if (!parsed.success) return false;

  const updated = await def.update(projectId, entityId, parsed.data);
  return Boolean(updated);
}

async function undoRelationEntry(
  projectId: string,
  relationId: string,
  field: string,
  beforeJson: unknown
): Promise<boolean> {
  if (field === "__created") {
    return softDeleteRelation(projectId, relationId, { source: "undo" });
  }
  if (field === "__deleted") {
    return restoreRelation(projectId, relationId);
  }

  const value = readBeforeValue(beforeJson);
  const allowed = ["relationType", "strength", "rationaleMd"] as const;
  if (!allowed.includes(field as (typeof allowed)[number])) return false;

  const updated = await updateRelation(
    projectId,
    relationId,
    { [field]: value } as {
      relationType?: string;
      strength?: number | null;
      rationaleMd?: string | null;
    },
    { source: "undo" }
  );
  return Boolean(updated);
}

/**
 * Cofa wszystkie zmiany w batchu (last-write-wins).
 */
export async function undoBatch(
  projectId: string,
  batchId: string,
  userId: string | null
): Promise<{ undone: number }> {
  const rows = await db
    .select()
    .from(changeHistory)
    .where(
      and(
        eq(changeHistory.projectId, projectId),
        eq(changeHistory.batchId, batchId),
        isNull(changeHistory.undoneAt)
      )
    )
    .orderBy(desc(changeHistory.createdAt));

  if (rows.length === 0) return { undone: 0 };

  const grouped = new Map<string, typeof rows>();
  for (const row of rows) {
    if (!row.entityId) continue;
    const key = `${row.entityType}:${row.entityId}`;
    const list = grouped.get(key) ?? [];
    list.push(row);
    grouped.set(key, list);
  }

  let undone = 0;

  for (const [, entries] of grouped) {
    const sorted = [...entries].sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
    );
    for (const entry of sorted) {
      if (!entry.entityId || !entry.field) continue;
      const ok =
        entry.entityType === "relation"
          ? await undoRelationEntry(
              projectId,
              entry.entityId,
              entry.field,
              entry.beforeJson
            )
          : await undoEntityEntry(
              projectId,
              entry.entityType,
              entry.entityId,
              entry.field,
              entry.beforeJson
            );
      if (ok) undone += 1;
    }
  }

  await db
    .update(changeHistory)
    .set({ undoneAt: new Date() })
    .where(
      and(
        eq(changeHistory.projectId, projectId),
        eq(changeHistory.batchId, batchId),
        isNull(changeHistory.undoneAt)
      )
    );

  await trackChange({
    projectId,
    entityType: "batch",
    entityId: batchId,
    patch: { undone: true, count: undone },
    source: "undo",
    userId,
    batchId,
  });

  return { undone };
}