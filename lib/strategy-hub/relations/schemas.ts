import { z } from "zod";
import {
  ENTITY_TYPE_META,
  RELATION_TYPES,
  type EntityTypeKey,
  type RelationTypeKey,
} from "@/lib/strategy-hub/entities/entity-types";

const entityTypeKeys = Object.keys(ENTITY_TYPE_META) as [
  EntityTypeKey,
  ...EntityTypeKey[],
];

export const entityRefSchema = z.object({
  type: z.enum(entityTypeKeys),
  id: z.string().uuid(),
});

export type EntityRef = z.infer<typeof entityRefSchema>;

const relationTypeKeys = Object.keys(RELATION_TYPES) as [
  RelationTypeKey,
  ...RelationTypeKey[],
];

export const relationCreateSchema = z.object({
  source: entityRefSchema,
  target: entityRefSchema,
  relationType: z.union([z.enum(relationTypeKeys), z.string().min(1).max(50)]),
  strength: z.number().min(0).max(1).nullable().optional(),
  rationaleMd: z.string().max(4000).nullable().optional(),
  pathId: z.string().uuid().nullable().optional(),
});

export type RelationCreate = z.infer<typeof relationCreateSchema>;

export const relationPatchSchema = relationCreateSchema
  .pick({ relationType: true, strength: true, rationaleMd: true })
  .partial();

export type RelationPatch = z.infer<typeof relationPatchSchema>;

export const relationListQuerySchema = z.object({
  entityType: z.enum(entityTypeKeys).optional(),
  entityId: z.string().uuid().optional(),
  source: z.enum(["human", "ai"]).optional(),
  type: z.string().optional(),
});

export interface RelationRow {
  id: string;
  projectId: string;
  pathId: string | null;
  sourceType: EntityTypeKey;
  sourceId: string;
  targetType: EntityTypeKey;
  targetId: string;
  relationType: string;
  strength: number | null;
  rationaleMd: string | null;
  source: "human" | "ai";
  confidence: number | null;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}
