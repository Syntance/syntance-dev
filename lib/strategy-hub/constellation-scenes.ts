import "server-only";
import { db } from "@/db";
import { brandPositioning, uvp } from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  AREA_META,
  CORE_NODE_ID,
  areaNodeId,
  entityNodeId,
  type ConstellationLink,
  type ConstellationNode,
  type ConstellationScene,
  type CoreSingletons,
  type SceneData,
} from "@/lib/strategy-hub/constellation-types";
import {
  AREA_DEPENDENCIES,
  ENTITY_TYPE_META,
  type EntityTypeKey,
  type StrategyArea,
} from "@/lib/strategy-hub/entities/entity-types";
import { getConstellationData } from "@/lib/strategy-hub/constellation-data";

const SIDE_LIMIT = 15;

function linkTouchesNode(link: ConstellationLink, nodeId: string): boolean {
  return link.sourceId === nodeId || link.targetId === nodeId;
}

function edgeCountForNode(links: ConstellationLink[], nodeId: string): number {
  return links.filter((l) => linkTouchesNode(l, nodeId)).length;
}

function sortByEdgeCount(
  nodes: ConstellationNode[],
  links: ConstellationLink[]
): ConstellationNode[] {
  return [...nodes].sort(
    (a, b) => edgeCountForNode(links, b.id) - edgeCountForNode(links, a.id)
  );
}

function capSide(
  nodes: ConstellationNode[],
  links: ConstellationLink[]
): ConstellationNode[] {
  const sorted = sortByEdgeCount(nodes, links);
  if (sorted.length <= SIDE_LIMIT) return sorted;
  const kept = sorted.slice(0, SIDE_LIMIT);
  const overflow = sorted.length - SIDE_LIMIT;
  const last = kept[kept.length - 1];
  if (last) last.childCount = (last.childCount ?? 0) + overflow;
  return kept;
}

function areaLabel(area: StrategyArea): string {
  return AREA_META[area].label;
}

function buildBreadcrumb(
  projectLabel: string,
  scene: ConstellationScene
): SceneData["breadcrumb"] {
  if (scene.level === "organism") {
    return [{ label: projectLabel, scene: { level: "organism" } }];
  }
  if (scene.level === "area") {
    return [
      { label: projectLabel, scene: { level: "organism" } },
      { label: areaLabel(scene.area), scene },
    ];
  }
  return [{ label: projectLabel, scene: { level: "organism" } }];
}

function entityAreaFromNode(
  node: ConstellationNode,
  nodes: ConstellationNode[]
): StrategyArea | null {
  if (!node.parentId?.startsWith("area:")) return null;
  const area = node.parentId.slice("area:".length) as StrategyArea;
  if (area in AREA_META) return area;
  const parentArea = nodes.find((n) => n.id === node.parentId);
  if (parentArea?.id.startsWith("area:")) {
    return parentArea.id.slice("area:".length) as StrategyArea;
  }
  return null;
}

function filterLinksForScene(
  links: ConstellationLink[],
  nodeIds: Set<string>
): ConstellationLink[] {
  return links.filter(
    (l) => nodeIds.has(l.sourceId) && nodeIds.has(l.targetId)
  );
}

function neighborsFromLinks(
  links: ConstellationLink[],
  memberIds: Set<string>,
  direction: "upstream" | "downstream"
): { nodeIds: Set<string>; links: ConstellationLink[] } {
  const ids = new Set<string>();
  const picked: ConstellationLink[] = [];

  for (const link of links) {
    if (link.kind !== "cross") continue;
    const srcIn = memberIds.has(link.sourceId);
    const tgtIn = memberIds.has(link.targetId);
    if (direction === "upstream" && tgtIn && !srcIn) {
      ids.add(link.sourceId);
      picked.push(link);
    }
    if (direction === "downstream" && srcIn && !tgtIn) {
      ids.add(link.targetId);
      picked.push(link);
    }
  }
  return { nodeIds: ids, links: picked };
}

async function getCoreSingletons(projectId: string): Promise<CoreSingletons> {
  const [uvpRow, posRow] = await Promise.all([
    db
      .select({ coreUvpMd: uvp.coreUvpMd })
      .from(uvp)
      .where(eq(uvp.projectId, projectId))
      .limit(1),
    db
      .select({ statementMd: brandPositioning.statementMd })
      .from(brandPositioning)
      .where(eq(brandPositioning.projectId, projectId))
      .limit(1),
  ]);
  return {
    uvpMd: uvpRow[0]?.coreUvpMd ?? null,
    positioningMd: posRow[0]?.statementMd ?? null,
  };
}

