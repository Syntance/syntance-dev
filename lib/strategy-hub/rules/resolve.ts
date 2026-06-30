import "server-only";
import { cache } from "react";
import { db } from "@/db";
import { strategyRuleSets } from "@/db/schema";
import { inArray } from "drizzle-orm";
import { DEFAULT_RULES } from "./defaults";
import { RulesConfigSchema, type RulesConfig } from "./types";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Głęboki merge: obiekty łączone rekursywnie, tablice i skalary nadpisywane
 * przez wyższy scope. Operuje na `unknown` — wynik waliduje `RulesConfigSchema`.
 */
export function deepMerge(base: unknown, override: unknown): unknown {
  if (override === undefined) return base;
  if (isPlainObject(base) && isPlainObject(override)) {
    const out: Record<string, unknown> = { ...base };
    for (const [key, value] of Object.entries(override)) {
      if (value === undefined) continue;
      out[key] = deepMerge(base[key], value);
    }
    return out;
  }
  return override;
}

export const resolveRules = cache(
  async (projectId?: string): Promise<RulesConfig> => {
    const scopes = projectId ? ["global", projectId] : ["global"];
    const rows = await db
      .select()
      .from(strategyRuleSets)
      .where(inArray(strategyRuleSets.scope, scopes));

    const globalConfig: unknown = rows.find((r) => r.scope === "global")?.config;
    const projectConfig: unknown = projectId
      ? rows.find((r) => r.scope === projectId)?.config
      : undefined;

    const merged = deepMerge(deepMerge(DEFAULT_RULES, globalConfig), projectConfig);
    return RulesConfigSchema.parse(merged);
  }
);
