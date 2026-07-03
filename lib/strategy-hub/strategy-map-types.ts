/**
 * Wspólne typy + paleta kolorów funkcji Strategy Map.
 * Nie importuje DB — bezpieczne do użycia po stronie klienta.
 */

import { ENTITY_TYPE_META } from "@/lib/strategy-hub/entities/entity-types";

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
  /**
   * Blokada z maszyny stanów (`resolveModuleStatuses`): wymagany upstream jest
   * 🔴 pusty. Liczona na serwerze — klient tylko renderuje.
   */
  locked: boolean;
  /** Klucze pustych wymaganych upstreamów (do komunikatu „Najpierw uzupełnij X"). */
  blockedBy: string[];
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
  stage: ENTITY_TYPE_META.stage.color,
  problem: ENTITY_TYPE_META.problem.color,
  objection: ENTITY_TYPE_META.objection.color,
  goal: ENTITY_TYPE_META.flow.color,
  element: ENTITY_TYPE_META.element.color,
  flow: ENTITY_TYPE_META.flow.color,
  seo: ENTITY_TYPE_META.seo_keyword.color,
  page: ENTITY_TYPE_META.page.color,
  channel: ENTITY_TYPE_META.channel.color,
  kpi: ENTITY_TYPE_META.kpi.color,
  campaign: ENTITY_TYPE_META.campaign.color,
  geo: ENTITY_TYPE_META.geo.color,
};

export const ENTITY_LABELS: Record<InfluenceEntityType, string> = {
  stage: ENTITY_TYPE_META.stage.label,
  problem: ENTITY_TYPE_META.problem.label,
  objection: ENTITY_TYPE_META.objection.label,
  goal: "Cel / JTBD / emocja",
  element: ENTITY_TYPE_META.element.label,
  flow: ENTITY_TYPE_META.flow.label,
  seo: ENTITY_TYPE_META.seo_keyword.label,
  page: ENTITY_TYPE_META.page.label,
  channel: ENTITY_TYPE_META.channel.label,
  kpi: ENTITY_TYPE_META.kpi.label,
  campaign: ENTITY_TYPE_META.campaign.label,
  geo: ENTITY_TYPE_META.geo.label,
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
