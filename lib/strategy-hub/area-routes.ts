/** Mapowanie modułów health-score na obszary sidebara (taksonomia scalona 2.1). */
const AREA_MODULE_KEYS = {
  foundation: ["discovery", "brand", "fundament"] as const,
  market: ["segmenty"] as const,
  execution: ["lejek", "kanaly", "przekaz", "sprzedaz", "strona"] as const,
  measurement: ["kpi"] as const,
  info: [] as const,
  settings: [] as const,
} as const;

export type AreaKey = keyof typeof AREA_MODULE_KEYS;

/** Ścieżki modułów względem `/strategy-hub/projects/[id]` (klucze = jedna taksonomia). */
const MODULE_ROUTE_SEGMENTS: Record<string, string> = {
  discovery: "foundation/discovery",
  brand: "foundation/brand",
  fundament: "foundation/business",
  segmenty: "market/segments",
  lejek: "execution/funnel",
  kanaly: "execution/channels",
  przekaz: "execution/copy",
  sprzedaz: "execution/sales",
  strona: "execution/sites",
  kpi: "measurement/kpi",
};

export function projectModuleHref(projectId: string, moduleKey: string): string {
  const segment = MODULE_ROUTE_SEGMENTS[moduleKey] ?? moduleKey;
  return `/strategy-hub/projects/${projectId}/${segment}`;
}

export function projectAreaHref(projectId: string, area: AreaKey): string {
  const paths: Record<AreaKey, string> = {
    foundation: "foundation",
    market: "market",
    execution: "execution",
    measurement: "measurement",
    info: "info",
    settings: "project-settings",
  };
  return `/strategy-hub/projects/${projectId}/${paths[area]}`;
}

/** Definicja zakładki — bez funkcji (bezpieczne dla Client Components). */
export interface AreaTabDef {
  slug: string;
  label: string;
}

export function areaTabHref(
  projectId: string,
  areaSegment: string,
  tabSlug: string
): string {
  return `/strategy-hub/projects/${projectId}/${areaSegment}/${tabSlug}`;
}

const FOUNDATION_TABS: AreaTabDef[] = [
  { slug: "discovery", label: "Discovery" },
  { slug: "brand", label: "Marka" },
  { slug: "business", label: "Strategia biznesowa" },
  { slug: "decisions", label: "Decyzje" },
];

const MARKET_TABS: AreaTabDef[] = [
  { slug: "segments", label: "Segmenty" },
  { slug: "journey", label: "Customer journey" },
  { slug: "segmentation", label: "Segmentacja" },
];

const EXECUTION_TABS: AreaTabDef[] = [
  { slug: "funnel", label: "Lejek" },
  { slug: "channels", label: "Kanały" },
  { slug: "copy", label: "Copy i przekaz" },
  { slug: "sales", label: "Proces sprzedaży" },
  { slug: "sites", label: "Strony WWW" },
  { slug: "campaigns", label: "Kampanie" },
  { slug: "geo", label: "GEO / AEO" },
  { slug: "offers", label: "Oferty" },
];

const MEASUREMENT_TABS: AreaTabDef[] = [
  { slug: "kpi", label: "KPI" },
  { slug: "audits", label: "Audyty" },
  { slug: "review", label: "Weekly review" },
];

const INFO_TABS: AreaTabDef[] = [
  { slug: "access", label: "Dostępy i hosting" },
  { slug: "notes", label: "Notatki" },
  { slug: "exports", label: "Eksporty" },
  { slug: "agent", label: "Agent AI" },
];

const PROJECT_SETTINGS_TABS: AreaTabDef[] = [
  { slug: "general", label: "Ogólne" },
  { slug: "sync", label: "Sync Notion" },
];

/** Segment URL obszaru (używany w sidebarze i tab-barze). */
export const AREA_SEGMENT: Record<AreaKey, string> = {
  foundation: "foundation",
  market: "market",
  execution: "execution",
  measurement: "measurement",
  info: "info",
  settings: "project-settings",
};

/** Zakładki per obszar — podgałęzie w lewym menu. */
export const AREA_TABS: Record<AreaKey, readonly AreaTabDef[]> = {
  foundation: FOUNDATION_TABS,
  market: MARKET_TABS,
  execution: EXECUTION_TABS,
  measurement: MEASUREMENT_TABS,
  info: INFO_TABS,
  settings: PROJECT_SETTINGS_TABS,
};

/** Stan zbiorczy obszaru z modułów: ✅ gdy wszystkie ready, 🔴 gdy wszystkie empty, 🟡 wpp. */
export type AreaState = "ready" | "in_progress" | "empty";

export function areaStateFromModules(
  areaKey: AreaKey,
  modules: { key: string; state: AreaState | "review" }[]
): AreaState {
  const keys = AREA_MODULE_KEYS[areaKey];
  const relevant = modules.filter((m) =>
    (keys as readonly string[]).includes(m.key)
  );
  if (relevant.length === 0) return "empty";
  if (relevant.every((m) => m.state === "ready")) return "ready";
  if (relevant.every((m) => m.state === "empty")) return "empty";
  return "in_progress";
}

export function healthDotClass(state: AreaState): string {
  if (state === "ready") return "bg-success";
  if (state === "empty") return "bg-muted-foreground/40";
  return "bg-brand";
}
