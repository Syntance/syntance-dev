import "server-only";
import { db } from "@/db";
import { changeHistory } from "@/db/schema";
import { ENTITY_TYPE_META } from "@/lib/strategy-hub/entities/entity-types";
import { reindexEntity } from "@/lib/strategy-hub/embeddings/indexer";
import { after } from "next/server";

/** Typy spoza katalogu ENTITY_TYPE_META — lokalny fallback (registry). */
const REGISTRY_FALLBACK: Record<string, string> = {};

/** Zwraca `entityType` (l. poj.) dla klucza encji z registry. */
export function entityTypeFor(entityKey: string): string {
  for (const [typeKey, meta] of Object.entries(ENTITY_TYPE_META)) {
    if (meta.registryKey === entityKey) return typeKey;
  }
  return REGISTRY_FALLBACK[entityKey] ?? entityKey;
}

/** Pola czysto techniczne — nie zapisujemy ich do historii. */
const IGNORED_FIELDS = new Set(["updatedAt", "createdAt", "orderIdx"]);
const MAX_FIELDS = 12;

function serializeValue(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function beforeJsonFor(field: string, before: Record<string, unknown> | undefined) {
  if (!before || !(field in before)) return null;
  return { value: before[field] ?? null };
}

/**
 * Zapisuje wpisy audytu (jeden na zmienione pole) do `change_history`.
 * Cicho ignoruje błędy — audyt nie może wywrócić właściwego zapisu encji.
 */
export async function trackChange(params: {
  projectId: string | null | undefined;
  entityType: string;
  entityId: string;
  patch: Record<string, unknown>;
  source?: string;
  userId?: string | null;
  before?: Record<string, unknown>;
  batchId?: string;
}): Promise<void> {
  const {
    projectId,
    entityType,
    entityId,
    patch,
    source = "hub",
    userId = null,
    before,
    batchId,
  } = params;

  if (!projectId) return;

  const fields = Object.entries(patch)
    .filter(([key, value]) => !IGNORED_FIELDS.has(key) && value !== undefined)
    .slice(0, MAX_FIELDS);

  if (fields.length === 0) return;

  try {
    await db.insert(changeHistory).values(
      fields.map(([field, value]) => ({
        projectId,
        entityType,
        entityId,
        field,
        oldValue: before ? serializeValue(before[field]) : null,
        newValue: serializeValue(value),
        beforeJson: beforeJsonFor(field, before),
        batchId: batchId ?? null,
        source,
        userId,
      }))
    );

    if (entityType !== "relation") {
      const scheduleReindex = () => {
        void reindexEntity(projectId, entityType, entityId).catch(() => {});
      };
      try {
        after(scheduleReindex);
      } catch {
        scheduleReindex();
      }
    }
  } catch (err) {
    console.error("trackChange failed", err);
  }
}
