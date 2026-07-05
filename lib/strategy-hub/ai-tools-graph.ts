import "server-only";
import { tool, type ToolSet } from "ai";
import { z } from "zod";
import {
  ENTITY_TYPE_META,
  isEntityTypeKey,
  relationLabel,
  type EntityTypeKey,
  type StrategyArea,
} from "@/lib/strategy-hub/entities/entity-types";
import { searchSimilar } from "@/lib/strategy-hub/embeddings/search";
import { getListEntity } from "@/lib/strategy-hub/entities/registry";
import {
  findPath,
  getNeighbors,
  getSubgraph,
  type RelationRow,
} from "@/lib/strategy-hub/relations/store";
import {
  entityRefSchema,
  type EntityRef,
} from "@/lib/strategy-hub/relations/schemas";

const entityTypeKeys = Object.keys(ENTITY_TYPE_META) as [
  EntityTypeKey,
  ...EntityTypeKey[],
];

const entityRefInput = z.object({
  type: z.enum(entityTypeKeys),
  id: z.string().uuid(),
});

const strategyAreas = [
  "fundament",
  "segmenty",
  "lejek",
  "kanaly",
  "przekaz",
  "strona",
  "kpi",
] as const satisfies readonly StrategyArea[];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readLabel(row: Record<string, unknown>): string {
  const candidates = ["name", "title", "phrase", "objectionMd", "question"];
  for (const key of candidates) {
    const v = row[key];
    if (typeof v === "string" && v.trim()) {
      return v.trim().length > 80 ? `${v.trim().slice(0, 80)}…` : v.trim();
    }
  }
  return "Encja";
}

async function entityDisplayName(
  projectId: string,
  ref: EntityRef
): Promise<string> {
  const meta = ENTITY_TYPE_META[ref.type];
  const registryKey = meta.registryKey;
  if (registryKey) {
    const def = getListEntity(registryKey);
    if (def?.get) {
      const row = await def.get(projectId, ref.id);
      if (isRecord(row)) return readLabel(row);
    }
  }
  return meta.label;
}

function enrichRef(
  projectId: string,
  ref: EntityRef,
  label: string
): EntityRef & { label: string; color: string; href: string } {
  const meta = ENTITY_TYPE_META[ref.type];
  return {
    ...ref,
    label,
    color: meta.color,
    href: meta.href(projectId, ref.id),
  };
}

async function enrichRefs(
  projectId: string,
  refs: EntityRef[]
): Promise<Array<EntityRef & { label: string; color: string; href: string }>> {
  return Promise.all(
    refs.map(async (ref) => enrichRef(projectId, ref, await entityDisplayName(projectId, ref)))
  );
}

function formatPathDescription(
  path: RelationRow[],
  labels: Map<string, string>
): string {
  if (path.length === 0) return "Ta sama encja.";
  const segments: string[] = [];
  const first = path[0];
  if (first) {
    const sk = `${first.sourceType}:${first.sourceId}`;
    segments.push(labels.get(sk) ?? ENTITY_TYPE_META[first.sourceType].label);
  }
  for (const edge of path) {
    const rel = relationLabel(edge.relationType);
    const tk = `${edge.targetType}:${edge.targetId}`;
    segments.push(`[${rel}]`);
    segments.push(labels.get(tk) ?? ENTITY_TYPE_META[edge.targetType].label);
  }
  return segments.join(" → ");
}

const getNeighborsTool = (projectId: string) =>
  tool({
    description:
      "Zwraca sąsiadów encji w grafie relacji (głębokość 1 lub 2). Użyj do eksploracji powiązań.",
    parameters: z.object({
      entityType: z.enum(entityTypeKeys),
      entityId: z.string().uuid(),
      depth: z.union([z.literal(1), z.literal(2)]).default(1),
    }),
    execute: async ({ entityType, entityId, depth }) => {
      const ref: EntityRef = { type: entityType, id: entityId };
      const { nodes, relations } = await getNeighbors(projectId, ref, depth);
      const centerLabel = await entityDisplayName(projectId, ref);
      const enrichedNodes = await enrichRefs(projectId, nodes);
      return {
        center: enrichRef(projectId, ref, centerLabel),
        depth,
        neighbors: enrichedNodes,
        relations: relations.map((r) => ({
          id: r.id,
          source: { type: r.sourceType, id: r.sourceId },
          target: { type: r.targetType, id: r.targetId },
          relationType: r.relationType,
          label: relationLabel(r.relationType),
          sourceKind: r.source,
        })),
      };
    },
  });

