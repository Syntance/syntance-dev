import { z } from "zod";

/** Pojedyncze kryterium kompletności modułu (health-score / mapa). */
export const HealthCriterionSchema = z.object({
  id: z.string(),
  label: z.string(),
  weight: z.number().min(0).max(1),
  metric: z.enum(["count_gte", "field_filled", "ratio", "custom"]),
  entity: z.string().optional(),
  target: z.number().optional(),
  field: z.string().optional(),
});

export const ModuleRuleSchema = z.object({
  key: z.string(),
  label: z.string(),
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

export const ConnectionSchema = z.object({
  from: z.string(),
  to: z.string(),
});

export const CorrelationSchema = z.object({
  id: z.string(),
  sourceType: z.string(),
  targetType: z.string(),
  label: z.string(),
  defaultStrength: z.enum(["strong", "normal", "weak"]).default("normal"),
  required: z.boolean().default(false),
});

export const AlertsSchema = z.object({
  kpiBelowPct: z.number().default(80),
  kpiBelowDays: z.number().default(14),
  domainExpiringDays: z.number().default(30),
  syncFailThreshold: z.number().default(3),
});

export const PaletteSchema = z.record(z.string(), z.string());

export const RulesConfigSchema = z.object({
  version: z.literal(1),
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
export type AlertsConfig = z.infer<typeof AlertsSchema>;
export type RulesConfig = z.infer<typeof RulesConfigSchema>;
