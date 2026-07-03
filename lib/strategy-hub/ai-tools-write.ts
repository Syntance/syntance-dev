import "server-only";
import { tool, type ToolSet } from "ai";
import { z } from "zod";
import {
  getListEntity,
  getSingletonEntity,
  listEntityKeys,
  singletonEntityKeys,
} from "@/lib/strategy-hub/entities/registry";
import { entityTypeFor, trackChange } from "@/lib/strategy-hub/track-change";
import {
  createRelation,
  softDeleteRelation,
  updateRelation,
} from "@/lib/strategy-hub/relations/store";
import { relationCreateSchema } from "@/lib/strategy-hub/relations/schemas";
import { RELATION_TYPES } from "@/lib/strategy-hub/entities/entity-types";

const entityKeyEnum = z.enum(
  listEntityKeys() as [string, ...string[]]
);
const singletonKeyEnum = z.enum(
  singletonEntityKeys() as [string, ...string[]]
);
const relationTypeKeys = Object.keys(RELATION_TYPES) as [string, ...string[]];

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export interface WriteToolsOptions {
  batchId: string;
  source: "ai";
  userId: string | null;
}

export function buildWriteTools(
  projectId: string,
  opts: WriteToolsOptions
): ToolSet {
  const { batchId, source, userId } = opts;

  return {
    create_entity: tool({
      description:
        "Tworzy nową encję w rejestrze Strategy Hub (segment, KPI, obiekcja itd.).",
      parameters: z.object({
        entityKey: entityKeyEnum,
        data: z.record(z.string(), z.unknown()),
      }),
      execute: async ({ entityKey, data }) => {
        const def = getListEntity(entityKey);
        if (!def) return { error: "Nieznany typ encji" };

        const parsed = def.createSchema.safeParse(data);
        if (!parsed.success) {
          return { error: "Walidacja nie przeszła", details: parsed.error.flatten() };
        }

        const row = await def.create(projectId, parsed.data);
        const itemId = isRecord(row) && typeof row.id === "string" ? row.id : null;
        if (!itemId) return { error: "Nie udało się utworzyć encji" };

        await trackChange({
          projectId,
          entityType: entityTypeFor(entityKey),
          entityId: itemId,
          patch: { __created: true, ...(parsed.data as Record<string, unknown>) },
          source,
          userId,
          batchId,
        });

        return { ok: true, entityKey, itemId, item: row };
      },
    }) as ToolSet[string],

    update_entity: tool({
      description: "Aktualizuje istniejącą encję listową.",
      parameters: z.object({
        entityKey: entityKeyEnum,
        itemId: z.string().uuid(),
        data: z.record(z.string(), z.unknown()),
      }),
      execute: async ({ entityKey, itemId, data }) => {
        const def = getListEntity(entityKey);
        if (!def) return { error: "Nieznany typ encji" };

        const parsed = def.patchSchema.safeParse(data);
        if (!parsed.success) {
          return { error: "Walidacja nie przeszła", details: parsed.error.flatten() };
        }

        const patchData = parsed.data as Record<string, unknown>;
        const beforeRow = def.get
          ? await def.get(projectId, itemId)
          : (await def.list(projectId)).find((r) => r.id === itemId);
        const before =
          beforeRow && isRecord(beforeRow)
            ? Object.fromEntries(
                Object.keys(patchData).map((k) => [k, beforeRow[k]])
              )
            : undefined;

        const row = await def.update(projectId, itemId, parsed.data);
        if (!row) return { error: "Encja nie istnieje" };

        await trackChange({
          projectId,
          entityType: entityTypeFor(entityKey),
          entityId: itemId,
          patch: patchData,
          before,
          source,
          userId,
          batchId,
        });

        return { ok: true, item: row };
      },
    }) as ToolSet[string],

    delete_entity: tool({
      description: "Soft-delete encji listowej.",
      parameters: z.object({
        entityKey: entityKeyEnum,
        itemId: z.string().uuid(),
      }),
      execute: async ({ entityKey, itemId }) => {
        const def = getListEntity(entityKey);
        if (!def) return { error: "Nieznany typ encji" };

        const ok = await def.softDelete(projectId, itemId);
        if (!ok) return { error: "Encja nie istnieje" };

        await trackChange({
          projectId,
          entityType: entityTypeFor(entityKey),
          entityId: itemId,
          patch: { __deleted: true },
          source,
          userId,
          batchId,
        });

        return { ok: true };
      },
    }) as ToolSet[string],

    update_singleton: tool({
      description: "Aktualizuje encję singleton (np. brand-identity, uvp).",
      parameters: z.object({
        entityKey: singletonKeyEnum,
        data: z.record(z.string(), z.unknown()),
      }),
      execute: async ({ entityKey, data }) => {
        const def = getSingletonEntity(entityKey);
        if (!def) return { error: "Nieznany singleton" };

        const parsed = def.patchSchema.safeParse(data);
        if (!parsed.success) {
          return { error: "Walidacja nie przeszła", details: parsed.error.flatten() };
        }

        const beforeRow = await def.get(projectId);
        const patchData = parsed.data as Record<string, unknown>;
        const before =
          beforeRow && isRecord(beforeRow)
            ? Object.fromEntries(
                Object.keys(patchData).map((k) => [k, beforeRow[k]])
              )
            : undefined;

        const row = await def.upsert(projectId, parsed.data);

        await trackChange({
          projectId,
          entityType: entityKey,
          entityId: projectId,
          patch: patchData,
          before,
          source,
          userId,
          batchId,
        });

        return { ok: true, item: row };
      },
    }) as ToolSet[string],

    create_relation: tool({
      description: "Tworzy relację semantyczną między dwoma encjami.",
      parameters: z.object({
        sourceType: z.string(),
        sourceId: z.string().uuid(),
        targetType: z.string(),
        targetId: z.string().uuid(),
        relationType: z.enum(relationTypeKeys),
        rationaleMd: z.string().min(10).max(4000),
        confidence: z.number().min(0).max(1),
        strength: z.number().min(0).max(1).nullable().optional(),
      }),
      execute: async (params) => {
        const body = relationCreateSchema.safeParse({
          source: { type: params.sourceType, id: params.sourceId },
          target: { type: params.targetType, id: params.targetId },
          relationType: params.relationType,
          strength: params.strength ?? null,
          rationaleMd: params.rationaleMd,
        });
        if (!body.success) {
          return { error: "Walidacja relacji", details: body.error.flatten() };
        }

        const row = await createRelation(projectId, body.data, {
          source: "ai",
          confidence: params.confidence,
          userId,
          batchId,
        });

        await trackChange({
          projectId,
          entityType: "relation",
          entityId: row.id,
          patch: { __created: true },
          source,
          userId,
          batchId,
        });

        return { ok: true, relation: row };
      },
    }) as ToolSet[string],

    update_relation: tool({
      description: "Aktualizuje relację semantyczną.",
      parameters: z.object({
        relationId: z.string().uuid(),
        relationType: z.string().optional(),
        strength: z.number().min(0).max(1).nullable().optional(),
        rationaleMd: z.string().max(4000).nullable().optional(),
      }),
      execute: async ({ relationId, ...patch }) => {
        const row = await updateRelation(projectId, relationId, patch, {
          source,
          userId,
          batchId,
        });
        if (!row) return { error: "Relacja nie istnieje" };
        return { ok: true, relation: row };
      },
    }) as ToolSet[string],

    delete_relation: tool({
      description: "Usuwa (soft) relację semantyczną.",
      parameters: z.object({
        relationId: z.string().uuid(),
      }),
      execute: async ({ relationId }) => {
        const ok = await softDeleteRelation(projectId, relationId, {
          source,
          userId,
          batchId,
        });
        if (!ok) return { error: "Relacja nie istnieje" };
        return { ok: true };
      },
    }) as ToolSet[string],
  };
}

