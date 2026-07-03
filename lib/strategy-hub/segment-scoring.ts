// Macierz scoringu segmentów wg metodyki priorytetyzacji Szymona Negacza:
// każdy segment oceniany 1–5 na kilku wagowanych kryteriach, wynik ważony
// 0–100 decyduje o priorytecie wejścia. Wagi i kryteria są edytowalne
// per-projekt (market-segmentation singleton), z sensownym defaultem.

export interface ScoringCriterion {
  key: string;
  label: string;
  weight: number; // 1-5
}

const DEFAULT_SCORING_CRITERIA: ScoringCriterion[] = [
  { key: "market_size", label: "Wielkość rynku (TAM)", weight: 5 },
  { key: "reachability", label: "Łatwość dotarcia", weight: 4 },
  { key: "buying_readiness", label: "Gotowość do zakupu", weight: 5 },
  { key: "margin", label: "Marża / LTV", weight: 4 },
  { key: "fit", label: "Fit z produktem/ofertą", weight: 5 },
  { key: "low_competition", label: "Niska konkurencja", weight: 3 },
  { key: "low_cac", label: "Niski koszt akwizycji", weight: 3 },
];

export function resolveCriteria(raw: unknown): ScoringCriterion[] {
  if (!Array.isArray(raw) || raw.length === 0) return DEFAULT_SCORING_CRITERIA;
  return raw
    .filter(
      (c): c is ScoringCriterion =>
        !!c && typeof c === "object" && typeof (c as ScoringCriterion).key === "string"
    )
    .map((c) => ({
      key: c.key,
      label: c.label || c.key,
      weight: Number(c.weight) || 1,
    }));
}

/** Zwraca wynik ważony 0-100 na podstawie ocen 1-5 per kryterium. */
export function weightedScore(
  scoring: Record<string, unknown> | null | undefined,
  criteria: ScoringCriterion[]
): number | null {
  if (!scoring) return null;
  let sumWeight = 0;
  let sumWeighted = 0;
  let any = false;
  for (const c of criteria) {
    const raw = scoring[c.key];
    const v = typeof raw === "number" ? raw : Number(raw);
    if (!Number.isFinite(v) || v <= 0) continue;
    any = true;
    sumWeight += c.weight;
    sumWeighted += v * c.weight;
  }
  if (!any || sumWeight === 0) return null;
  return Math.round((sumWeighted / sumWeight / 5) * 100);
}
