/**
 * Idempotentny seed globalnych reguł strategii (scope = 'global').
 * Użycie: npx tsx --env-file=.env.local scripts/seed-rules.ts
 */
import { db } from "@/db";
import { strategyRuleSets } from "@/db/schema";
import { DEFAULT_RULES } from "@/lib/strategy-hub/rules/defaults";

async function main() {
  await db
    .insert(strategyRuleSets)
    .values({
      scope: "global",
      config: DEFAULT_RULES,
    })
    .onConflictDoUpdate({
      target: strategyRuleSets.scope,
      set: {
        config: DEFAULT_RULES,
        updatedAt: new Date(),
      },
    });

  console.log("✅ Global strategy rules seeded (scope=global)");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
