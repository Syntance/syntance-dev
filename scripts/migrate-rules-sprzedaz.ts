/**
 * Migracja zapisanych rule setów (strategy_rule_sets) — obszar „sprzedaz".
 *
 * deepMerge w resolve.ts nadpisuje tablicę `modules` w całości, więc zmiana
 * DEFAULT_RULES nie wystarcza — każdy zapisany config trzeba zmigrować:
 * 1. dodaje moduł "sprzedaz" (jeśli brak) po "przekaz",
 * 2. kryterium buyer_journey: buyerJourneyStages → purchaseStages (scalenie taksonomii),
 * 3. presentationOrder: wstawia "sprzedaz" po "przekaz" (jeśli brak),
 * 4. connections: lejek→sprzedaz i sprzedaz→kpi (jeśli brak).
 * Idempotentna + backup do scripts/backups/.
 *
 * Uruchomienie: node --require ./scripts/stub-server-only.cjs --import tsx --env-file=.env.local scripts/migrate-rules-sprzedaz.ts
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { strategyRuleSets } from "../db/schema";
import { DEFAULT_RULES, findModuleRule } from "../lib/strategy-hub/rules/defaults";
import { RulesConfigSchema } from "../lib/strategy-hub/rules/types";

async function run() {
  const rows = await db.select().from(strategyRuleSets);
  if (rows.length === 0) {
    console.log("Brak rule setów — nic do migracji.");
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
  if (!defaultSprzedaz) throw new Error("DEFAULT_RULES nie ma modułu sprzedaz");

  let migrated = 0;
  for (const row of rows) {
    const parsed = RulesConfigSchema.safeParse(row.config);
    if (!parsed.success) {
      console.warn(`  ! scope=${row.scope}: config nie przechodzi schematu — pomijam`);
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
          c.label = "≥1 etap podróży zakupowej";
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
      console.log(`  = scope=${row.scope}: już zmigrowany`);
      continue;
    }

    await db
      .update(strategyRuleSets)
      .set({ config: cfg, updatedAt: new Date() })
      .where(eq(strategyRuleSets.id, row.id));
    migrated += 1;
    console.log(`  ✓ scope=${row.scope}`);
  }

  console.log(`Zmigrowano ${migrated}/${rows.length} rule setów.`);
  process.exit(0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
