import { z } from "zod";

/** Pojedyncze kryterium kompletności modułu (health-score / mapa). */
const HealthCriterionSchema = z.object({
  id: z.string(),
  label: z.string(),
  weight: z.number().min(0).max(1),
  metric: z.enum(["count_gte", "field_filled", "ratio", "custom"]),
  entity: z.string().optional(),
  target: z.number().optional(),
  field: z.string().optional(),
});

const ModuleRuleSchema = z.object({
  key: z.string(),
  label: z.string(),
  /**
   * Czy moduł ma węzeł na mapie makro. `false` = moduł tylko health-score
   * (np. discovery, brand — bez węzła na mapie, ale z kropką w sidebarze).
   */
  onMap: z.boolean().default(true),
  readyThreshold: z.number().default(80),
  inProgressThreshold: z.number().default(1),
  criteria: z.array(HealthCriterionSchema),
  lock: z
    .object({
      enabled: z.boolean().default(true),
      requiresUpstream: z.array(z.string()).default([]),
    })
    .default({ enabled: true, requiresUpstream: [] }),
  stale: z
    .object({
      enabled: z.boolean().default(true),
    })
    .default({ enabled: true }),
  visibleInClient: z.boolean().default(true),
});

const ConnectionSchema = z.object({
  from: z.string(),
  to: z.string(),
});

const CorrelationSchema = z.object({
  id: z.string(),
  sourceType: z.string(),
  targetType: z.string(),
  label: z.string(),
  defaultStrength: z.enum(["strong", "normal", "weak"]).default("normal"),
  required: z.boolean().default(false),
});

const AlertsSchema = z.object({
  kpiBelowPct: z.number().default(80),
  kpiBelowDays: z.number().default(14),
  /** Okno „brak wizyt klienta" — niezależne od `kpiBelowDays` (audyt 2026-07). */
  visitDays: z.number().default(7),
  domainExpiringDays: z.number().default(30),
  syncFailThreshold: z.number().default(3),
});

const PaletteSchema = z.record(z.string(), z.string());

export const RulesConfigSchema = z.object({
  // Wersja informacyjna (2 = po scaleniu taksonomii). Celowo `number`, nie
  // `literal`: stare zapisane configi (v1) nie mogą wywalać `resolveRules`.
  version: z.number().default(2),
  modules: z.array(ModuleRuleSchema),
  connections: z.array(ConnectionSchema),
  presentationOrder: z.array(z.string()),
  correlations: z.array(CorrelationSchema),
  alerts: AlertsSchema,
  palette: PaletteSchema,
});

export type HealthCriterion = z.infer<typeof HealthCriterionSchema>;
export type ModuleRule = z.infer<typeof ModuleRuleSchema>;
export type Connection = z.infer<typeof ConnectionSchema>;
export type Correlation = z.infer<typeof CorrelationSchema>;
export type RulesConfig = z.infer<typeof RulesConfigSchema>;
