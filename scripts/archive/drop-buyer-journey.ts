/**
 * N5 (kontrakt): backup + DROP tabeli buyer_journey_stages.
 * Dane zostały scalone do purchase_stages 2026-07-11 (migrate-journey-merge,
 * backup w scripts/backups/journey-merge-*.json). Ten skrypt robi ŚWIEŻY backup
 * rezydualnych wierszy do scripts/backups/, po czym dropuje tabelę. Idempotentny.
 *
 * Uruchomienie: pnpm exec tsx scripts/drop-buyer-journey.ts
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { config } from "dotenv";
import pg from "pg";

config({ path: ".env.local" });
config({ path: ".env" });

/** Wykrywa URL Postgresa niezależnie od prefiksu integracji (wzorzec z run-sql.ts). */
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

async function main(): Promise<void> {
  const url = pickDbUrl();
  if (!url) throw new Error("Brak URL Postgresa w env (.env.local)");

  const client = new pg.Client({
    connectionString: url,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  try {
    const exists = await client.query(
      `SELECT 1 FROM information_schema.tables WHERE table_name = 'buyer_journey_stages'`
    );
    if (exists.rowCount === 0) {
      console.log("= buyer_journey_stages już nie istnieje — nic do zrobienia.");
      return;
    }

    const rows = await client.query(`SELECT * FROM buyer_journey_stages`);
    const backupDir = path.resolve(__dirname, "backups");
    mkdirSync(backupDir, { recursive: true });
    const backupFile = path.join(
      backupDir,
      `buyer-journey-drop-${new Date().toISOString().replace(/[:.]/g, "-")}.json`
    );
    writeFileSync(backupFile, JSON.stringify(rows.rows, null, 2), "utf8");
    console.log(`Backup ${rows.rowCount} wierszy: ${backupFile}`);

    await client.query(`DROP TABLE buyer_journey_stages`);
    console.log("✓ DROP TABLE buyer_journey_stages");
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
