/**
 * Client-safe katalog typów encji Strategy Hub.
 * BEZ `import "server-only"` — importują go komponenty klienckie i moduły serwerowe.
 */

export type EntityTypeKey =
  | "segment"
  | "stage"
  | "element"
  | "channel"
  | "kpi"
  | "page"
  | "campaign"
  | "geo"
  | "offer"
  | "flow"
  | "competitor"
  | "objection"
  | "problem"
  | "decision"
  | "seo_keyword";

export type StrategyArea =
  | "fundament"
  | "segmenty"
  | "lejek"
  | "kanaly"
  | "przekaz"
  | "strona"
  | "kpi";

export interface EntityTypeMeta {
  label: string;
  labelPlural: string;
  color: string;
  area: StrategyArea;
  registryKey: string | null;
  href: (projectId: string, entityId?: string) => string;
}

function hubPath(projectId: string, segment: string): string {
  return `/strategy-hub/projects/${projectId}/${segment}`;
}

export const ENTITY_TYPE_META: Record<EntityTypeKey, EntityTypeMeta> = {
  segment: {
    label: "Segment",
    labelPlural: "Segmenty",
    color: "#38bdf8",
    area: "segmenty",
    registryKey: "segments",
    href: (projectId) => hubPath(projectId, "market/segments"),
  },
  stage: {
    label: "Etap zakupu",
    labelPlural: "Etapy zakupu",
    color: "#60a5fa",
    area: "lejek",
    registryKey: null,
    href: (projectId) => hubPath(projectId, "execution/funnel"),
  },
  element: {
    label: "Element lejka",
    labelPlural: "Elementy lejka",
    color: "#34d399",
    area: "lejek",
    registryKey: null,
    href: (projectId) => hubPath(projectId, "execution/funnel"),
  },
  channel: {
    label: "Kanał",
    labelPlural: "Kanały",
    color: "#a16207",
    area: "kanaly",
    registryKey: "channels",
    href: (projectId) => hubPath(projectId, "execution/channels"),
  },
  kpi: {
    label: "KPI",
    labelPlural: "KPI",
    color: "#f472b6",
    area: "kpi",
    registryKey: "kpis",
    href: (projectId) => hubPath(projectId, "measurement/kpi"),
  },
  page: {
    label: "Podstrona",
    labelPlural: "Podstrony",
    color: "#475569",
    area: "strona",
    registryKey: "pages",
    href: (projectId) => hubPath(projectId, "execution/sites"),
  },
  campaign: {
    label: "Kampania",
    labelPlural: "Kampanie",
    color: "#a78bfa",
    area: "kanaly",
    registryKey: "campaigns",
    href: (projectId) => hubPath(projectId, "execution/campaigns"),
  },
  geo: {
    label: "GEO / AEO",
    labelPlural: "GEO / AEO",
    color: "#22d3ee",
    area: "kanaly",
    registryKey: "geo-assets",
    href: (projectId) => hubPath(projectId, "execution/geo"),
  },
  offer: {
    label: "Oferta",
    labelPlural: "Oferty",
    color: "#fb923c",
    area: "przekaz",
    registryKey: "offers",
    href: (projectId) => hubPath(projectId, "execution/offers"),
  },
  flow: {
    label: "User flow",
    labelPlural: "User flow",
    color: "#c084fc",
    area: "lejek",
    registryKey: null,
    href: (projectId) => hubPath(projectId, "execution/funnel"),
  },
  competitor: {
    label: "Konkurent",
    labelPlural: "Konkurenci",
    color: "#ef4444",
    area: "fundament",
    registryKey: "competitors",
    href: (projectId) => hubPath(projectId, "foundation/business"),
  },
  objection: {
    label: "Obiekcja",
    labelPlural: "Obiekcje",
    color: "#f87171",
    area: "fundament",
    registryKey: "objections",
    href: (projectId) => hubPath(projectId, "foundation/business"),
  },
  problem: {
    label: "Problem / ambicja",
    labelPlural: "Problemy / ambicje",
    color: "#fb923c",
    area: "fundament",
    registryKey: "problems",
    href: (projectId) => hubPath(projectId, "foundation/business"),
  },
  decision: {
    label: "Decyzja",
    labelPlural: "Decyzje",
    color: "#818cf8",
    area: "fundament",
    registryKey: null,
    href: (projectId) => hubPath(projectId, "foundation/decisions"),
  },
  seo_keyword: {
    label: "SEO keyword",
    labelPlural: "SEO keywords",
    color: "#facc15",
    area: "strona",
    registryKey: "seo-keywords",
    href: (projectId) => hubPath(projectId, "execution/sites"),
  },
};

export const RELATION_TYPES = {
  publikowany_w: { label: "publikowany w" },
  mierzony_przez: { label: "mierzony przez" },
  promowany_przez: { label: "promowany przez" },
  wspierany_przez: { label: "cytowalny w AI przez" },
  prowadzi_przez: { label: "prowadzi przez" },
  skierowana_do: { label: "dla segmentu" },
  targetuje: { label: "targetuje" },
  laduje_na: { label: "ląduje na" },
  adresuje: { label: "adresuje" },
  oslabia: { label: "osłabia" },
  wspiera: { label: "wspiera" },
  konkuruje_z: { label: "konkuruje z" },
  powiazany_z: { label: "powiązany z" },
} as const;

export type RelationTypeKey = keyof typeof RELATION_TYPES;

export function isEntityTypeKey(t: string): t is EntityTypeKey {
  return t in ENTITY_TYPE_META;
}

/** Etykieta krawędzi z klucza relacji lub surowego typu. */
export function relationLabel(relationType: string): string {
  const key = relationType as RelationTypeKey;
  if (key in RELATION_TYPES) {
    return RELATION_TYPES[key].label;
  }
  return relationType;
}

/** Kolor typu encji — fallback szary gdy typ spoza katalogu. */
export function entityColor(type: string): string {
  const key = type as EntityTypeKey;
  return ENTITY_TYPE_META[key]?.color ?? "#94a3b8";
}

/** href encji w edytorze Hub. */
export function entityHref(projectId: string, type: EntityTypeKey): string {
  return ENTITY_TYPE_META[type].href(projectId);
}