export async function getConstellationScene(
  projectId: string,
  scene: ConstellationScene,
  mode: "editor" | "client" = "editor"
): Promise<SceneData> {
  const data = await getConstellationData(projectId, mode);
  const nodeById = new Map(data.nodes.map((n) => [n.id, n]));
  const core = nodeById.get(CORE_NODE_ID);
  const projectLabel = core?.label ?? "Biznes";

  if (scene.level === "organism") {
    const members = data.nodes.filter((n) => n.kind !== "core");
    const visibleIds = new Set([
      CORE_NODE_ID,
      ...data.nodes.filter((n) => n.kind === "area").map((n) => n.id),
      ...members.map((n) => n.id),
    ]);
    const singletons = await getCoreSingletons(projectId);
    return {
      scene,
      center:
        core ??
        ({
          id: CORE_NODE_ID,
          kind: "core",
          label: projectLabel,
          color: "#a78bfa",
          parentId: null,
        } satisfies ConstellationNode),
      members,
      upstream: [],
      downstream: [],
      links: filterLinksForScene(data.links, visibleIds),
      breadcrumb: buildBreadcrumb(projectLabel, scene),
      areasOrder: data.areasOrder,
      health: data.health,
      singletons,
    };
  }

  if (scene.level === "area") {
    const areaId = areaNodeId(scene.area);
    const center = nodeById.get(areaId);
    if (!center) {
      throw new Error(`Unknown area: ${scene.area}`);
    }
    const members = data.nodes.filter((n) => n.parentId === areaId);
    const memberIds = new Set(members.map((m) => m.id));
    memberIds.add(areaId);

    const deps = AREA_DEPENDENCIES[scene.area] ?? [];
    const downstreamAreas = (
      Object.keys(AREA_DEPENDENCIES) as StrategyArea[]
    ).filter((a) => AREA_DEPENDENCIES[a].includes(scene.area));

    const upstreamAreaNodes = deps
      .map((a) => nodeById.get(areaNodeId(a)))
      .filter((n): n is ConstellationNode => n != null);

    const downstreamAreaNodes = downstreamAreas
      .map((a) => nodeById.get(areaNodeId(a)))
      .filter((n): n is ConstellationNode => n != null);

    const { nodeIds: upEntityIds, links: upLinks } = neighborsFromLinks(
      data.links,
      memberIds,
      "upstream"
    );
    const { nodeIds: downEntityIds, links: downLinks } = neighborsFromLinks(
      data.links,
      memberIds,
      "downstream"
    );

    const upstreamEntities = [...upEntityIds]
      .map((id) => nodeById.get(id))
      .filter((n): n is ConstellationNode => n != null);

    const downstreamEntities = [...downEntityIds]
      .map((id) => nodeById.get(id))
      .filter((n): n is ConstellationNode => n != null);

    const upstream = capSide(
      [...upstreamAreaNodes, ...upstreamEntities],
      data.links
    );
    const downstream = capSide(
      [...downstreamAreaNodes, ...downstreamEntities],
      data.links
    );

    const visibleIds = new Set([
      areaId,
      ...members.map((m) => m.id),
      ...upstream.map((n) => n.id),
      ...downstream.map((n) => n.id),
    ]);

    return {
      scene,
      center,
      members,
      upstream,
      downstream,
      links: filterLinksForScene(
        [...data.links, ...upLinks, ...downLinks],
        visibleIds
      ),
      breadcrumb: buildBreadcrumb(projectLabel, scene),
      areasOrder: data.areasOrder,
      health: data.health,
    };
  }

  const nodeId = entityNodeId(scene.ref.type, scene.ref.id);
  const center = nodeById.get(nodeId);
  if (!center) {
    throw new Error(`Unknown entity: ${scene.ref.type}:${scene.ref.id}`);
  }

  const memberIds = new Set([nodeId]);
  const { nodeIds: upIds, links: upLinks } = neighborsFromLinks(
    data.links,
    memberIds,
    "upstream"
  );
  const { nodeIds: downIds, links: downLinks } = neighborsFromLinks(
    data.links,
    memberIds,
    "downstream"
  );

  const upstream = capSide(
    [...upIds]
      .map((id) => nodeById.get(id))
      .filter((n): n is ConstellationNode => n != null),
    data.links
  );
  const downstream = capSide(
    [...downIds]
      .map((id) => nodeById.get(id))
      .filter((n): n is ConstellationNode => n != null),
    data.links
  );

  const visibleIds = new Set([
    nodeId,
    ...upstream.map((n) => n.id),
    ...downstream.map((n) => n.id),
  ]);

  const area = entityAreaFromNode(center, data.nodes);
  const breadcrumb: SceneData["breadcrumb"] = area
    ? [
        { label: projectLabel, scene: { level: "organism" } },
        { label: areaLabel(area), scene: { level: "area", area } },
        { label: center.label, scene },
      ]
    : [
        { label: projectLabel, scene: { level: "organism" } },
        { label: center.label, scene },
      ];

  return {
    scene,
    center,
    members: [],
    upstream,
    downstream,
    links: filterLinksForScene(
      [...data.links, ...upLinks, ...downLinks],
      visibleIds
    ),
    breadcrumb,
    areasOrder: data.areasOrder,
    health: data.health,
  };
}

export function parseConstellationScene(params: {
  level?: string | null;
  area?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  type?: string | null;
  id?: string | null;
  focus?: string | null;
}): ConstellationScene {
  if (params.focus) {
    const idx = params.focus.indexOf(":");
    if (idx > 0) {
      const type = params.focus.slice(0, idx) as EntityTypeKey;
      const id = params.focus.slice(idx + 1);
      if (type in ENTITY_TYPE_META && id) {
        return { level: "entity", ref: { type, id } };
      }
    }
  }

  const level = params.level ?? "organism";
  if (level === "area" && params.area && params.area in AREA_META) {
    return { level: "area", area: params.area as StrategyArea };
  }
  const entityType = params.entityType ?? params.type;
  const entityId = params.entityId ?? params.id;
  if (level === "entity" && entityType && entityId) {
    const type = entityType as EntityTypeKey;
    if (type in ENTITY_TYPE_META) {
      return { level: "entity", ref: { type, id: entityId } };
    }
  }
  return { level: "organism" };
}
