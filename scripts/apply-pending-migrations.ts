/**
 * Stosuje ręczne migracje 0010+ (poza journal drizzle — repo używa hybrydowego modelu).
 * Użycie: npx tsx --env-file=.env.local scripts/apply-pending-migrations.ts
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import postgres from "postgres";
import { config } from "dotenv";

config({ path: ".env.local" });
config({ path: ".env" });

const url =
  process.env.DATABASE_URL ||
  process.env.Database_DATABASE_URL ||
  process.env.Database_POSTGRES_URL;

if (!url) {
  throw new Error("DATABASE_URL not set");
}

const FILES = [
  "0010_strategy_rule_sets.sql",
  "0011_multisite.sql",
  "0012_decisions.sql",
  "0013_execution_entities.sql",
  "0014_comments.sql",
];

function splitStatements(sql: string): string[] {
  return sql
    .split(/--> statement-breakpoint\n?/)
    .map((s) => s.trim())
    .filter(Boolean);
}

async function main() {
  const sql = postgres(url!, { max: 1 });

  for (const file of FILES) {
    const path = join(process.cwd(), "db", "migrations", file);
    const content = readFileSync(path, "utf8");
    const statements = splitStatements(content);
    console.log(`Applying ${file} (${statements.length} statements)...`);
    for (const stmt of statements) {
      await sql.unsafe(stmt);
    }
    console.log(`✅ ${file}`);
  }

  await sql.end();
  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
