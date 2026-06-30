/** Mapowanie modułów health-score na obszary sidebara (Faza 1). */
export const AREA_MODULE_KEYS = {
  foundation: ["discovery", "brand", "business"] as const,
  market: ["segments"] as const,
  execution: ["funnel", "sales", "website"] as const,
  measurement: ["kpi"] as const,
  info: [] as const,
  settings: [] as const,
} as const;

export type AreaKey = keyof typeof AREA_MODULE_KEYS;

/** Nowe ścieżki modułów względem `/strategy-hub/projects/[id]`. */
export const MODULE_ROUTE_SEGMENTS: Record<string, string> = {
  discovery: "foundation/discovery",
  brand: "foundation/brand",
  business: "foundation/business",
  segments: "market/segments",
  funnel: "execution/funnel",
  sales: "execution/copy",
  website: "execution/sites",
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

export const FOUNDATION_TABS: AreaTabDef[] = [
  { slug: "discovery", label: "Discovery" },
  { slug: "brand", label: "Marka" },
  { slug: "business", label: "Strategia biznesowa" },
  { slug: "decisions", label: "Decyzje" },
];

export const MARKET_TABS: AreaTabDef[] = [
  { slug: "segments", label: "Segmenty" },
  { slug: "journey", label: "Customer journey" },
  { slug: "segmentation", label: "Segmentacja" },
];

export const EXECUTION_TABS: AreaTabDef[] = [
  { slug: "funnel", label: "Lejek" },
  { slug: "channels", label: "Kanały" },
  { slug: "copy", label: "Copy i sprzedaż" },
  { slug: "sites", label: "Strony WWW" },
  { slug: "campaigns", label: "Kampanie" },
  { slug: "geo", label: "GEO / AEO" },
  { slug: "offers", label: "Oferty" },
];

export const MEASUREMENT_TABS: AreaTabDef[] = [
  { slug: "kpi", label: "KPI" },
  { slug: "audits", label: "Audyty" },
  { slug: "review", label: "Weekly review" },
];

export const INFO_TABS: AreaTabDef[] = [
  { slug: "access", label: "Dostępy i hosting" },
  { slug: "notes", label: "Notatki" },
];

export const PROJECT_SETTINGS_TABS: AreaTabDef[] = [
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

export function areaScoreFromModules(
  areaKey: AreaKey,
  modules: { key: string; score: number }[]
): number {
  const keys = AREA_MODULE_KEYS[areaKey];
  const relevant = modules.filter((m) =>
    (keys as readonly string[]).includes(m.key)
  );
  if (relevant.length === 0) return 0;
  return Math.round(
    relevant.reduce((acc, m) => acc + m.score, 0) / relevant.length
  );
}

export function healthDotClass(score: number): string {
  if (score >= 80) return "bg-success";
  if (score > 0) return "bg-brand";
  return "bg-muted-foreground/40";
}
