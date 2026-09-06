"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { strategyRuleSets } from "@/db/schema";
import { RulesConfigSchema, type RulesConfig } from "@/lib/strategy-hub/rules/types";
import { DEFAULT_RULES } from "@/lib/strategy-hub/rules/defaults";
import {
  getStrategyHubAccess,
  getCurrentOrganizationForAdmin,
  getOrganizationRole,
  getProjectForAdmin,
} from "@/lib/strategy-hub/context";

/**
 * Zakres zestawu reguł: „global" = domyślne reguły agencji (jeden wspólny
 * wiersz, tabela nie ma kolumny organizacyjnej), inaczej identyfikator
 * projektu — override nadpisujący reguły agencji.
 */
const ScopeSchema = z.union([z.literal("global"), z.string().uuid()]);

/**
 * Zapis reguł tylko dla właściciela BIEŻĄCEJ organizacji
 * (Server Action = publiczny POST, więc autoryzacja musi być tutaj).
 * Rola pochodzi wyłącznie z `organizationMembers` — brak wiersza = brak dostępu.
 */
async function requireOwnerOrganization(): Promise<{
  email: string;
  organizationId: string;
}> {
  const access = await getStrategyHubAccess();
  if (!access) throw new Error("Brak dostępu");

  const email = access.session.email;
  const organization = await getCurrentOrganizationForAdmin(email);
  const role = await getOrganizationRole(email, organization.id);
  if (role !== "owner") {
    throw new Error(
      "Reguły strategii może zmieniać tylko właściciel organizacji"
    );
  }

  return { email, organizationId: organization.id };
}

export async function upsertRules(scope: string, config: RulesConfig) {
  const { email, organizationId } = await requireOwnerOrganization();
  const parsedScope = ScopeSchema.parse(scope);

  // Override na projekt tylko dla projektu z bieżącej organizacji — rola
  // „owner" nie daje dostępu do projektów innych organizacji.
  if (parsedScope !== "global") {
    const project = await getProjectForAdmin(parsedScope, email);
    if (!project || project.organizationId !== organizationId) {
      throw new Error("Brak dostępu do projektu");
    }
  }

  const parsed = RulesConfigSchema.parse(config);

  await db
    .insert(strategyRuleSets)
    .values({ scope: parsedScope, config: parsed })
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
