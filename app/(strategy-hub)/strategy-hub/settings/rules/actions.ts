"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { strategyRuleSets } from "@/db/schema";
import { RulesConfigSchema, type RulesConfig } from "@/lib/strategy-hub/rules/types";
import { DEFAULT_RULES } from "@/lib/strategy-hub/rules/defaults";
import {
  getStrategyHubAccess,
  getAdminRole,
} from "@/lib/strategy-hub/context";

/** Zapis reguł tylko dla właściciela workspace (Server Action = publiczny POST). */
async function requireOwner(): Promise<void> {
  const access = await getStrategyHubAccess();
  if (!access) throw new Error("Brak dostępu");
  const role = await getAdminRole(access.session.email);
  if (role !== "owner") {
    throw new Error("Reguły strategii może zmieniać tylko właściciel workspace");
  }
}

export async function upsertRules(scope: string, config: RulesConfig) {
  await requireOwner();
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
