/**
 * Migracja zapisanych rulesetów po scaleniu taksonomii modułów (Strategy Hub 2.1).
 *
 * Problem: `upsertRules` zapisuje PEŁNY snapshot configu, a `resolveRules`
 * deep-merguje go tak, że zapisana tablica `modules` NADPISUJE defaults w całości.
 * Sama zmiana `DEFAULT_RULES` nie wystarczy — trzeba przepisać wiersze
 * `strategy_rule_sets`, inaczej wracają zdublowane moduły (business/segments/…).
 *
 * Co robi:
 *  1. Backup wszystkich obecnych configów do pliku JSON.
 *  2. Usuwa z `modules` klucze health będące duplikatami kluczy mapy
 *     (business/segments/funnel/sales/website). Loguje ich nietrywialne
 *     customizacje (readyThreshold ≠ 80) do ręcznego przeglądu.
 *  3. Dokłada brakujące moduły z DEFAULT_RULES (gdyby snapshot był starszy).
 *  4. Ustawia `version = 2` i `onMap` (false dla discovery/brand).
 *  5. Waliduje `RulesConfigSchema` przed UPDATE; wiersze niewalidujące pomija.
 *
 * Idempotentna: ponowne uruchomienie na zmigrowanym configu nie zmienia nic.
 * Użycie: `npx tsx --env-file=.env.local scripts/migrate-rules-taxonomy.ts`
 */
import "dotenv/config";
import { writeFileSync } from "node:fs";
import path from "node:path";
import postgres from "postgres";
import { DEFAULT_RULES } from "../../lib/strategy-hub/rules/defaults";
import { RulesConfigSchema } from "../../lib/strategy-hub/rules/types";

const connectionString =
  process.env.DATABASE_URL ||
  process.env.DATABASE_URL_UNPOOLED ||
  process.env.Database_DATABASE_URL_UNPOOLED ||
  process.env.Database_POSTGRES_URL_NON_POOLING ||
  process.env.Database_DATABASE_URL ||
  process.env.Database_POSTGRES_PRISMA_URL;

if (!connectionString) {
  console.error("Brak URL Postgresa w env (.env.local)");
  process.exit(1);
}

/** Health-klucze scalone w klucze mapy — do usunięcia ze snapshotów. */
const REMOVED_HEALTH_KEYS = new Set([
  "business",
  "segments",
  "funnel",
  "sales",
  "website",
]);

const ONLY_HEALTH_KEYS = new Set(["discovery", "brand"]);

interface StoredModule {
  key: string;
  readyThreshold?: number;
  onMap?: boolean;
  [k: string]: unknown;
}

interface StoredConfig {
  version?: number;
  modules?: StoredModule[];
  [k: string]: unknown;
}

function migrateConfig(
  config: StoredConfig,
  scope: string
): { migrated: unknown; changed: boolean } {
  if (!Array.isArray(config.modules)) {
    // Config bez modules — tylko podbij wersję (defaults dostarczą reszty).
    return { migrated: { ...config, version: 2 }, changed: config.version !== 2 };
  }

  const kept: StoredModule[] = [];
  for (const m of config.modules) {
    if (REMOVED_HEALTH_KEYS.has(m.key)) {
      if (typeof m.readyThreshold === "number" && m.readyThreshold !== 80) {
        console.warn(
          `  ⚠ [${scope}] usunięto moduł "${m.key}" z niestandardowym readyThreshold=${m.readyThreshold} — sprawdź odpowiednik na mapie ręcznie.`
        );
      }
      continue;
    }
    kept.push({
      ...m,
      onMap: m.onMap ?? !ONLY_HEALTH_KEYS.has(m.key),
    });
  }

  // Uzupełnij moduły z DEFAULT_RULES, których snapshot nie ma (np. dodane później).
  const keptKeys = new Set(kept.map((m) => m.key));
  for (const def of DEFAULT_RULES.modules) {
    if (!keptKeys.has(def.key)) kept.push(def as unknown as StoredModule);
  }

  return { migrated: { ...config, version: 2, modules: kept }, changed: true };
}

async function main(): Promise<void> {
  const sql = postgres(connectionString as string, { prepare: false, max: 1 });
  try {
    const rows = await sql<{ scope: string; config: StoredConfig }[]>`
      SELECT scope, config FROM strategy_rule_sets
    `;

    if (rows.length === 0) {
      console.log("Brak zapisanych rulesetów — nic do migracji.");
      return;
    }

    const backupPath = path.resolve(
      process.cwd(),
      `strategy-rules-backup-${Date.now()}.json`
    );
    writeFileSync(backupPath, JSON.stringify(rows, null, 2), "utf8");
    console.log(`Backup ${rows.length} configów → ${backupPath}\n`);

    let updated = 0;
    let skipped = 0;
    for (const row of rows) {
      const { migrated, changed } = migrateConfig(row.config, row.scope);
      const parsed = RulesConfigSchema.safeParse(migrated);
      if (!parsed.success) {
        console.error(
          `  ✗ [${row.scope}] config nie przeszedł walidacji — POMINIĘTY:`,
          parsed.error.issues.slice(0, 3)
        );
        skipped += 1;
        continue;
      }
      if (!changed) {
        console.log(`  = [${row.scope}] bez zmian (już zmigrowany).`);
        continue;
      }
      await sql`
        UPDATE strategy_rule_sets
        SET config = ${sql.json(parsed.data)}, updated_at = NOW()
        WHERE scope = ${row.scope}
      `;
      console.log(`  ✓ [${row.scope}] zmigrowany.`);
      updated += 1;
    }

    console.log(`\nGotowe: ${updated} zaktualizowanych, ${skipped} pominiętych.`);
  } finally {
    await sql.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
