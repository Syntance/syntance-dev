"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { strategyRuleSets } from "@/db/schema";
import { RulesConfigSchema, type RulesConfig } from "@/lib/strategy-hub/rules/types";
import { DEFAULT_RULES } from "@/lib/strategy-hub/rules/defaults";

export async function upsertRules(scope: string, config: RulesConfig) {
  const parsed = RulesConfigSchema.parse(config);

  await db
    .insert(strategyRuleSets)
    .values({ scope, config: parsed })
    .onConflictDoUpdate({
      target: strategyRuleSets.scope,
      set: { config: parsed, updatedAt: new Date() },
    });

  revalidatePath("/strategy-hub/settings/rules");
  revalidatePath("/strategy-hub/projects");
  return { ok: true as const };
}

export async function resetRules(scope: string) {
  return upsertRules(scope, DEFAULT_RULES);
}
