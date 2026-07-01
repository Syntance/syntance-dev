import type { CriterionContext } from "./evaluate";
import { computeModuleScore } from "./evaluate";
import type { ModuleRule, RulesConfig } from "./types";

/**
 * Maszyna stanów modułów — implementacja reguł ze spec „Logika modułów":
 *
 * - 🔴 `empty`        — nie spełnia minimum (score = 0).
 * - 🟡 `in_progress`  — uzupełniany (0 < score < próg gotowości).
 * - 🟡 `review`       — był ✅, ale wymagany upstream zmienił się (flaga „do przeglądu").
 * - ✅ `ready`        — score ≥ próg gotowości **i** żaden wymagany upstream nie jest 🔴.
 *
 * Lock (blokada): moduł nie osiąga ✅, jeśli którykolwiek wymagany upstream jest 🔴 pusty
 * — egzekwuje metodykę „nie robimy downstream, gdy fundament jest pusty".
 */
export type ModuleState = "empty" | "in_progress" | "review" | "ready";

export interface ModuleStatus {
  key: string;
  score: number;
  state: ModuleState;
  /** true, gdy którykolwiek wymagany upstream jest 🔴 pusty. */
  locked: boolean;
  /** Klucze pustych wymaganych upstreamów (do komunikatu „Najpierw uzupełnij X"). */
  blockedBy: string[];
  /** Czy moduł pulsuje „do przeglądu" (upstream zmienił się po ✅). */
  review: boolean;
}

export interface StateInput {
  /** Wynik kompletności 0–100 dla modułu (np. z `computeModuleScore`). */
  scoreOf: (key: string) => number;
  /** Czy moduł ma ustawioną flagę „do przeglądu" (review_flag w encjach). */
  reviewOf?: (key: string) => boolean;
}

function baseState(
  score: number,
  m: ModuleRule
): Exclude<ModuleState, "review"> {
  if (score <= 0) return "empty";
  if (score >= m.readyThreshold) return "ready";
  return "in_progress";
}

/**
 * Wylicza stan każdego modułu konfiguracji.
 * Lock liczony względem **bazowego** stanu upstreamów (tylko 🔴 pusty blokuje),
 * dzięki czemu kolejność nie ma znaczenia i nie ma kaskady fałszywych blokad.
 */
export function resolveModuleStatuses(
  rules: RulesConfig,
  input: StateInput
): Map<string, ModuleStatus> {
  const base = new Map<string, Exclude<ModuleState, "review">>();
  for (const m of rules.modules) {
    base.set(m.key, baseState(input.scoreOf(m.key), m));
  }

  const result = new Map<string, ModuleStatus>();
  for (const m of rules.modules) {
    const required = m.lock.enabled ? m.lock.requiresUpstream : [];
    const blockedBy = required.filter((u) => base.get(u) === "empty");
    const locked = blockedBy.length > 0;

    let state: ModuleState = base.get(m.key) ?? "empty";
    if (locked && state === "ready") state = "in_progress";

    const review =
      m.stale.enabled &&
      state === "ready" &&
      (input.reviewOf?.(m.key) ?? false);
    if (review) state = "review";

    result.set(m.key, {
      key: m.key,
      score: input.scoreOf(m.key),
      state,
      locked,
      blockedBy,
      review,
    });
  }
  return result;
}

/** Wariant wyliczający score z `CriterionContext` (most do health-score). */
export function resolveStatusesFromContext(
  rules: RulesConfig,
  ctx: CriterionContext,
  reviewOf?: (key: string) => boolean
): Map<string, ModuleStatus> {
  const scoreCache = new Map<string, number>();
  const scoreOf = (key: string): number => {
    const cached = scoreCache.get(key);
    if (cached !== undefined) return cached;
    const m = rules.modules.find((x) => x.key === key);
    const score = m ? computeModuleScore(m, ctx) : 0;
    scoreCache.set(key, score);
    return score;
  };
  return resolveModuleStatuses(rules, { scoreOf, reviewOf });
}

/**
 * Moduły downstream, które po zmianie `changedKey` trafiają do „do przeglądu".
 * Źródło: krawędzie `connections` (from = changedKey) + moduły, które jawnie
 * wymagają `changedKey` w `lock.requiresUpstream`.
 */
export function downstreamOf(
  rules: RulesConfig,
  changedKey: string,
  opts: { transitive?: boolean } = {}
): string[] {
  const direct = new Set<string>();
  for (const c of rules.connections) {
    if (c.from === changedKey) direct.add(c.to);
  }
  for (const m of rules.modules) {
    if (m.lock.requiresUpstream.includes(changedKey)) direct.add(m.key);
  }
  if (!opts.transitive) return [...direct];

  const seen = new Set<string>(direct);
  const queue = [...direct];
  while (queue.length > 0) {
    const cur = queue.shift() as string;
    for (const c of rules.connections) {
      if (c.from === cur && !seen.has(c.to)) {
        seen.add(c.to);
        queue.push(c.to);
      }
    }
  }
  return [...seen];
}
