/**
 * Uruchamia migrację 0005_strategy_paths.sql
 * Dodaje tabelę strategy_paths i kolumny path_id do tabel strategicznych.
 *
 * Użycie: npx tsx scripts/run-migration-0005.ts
 */
import { readFileSync } from "fs";
import { join } from "path";
import { db } from "@/db";
import { sql } from "drizzle-orm";

async function main() {
  const migrationPath = join(
    process.cwd(),
    "db/migrations/0005_strategy_paths.sql"
  );
  const migrationSql = readFileSync(migrationPath, "utf-8");

  // Dzielimy plik na statements po znaczniku '--> statement-breakpoint'
  const statements = migrationSql
    .split("--> statement-breakpoint")
    .map((s) => s.trim())
    .filter(Boolean);

  console.log(`Uruchamiam ${statements.length} statements...`);

  for (const statement of statements) {
    if (!statement) continue;
    try {
      await db.execute(sql.raw(statement));
      console.log("OK:", statement.slice(0, 80).replace(/\n/g, " "));
    } catch (err) {
      console.error("BŁĄD:", statement.slice(0, 80).replace(/\n/g, " "));
      console.error(err);
      process.exit(1);
    }
  }

  console.log("\n✅ Migracja 0005 zakończona.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
