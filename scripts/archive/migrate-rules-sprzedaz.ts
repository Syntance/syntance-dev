/**
 * Migracja zapisanych rule setĂłw (strategy_rule_sets) â€” obszar â€žsprzedaz".
 *
 * deepMerge w resolve.ts nadpisuje tablicÄ™ `modules` w caĹ‚oĹ›ci, wiÄ™c zmiana
 * DEFAULT_RULES nie wystarcza â€” kaĹĽdy zapisany config trzeba zmigrowaÄ‡:
 * 1. dodaje moduĹ‚ "sprzedaz" (jeĹ›li brak) po "przekaz",
 * 2. kryterium buyer_journey: buyerJourneyStages â†’ purchaseStages (scalenie taksonomii),
 * 3. presentationOrder: wstawia "sprzedaz" po "przekaz" (jeĹ›li brak),
 * 4. connections: lejekâ†’sprzedaz i sprzedazâ†’kpi (jeĹ›li brak).
 * Idempotentna + backup do scripts/backups/.
 *
 * Uruchomienie: node --require ./scripts/stub-server-only.cjs --import tsx --env-file=.env.local scripts/migrate-rules-sprzedaz.ts
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { eq } from "drizzle-orm";
import { db } from "../../db";
import { strategyRuleSets } from "../../db/schema";
import { DEFAULT_RULES, findModuleRule } from "../../lib/strategy-hub/rules/defaults";
import { RulesConfigSchema } from "../../lib/strategy-hub/rules/types";

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
    `rules-sprzedaz-${new Date().toISOString().replace(/[:.]/g, "-")}.json`
  );
  writeFileSync(backupFile, JSON.stringify(rows, null, 2), "utf8");
  console.log(`Backup: ${backupFile}`);

  const defaultSprzedaz = findModuleRule(DEFAULT_RULES, "sprzedaz");
  if (!defaultSprzedaz) throw new Error("DEFAULT_RULES nie ma moduĹ‚u sprzedaz");

  let migrated = 0;
  for (const row of rows) {
    const parsed = RulesConfigSchema.safeParse(row.config);
    if (!parsed.success) {
      console.warn(`  ! scope=${row.scope}: config nie przechodzi schematu â€” pomijam`);
      continue;
    }
    const cfg = parsed.data;
    let changed = false;

    if (!cfg.modules.some((m) => m.key === "sprzedaz")) {
      const idx = cfg.modules.findIndex((m) => m.key === "przekaz");
      cfg.modules.splice(idx >= 0 ? idx + 1 : cfg.modules.length, 0, {
        ...defaultSprzedaz,
      });
      changed = true;
    }

    const buyerJourney = cfg.modules.find((m) => m.key === "buyer_journey");
    if (buyerJourney) {
      for (const c of buyerJourney.criteria) {
        if (c.entity === "buyerJourneyStages") {
          c.entity = "purchaseStages";
          c.label = "â‰Ą1 etap podrĂłĹĽy zakupowej";
          changed = true;
        }
      }
    }

    if (!cfg.presentationOrder.includes("sprzedaz")) {
      const idx = cfg.presentationOrder.indexOf("przekaz");
      cfg.presentationOrder.splice(
        idx >= 0 ? idx + 1 : cfg.presentationOrder.length,
        0,
        "sprzedaz"
      );
      changed = true;
    }

    for (const conn of [
      { from: "lejek", to: "sprzedaz" },
      { from: "sprzedaz", to: "kpi" },
    ]) {
      if (!cfg.connections.some((c) => c.from === conn.from && c.to === conn.to)) {
        cfg.connections.push(conn);
        changed = true;
      }
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
