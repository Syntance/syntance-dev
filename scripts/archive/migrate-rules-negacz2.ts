/**
 * Migracja zapisanych rule setĂłw (strategy_rule_sets) â€” audyt 2026-07-17:
 * health po pokryciu etapĂłw + B3 pozycjonowanie + kontrakt N5 (buyer_journey).
 *
 * deepMerge w resolve.ts nadpisuje tablicÄ™ `modules` w caĹ‚oĹ›ci, wiÄ™c zmiana
 * DEFAULT_RULES nie wystarcza â€” kaĹĽdy zapisany config trzeba zmigrowaÄ‡:
 * 1. moduĹ‚y fundament/lejek/kanaly/sprzedaz/kpi: kryteria nadpisane defaultami
 *    (dochodzÄ… journey_*_coverage i fund_positioning),
 * 2. usuwa moduĹ‚ "buyer_journey" (podrĂłĹĽ = purchase_stages, moduĹ‚ zdublowany),
 * 3. usuwa connections i presentationOrder wskazujÄ…ce na buyer_journey,
 * 4. czyĹ›ci locki `requiresUpstream` z "buyer_journey".
 * Idempotentna + backup do scripts/backups/.
 *
 * Uruchomienie: node --require ./scripts/stub-server-only.cjs --import tsx --env-file=.env.local scripts/migrate-rules-negacz2.ts
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { eq } from "drizzle-orm";
import { db } from "../../db";
import { strategyRuleSets } from "../../db/schema";
import { DEFAULT_RULES, findModuleRule } from "../../lib/strategy-hub/rules/defaults";
import { RulesConfigSchema } from "../../lib/strategy-hub/rules/types";

const COVERAGE_MODULES = ["fundament", "lejek", "kanaly", "sprzedaz", "kpi"] as const;

async function run() {
  const rows = await db.select().from(strategyRuleSets);
  if (rows.length === 0) {
    console.log("Brak rule setĂłw â€” nic do migracji.");
    process.exit(0);
  }

  const backupDir = path.resolve(__dirname, "backups");
  mkdirSync(backupDir, { recursive: true });
  const backupFile = path.join(
    backupDir,
    `rules-negacz2-${new Date().toISOString().replace(/[:.]/g, "-")}.json`
  );
  writeFileSync(backupFile, JSON.stringify(rows, null, 2), "utf8");
  console.log(`Backup: ${backupFile}`);

  let migrated = 0;
  for (const row of rows) {
    const parsed = RulesConfigSchema.safeParse(row.config);
    if (!parsed.success) {
      console.warn(`  ! scope=${row.scope}: config nie przechodzi schematu â€” pomijam`);
      continue;
    }
    const cfg = parsed.data;
    let changed = false;

    for (const key of COVERAGE_MODULES) {
      const def = findModuleRule(DEFAULT_RULES, key);
      if (!def) continue;
      const mod = cfg.modules.find((m) => m.key === key);
      if (!mod) continue;
      const sameCriteria =
        JSON.stringify(mod.criteria) === JSON.stringify(def.criteria);
      if (!sameCriteria) {
        mod.criteria = structuredClone(def.criteria);
        changed = true;
      }
    }

    const bjIdx = cfg.modules.findIndex((m) => m.key === "buyer_journey");
    if (bjIdx >= 0) {
      cfg.modules.splice(bjIdx, 1);
      changed = true;
    }

    const connBefore = cfg.connections.length;
    cfg.connections = cfg.connections.filter(
      (c) => c.from !== "buyer_journey" && c.to !== "buyer_journey"
    );
    if (cfg.connections.length !== connBefore) changed = true;

    const orderBefore = cfg.presentationOrder.length;
    cfg.presentationOrder = cfg.presentationOrder.filter(
      (k) => k !== "buyer_journey"
    );
    if (cfg.presentationOrder.length !== orderBefore) changed = true;

    for (const mod of cfg.modules) {
      const before = mod.lock.requiresUpstream.length;
      mod.lock.requiresUpstream = mod.lock.requiresUpstream.filter(
        (k) => k !== "buyer_journey"
      );
      if (mod.lock.requiresUpstream.length !== before) changed = true;
    }

    if (!changed) {
      console.log(`  = scope=${row.scope}: juĹĽ zmigrowany`);
      continue;
    }

    await db
      .update(strategyRuleSets)
      .set({ config: cfg, updatedAt: new Date() })
      .where(eq(strategyRuleSets.id, row.id));
    migrated += 1;
    console.log(`  âś“ scope=${row.scope}`);
  }

  console.log(`Zmigrowano ${migrated}/${rows.length} rule setĂłw.`);
  process.exit(0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
