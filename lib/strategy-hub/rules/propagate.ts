import type { RulesConfig } from "./types";
import { downstreamOf } from "./state";

/**
 * Propagacja „do przeglądu" (Strategy Hub 2.1 — M1/„R").
 *
 * Reguła ze spec: zmiana gotowej encji X → każdy moduł, który ma X w „⬅️ Wejściach",
 * dostaje status 🟡 „do przeglądu" (`review_flag = true`). Tu wyliczamy — na podstawie
 * grafu makro z reguł — które tabele encji należy oflagować.
 *
 * Etap 1: `review_flag` istnieje na `segments`, `objections`, `funnel_elements`,
 * `pages`, `kpis`, `strategic_decisions` (migracja 0015). Mapowanie obejmuje te tabele.
 */

/** Klucz encji (rejestr/route) → klucz modułu mapy makro. */
const ENTITY_TO_MODULE: Record<string, string> = {
  segments: "segmenty",
  objections: "fundament",
  competitors: "fundament",
  "business-problems": "fundament",
  uvp: "fundament",
  "purchase-stages": "lejek",
  "funnel-elements": "lejek",
  funnelElements: "lejek",
  "user-flows": "lejek",
  channels: "kanaly",
  "channel-activity-plan": "kanaly",
  "sales-pitches": "przekaz",
  "sales-scripts": "przekaz",
  "lead-magnets": "przekaz",
  pages: "strona",
  "seo-keywords": "strona",
  kpis: "kpi",
};

/** Moduł mapy → tabele encji z kolumną `review_flag` należące do niego. */
const MODULE_REVIEW_TABLES: Record<string, string[]> = {
  fundament: ["objections"],
  segmenty: ["segments"],
  lejek: ["funnelElements"],
  strona: ["pages"],
  kpi: ["kpis"],
};

/**
 * Tabele encji downstream, którym należy ustawić `review_flag = true`
 * po zmianie encji `changedEntityKey`. Zwraca klucze tabel (unikalne).
 */
export function reviewTablesOnChange(
  rules: RulesConfig,
  changedEntityKey: string
): string[] {
  const moduleKey = ENTITY_TO_MODULE[changedEntityKey];
  if (!moduleKey) return [];
  const tables = new Set<string>();
  for (const mod of downstreamOf(rules, moduleKey)) {
    for (const t of MODULE_REVIEW_TABLES[mod] ?? []) tables.add(t);
  }
  return [...tables];
}
