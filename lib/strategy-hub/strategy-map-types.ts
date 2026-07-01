/**
 * Wspólne typy + paleta kolorów funkcji Strategy Map.
 * Nie importuje DB — bezpieczne do użycia po stronie klienta.
 */

/**
 * `review` — moduł był ✅, ale wymagany upstream zmienił się po tym fakcie
 * (propagacja „do przeglądu" ze spec). Renderowany jako pulsujący 🟡, tylko editor.
 */
export type NodeStatus = "ready" | "in_progress" | "empty" | "review";

/** Klucze 7 węzłów strategicznych na mapie makro. */
export type StrategyNodeKey =
  | "fundament"
  | "segmenty"
  | "lejek"
  | "kanaly"
  | "przekaz"
  | "strona"
  | "kpi";

/** Element listy w karcie L3 (np. pojedynczy problem, segment, kanał). */
export interface MapLeaf {
  id: string;
  label: string;
  note?: string | null;
}

/** Podkategoria L2 wyrastająca z węzła góra/dół. */
export interface MapSubcategory {
  id: string;
  label: string;
  count: number;
  items: MapLeaf[];
}

/** Węzeł L1 osi narracji. */
export interface StrategyNode {
  key: StrategyNodeKey;
  label: string;
  icon: string;
  status: NodeStatus;
  /** 0–100 — kompletność modułu. */
  score: number;
  /** Link do edytora modułu (tryb editor). */
  href: string;
  subcategories: MapSubcategory[];
}

/** Krawędź zależności między węzłami. */
export interface StrategyEdge {
  from: StrategyNodeKey;
  to: StrategyNodeKey;
}

// ─── Graf wpływu (mikro) ─────────────────────────────────────────────────────

export type InfluenceEntityType =
  | "stage"
  | "problem"
  | "objection"
  | "goal"
  | "element"
  | "flow"
  | "seo"
  | "page"
  | "channel"
  | "kpi"
  | "campaign"
  | "geo";

export type FunnelPhase = "TOFU" | "MOFU" | "BOFU" | "retention";

export interface InfluenceNode {
  id: string;
  type: InfluenceEntityType;
  label: string;
  /** Faza lejka (dla kolorowania „po fazie"). */
  phase?: FunnelPhase | null;
}

export interface InfluenceLink {
  id: string;
  source: string;
  target: string;
  /** Semantyka relacji — etykieta strzałki. */
  label: string;
  /** Siła relacji koduje styl linii (nie kolor). */
  strength?: "strong" | "normal" | "weak";
}

/** Łańcuch wpływu wokół jednego elementu lejka. */
export interface InfluenceElement {
  id: string;
  label: string;
  segmentId: string | null;
  segmentLabel: string | null;
  phase: FunnelPhase | null;
  /** Czy element jest „niepodłączony" (brak user flow lub KPI). */
  disconnected: boolean;
}

export interface InfluenceGraph {
  nodes: InfluenceNode[];
  links: InfluenceLink[];
  elements: InfluenceElement[];
  segments: { id: string; label: string }[];
}

export interface StrategyMapData {
  nodes: StrategyNode[];
  edges: StrategyEdge[];
  /** Kanoniczna kolejność trybu prezentacji. */
  presentationOrder: StrategyNodeKey[];
  influence: InfluenceGraph;
}

// ─── Paleta semantyczna (spójna w całej aplikacji) ───────────────────────────

/** Kolory typów encji grafu wpływu (limit ~8 — więcej = chaos). */
export const ENTITY_COLORS: Record<InfluenceEntityType, string> = {
  stage: "#60a5fa", // 🔵 etap zakupu
  problem: "#fb923c", // 🟠 problem / ambicja
  objection: "#f87171", // 🔴 obiekcja
  goal: "#c084fc", // 🟣 cel / JTBD / emocja
  element: "#34d399", // 🟢 element lejka (oś)
  flow: "#38bdf8", // 🔷 user flow
  seo: "#facc15", // 🟡 SEO keyword
  page: "#475569", // ⚫ podstrona
  channel: "#a16207", // 🟤 kanał
  kpi: "#f472b6", // 📊 KPI (akcent)
  campaign: "#a78bfa", // 🟪 kampania
  geo: "#22d3ee", // 🤖 GEO/AEO
};

export const ENTITY_LABELS: Record<InfluenceEntityType, string> = {
  stage: "Etap zakupu",
  problem: "Problem / ambicja",
  objection: "Obiekcja",
  goal: "Cel / JTBD / emocja",
  element: "Element lejka",
  flow: "User flow",
  seo: "SEO keyword",
  page: "Podstrona",
  channel: "Kanał",
  kpi: "KPI",
  campaign: "Kampania",
  geo: "GEO / AEO",
};

/** Kolory faz lejka (dla trybu „po fazie"). */
export const PHASE_COLORS: Record<FunnelPhase, string> = {
  TOFU: "#60a5fa",
  MOFU: "#a78bfa",
  BOFU: "#34d399",
  retention: "#fbbf24",
};

export const PHASE_LABELS: Record<FunnelPhase, string> = {
  TOFU: "TOFU — świadomość",
  MOFU: "MOFU — rozważanie",
  BOFU: "BOFU — decyzja",
  retention: "Retencja",
};

/** Normalizuje dowolny zapis fazy na kanoniczny enum. */
export function normalizePhase(
  raw: string | null | undefined
): FunnelPhase | null {
  if (!raw) return null;
  const v = raw.toLowerCase();
  if (v.includes("tofu") || v.includes("świado") || v.includes("aware"))
    return "TOFU";
  if (v.includes("mofu") || v.includes("rozważ") || v.includes("consider"))
    return "MOFU";
  if (v.includes("bofu") || v.includes("decyz") || v.includes("decision"))
    return "BOFU";
  if (v.includes("reten") || v.includes("loja") || v.includes("utrzym"))
    return "retention";
  return null;
}

export function statusFromScore(score: number): NodeStatus {
  if (score >= 80) return "ready";
  if (score > 0) return "in_progress";
  return "empty";
}

const STRATEGY_NODE_KEY_SET = new Set<string>([
  "fundament",
  "segmenty",
  "lejek",
  "kanaly",
  "przekaz",
  "strona",
  "kpi",
]);

/** Type guard zawężający dowolny string do klucza węzła mapy makro. */
export function isStrategyNodeKey(value: string): value is StrategyNodeKey {
  return STRATEGY_NODE_KEY_SET.has(value);
}
