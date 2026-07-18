/**
 * Klucze i etykiety pokrycia podróży zakupowej (gap engine, logika Negacza).
 * Osobny moduł BEZ "server-only", bo importują go i serwer (`journey-coverage`),
 * i komponenty klienckie (funnel-workspace) — jedno źródło zamiast lokalnych kopii.
 */

export type CoverageKey = "content" | "channel" | "sales" | "exit" | "kpi";

export const COVERAGE_LABELS: Record<CoverageKey, string> = {
  content: "Treść",
  channel: "Kanał",
  sales: "Sprzedaż",
  exit: "Wyjście",
  kpi: "KPI",
};

export interface StageCoverageItem {
  key: CoverageKey;
  /** Czy etap ma odpowiedź tego typu. */
  ok: boolean;
  /** Czy brak liczy się jako luka (konfig reguł + wyjątki retencji/ownera/ostatniego etapu). */
  required: boolean;
}
