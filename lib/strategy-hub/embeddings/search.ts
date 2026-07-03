import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { entityEmbeddings } from "@/db/schema";
import {
  ENTITY_TYPE_META,
  entityHref,
  type EntityTypeKey,
} from "@/lib/strategy-hub/entities/entity-types";
import { embedQuery } from "./provider";
import type { EntityRef } from "@/lib/strategy-hub/relations/schemas";

export interface SimilarEntity {
  entityType: EntityTypeKey;
  entityId: string;
  similarity: number;
  label: string;
  color: string;
  href: string;
}

function isEntityTypeKey(t: string): t is EntityTypeKey {
  return t in ENTITY_TYPE_META;
}

function vectorLiteral(vec: number[]): string {
  return `[${vec.join(",")}]`;
}

export async function searchSimilar(
  projectId: string,
  opts: {
    query?: string;
    entityRef?: EntityRef;
    k?: number;
  }
): Promise<SimilarEntity[]> {
  const k = opts.k ?? 8;
  let vec: number[] | null = null;

  if (opts.query) {
    vec = await embedQuery(opts.query);
  } else if (opts.entityRef) {
    const [row] = await db
      .select({ embedding: entityEmbeddings.embedding })
      .from(entityEmbeddings)
      .where(
        and(
          eq(entityEmbeddings.projectId, projectId),
          eq(entityEmbeddings.entityType, opts.entityRef.type),
          eq(entityEmbeddings.entityId, opts.entityRef.id)
        )
      )
      .limit(1);
    if (row?.embedding && Array.isArray(row.embedding)) {
      vec = row.embedding;
    }
  }

  if (!vec) return [];

  const literal = vectorLiteral(vec);
  const vecSql = sql.raw(`'${literal}'::vector`);

  const rows = await db
    .select({
      entityType: entityEmbeddings.entityType,
      entityId: entityEmbeddings.entityId,
      similarity:
        sql<number>`1 - (${entityEmbeddings.embedding} <=> ${vecSql})`.mapWith(
          Number
        ),
    })
    .from(entityEmbeddings)
    .where(eq(entityEmbeddings.projectId, projectId))
    .orderBy(sql`${entityEmbeddings.embedding} <=> ${vecSql}`)
    .limit(k);

  const results: SimilarEntity[] = [];
  for (const row of rows) {
    if (!isEntityTypeKey(row.entityType)) continue;
    results.push({
      entityType: row.entityType,
      entityId: row.entityId,
      similarity: row.similarity,
      label: ENTITY_TYPE_META[row.entityType].label,
      color: ENTITY_TYPE_META[row.entityType].color,
      href: entityHref(projectId, row.entityType),
    });
  }

  return results;
}
