/**
 * Uruchamia plik .sql względem bazy z .env.local (DATABASE_URL_UNPOOLED preferowany dla DDL).
 * Użycie: `pnpm exec tsx scripts/run-sql.ts <ścieżka.sql>`
 * Konwencja repo: migracje są idempotentne (IF NOT EXISTS / DO $$ EXCEPTION), więc bezpieczne do powtórzeń.
 */
import { readFileSync } from "node:fs";
import { config } from "dotenv";
import pg from "pg";

config({ path: ".env.local" });
config({ path: ".env" });

/** Wykrywa URL Postgresa niezależnie od prefiksu integracji (Neon/Vercel dają np. Database_*). */
function pickDbUrl(): string | undefined {
  const e = process.env;
  const preferred = [
    e.DATABASE_URL_UNPOOLED,
    e.POSTGRES_URL_NON_POOLING,
    e.Database_DATABASE_URL_UNPOOLED,
    e.Database_POSTGRES_URL_NON_POOLING,
    e.DATABASE_URL,
    e.POSTGRES_URL,
    e.Database_DATABASE_URL,
    e.Database_POSTGRES_URL,
  ].filter((v): v is string => typeof v === "string" && v.length > 0);
  if (preferred.length > 0) return preferred[0];
  const candidates = Object.entries(e).filter(
    ([, v]) => typeof v === "string" && v.startsWith("postgres")
  ) as [string, string][];
  const unpooled = candidates.find(([k]) => /UNPOOLED|NON_POOLING/i.test(k));
  return (unpooled ?? candidates[0])?.[1];
}

const url = pickDbUrl();
if (!url) throw new Error("Brak URL Postgresa w env (.env.local)");

const file = process.argv[2];
if (!file) throw new Error("Użycie: run-sql.ts <plik.sql>");

const sql = readFileSync(file, "utf8");

async function main(): Promise<void> {
  const client = new pg.Client({
    connectionString: url,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  try {
    const res = await client.query(sql);
    const results = Array.isArray(res) ? res : [res];
    for (const r of results) {
      if (r && "rows" in r && r.rows.length > 0) console.table(r.rows);
    }
    console.log("✓ wykonano:", file);
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