const findPathTool = (projectId: string) =>
  tool({
    description:
      "Znajduje najkrótszą ścieżkę relacji między dwiema encjami (BFS, max 4 skoki).",
    parameters: z.object({
      from: entityRefInput,
      to: entityRefInput,
    }),
    execute: async ({ from, to }) => {
      const path = await findPath(projectId, from, to);
      if (path === null) {
        return {
          found: false,
          description: "Nie znaleziono ścieżki między encjami.",
          path: [],
        };
      }

      const labelKeys = new Set<string>();
      labelKeys.add(`${from.type}:${from.id}`);
      labelKeys.add(`${to.type}:${to.id}`);
      for (const edge of path) {
        labelKeys.add(`${edge.sourceType}:${edge.sourceId}`);
        labelKeys.add(`${edge.targetType}:${edge.targetId}`);
      }

      const labels = new Map<string, string>();
      for (const key of labelKeys) {
        const [type, id] = key.split(":");
        if (!isEntityTypeKey(type) || !id) continue;
        labels.set(key, await entityDisplayName(projectId, { type, id }));
      }

      const description = formatPathDescription(path, labels);

      return {
        found: true,
        description,
        path: path.map((r) => ({
          id: r.id,
          source: { type: r.sourceType, id: r.sourceId },
          target: { type: r.targetType, id: r.targetId },
          relationType: r.relationType,
          label: relationLabel(r.relationType),
        })),
      };
    },
  });

const getSubgraphTool = (projectId: string) =>
  tool({
    description:
      "Zwraca podgraf relacji — filtruj po obszarze strategii lub liście encji.",
    parameters: z.object({
      area: z.enum(strategyAreas).optional(),
      refs: z.array(entityRefInput).optional(),
    }),
    execute: async ({ area, refs }) => {
      const { relations } = await getSubgraph(projectId, { area, refs });
      return {
        area: area ?? null,
        refCount: refs?.length ?? 0,
        relationCount: relations.length,
        relations: relations.map((r) => ({
          id: r.id,
          source: { type: r.sourceType, id: r.sourceId },
          target: { type: r.targetType, id: r.targetId },
          relationType: r.relationType,
          label: relationLabel(r.relationType),
        })),
      };
    },
  });

const semanticSearchTool = (projectId: string) =>
  tool({
    description:
      "Wyszukiwanie semantyczne encji strategii (embeddingi Voyage + pgvector).",
    parameters: z.object({
      query: z.string().min(1).max(4000),
      k: z.number().int().min(1).max(20).default(8),
    }),
    execute: async ({ query, k }) => {
      const results = await searchSimilar(projectId, { query, k });
      return { query, results };
    },
  });

const focusMapNodeTool = () =>
  tool({
    description:
      "Nawigacja UI: pokaż encję na mapie strategii (konstelacja). Nic nie zapisuje — sygnał dla frontendu.",
    parameters: z.object({
      entityType: z.enum(entityTypeKeys),
      entityId: z.string().uuid(),
      mode: z.enum(["focus", "highlight", "path", "thread"]).default("focus"),
      pathIds: z.array(z.string().uuid()).optional(),
    }),
    execute: async () => ({ ok: true as const }),
  });

export function buildGraphTools(projectId: string): ToolSet {
  return {
    get_neighbors: getNeighborsTool(projectId) as ToolSet[string],
    find_path: findPathTool(projectId) as ToolSet[string],
    get_subgraph: getSubgraphTool(projectId) as ToolSet[string],
    semantic_search: semanticSearchTool(projectId) as ToolSet[string],
    focus_map_node: focusMapNodeTool() as ToolSet[string],
  };
}

export { entityRefSchema };
