import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { entityEmbeddings } from "@/db/schema";
import { getListEntity } from "@/lib/strategy-hub/entities/registry";
import {
  buildEmbeddingText,
  contentHash,
  indexableEntityTypes,
  registryKeyForType,
} from "./content";
import { embedDocuments, EMBEDDING_MODEL } from "./provider";
import { isEntityTypeKey, type EntityTypeKey } from "@/lib/strategy-hub/entities/entity-types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function fetchEntityRow(
  projectId: string,
  entityType: EntityTypeKey,
  entityId: string
): Promise<Record<string, unknown> | null> {
  const registryKey = registryKeyForType(entityType);
  if (!registryKey) return null;
  const def = getListEntity(registryKey);
  if (!def) return null;
  const items = await def.list(projectId);
  const row = items.find((item) => {
    if (!isRecord(item)) return false;
    return item.id === entityId;
  });
  return row && isRecord(row) ? row : null;
}

export async function reindexEntity(
  projectId: string,
  entityType: string,
  entityId: string
): Promise<{ indexed: boolean; skipped: boolean; attempted: boolean }> {
  if (entityType === "relation") {
    return { indexed: false, skipped: true, attempted: false };
  }

  if (!isEntityTypeKey(entityType)) {
    return { indexed: false, skipped: true, attempted: false };
  }

  const typeKey = entityType;
  const row = await fetchEntityRow(projectId, typeKey, entityId);
  if (!row) return { indexed: false, skipped: true, attempted: false };

  const text = buildEmbeddingText(entityType, row);
  if (!text) return { indexed: false, skipped: true, attempted: false };

  const hash = contentHash(text);

  const [existing] = await db
    .select({ contentHash: entityEmbeddings.contentHash })
    .from(entityEmbeddings)
    .where(
      and(
        eq(entityEmbeddings.entityType, entityType),
        eq(entityEmbeddings.entityId, entityId)
      )
    )
    .limit(1);

  if (existing?.contentHash === hash) {
    return { indexed: false, skipped: true, attempted: false };
  }

  const vectors = await embedDocuments([text]);
  if (!vectors || vectors.length === 0) {
    return { indexed: false, skipped: true, attempted: true };
  }

  const vector = vectors[0];
  await db
    .insert(entityEmbeddings)
    .values({
      entityType,
      entityId,
      projectId,
      contentHash: hash,
      embedding: vector,
      model: EMBEDDING_MODEL,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [entityEmbeddings.entityType, entityEmbeddings.entityId],
      set: {
        contentHash: hash,
        embedding: vector,
        model: EMBEDDING_MODEL,
        updatedAt: new Date(),
      },
    });

  return { indexed: true, skipped: false, attempted: true };
}

export async function reconcileProject(
  projectId: string,
  opts?: { cap?: number; embedCap?: number }
): Promise<{ indexed: number; skipped: number; attempted: number }> {
  const embedCap = opts?.embedCap ?? opts?.cap ?? 200;
  let indexed = 0;
  let skipped = 0;
  let attempted = 0;

  for (const typeKey of indexableEntityTypes()) {
    const registryKey = registryKeyForType(typeKey);
    if (!registryKey) continue;
    const def = getListEntity(registryKey);
    if (!def) continue;

    const items = await def.list(projectId);
    for (const item of items) {
      if (attempted >= embedCap) return { indexed, skipped, attempted };
      if (!isRecord(item) || typeof item.id !== "string") continue;

      const result = await reindexEntity(projectId, typeKey, item.id);
      if (result.attempted) attempted += 1;
      if (result.indexed) indexed += 1;
      else skipped += 1;
    }
  }

  return { indexed, skipped, attempted };
}
