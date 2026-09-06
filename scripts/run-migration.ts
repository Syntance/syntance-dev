import "dotenv/config";
import { readFileSync, readdirSync } from "fs";
import path from "path";
import postgres from "postgres";

/**
 * Runner migracji z rejestrem zastosowanych plików (`schema_migrations`).
 *
 * DLACZEGO REJESTR: wcześniejsza wersja odtwarzała WSZYSTKIE pliki przy każdym
 * uruchomieniu, opierając się na `IF NOT EXISTS` i połykaniu błędów „already
 * exists". To działa dla `CREATE`, ale uniemożliwia jakąkolwiek migrację
 * nieidempotentną — `ALTER TABLE … RENAME TO`, `DROP COLUMN`, backfill danych —
 * bo drugi przebieg wywraca się na nieistniejącym obiekcie. Migracja 0030
 * (workspaces → organizations) jest dokładnie takim przypadkiem.
 *
 * BOOTSTRAP DLA ISTNIEJĄCEJ BAZY: przy pierwszym uruchomieniu po tej zmianie
 * rejestru jeszcze nie ma. Jeśli baza jest niepusta (istnieje `projects`),
 * oznaczamy migracje historyczne (≤ LEGACY_CUTOFF) jako już zastosowane —
 * bo faktycznie są. Świeża baza dostaje pusty rejestr i wykonuje wszystko.
 */

const connectionString =
  process.env.DATABASE_URL ||
  process.env.Database_DATABASE_URL_UNPOOLED ||
  process.env.Database_POSTGRES_PRISMA_URL;

if (!connectionString) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}

/** Ostatnia migracja sprzed wprowadzenia rejestru. */
const LEGACY_CUTOFF = "0029";

const sql = postgres(connectionString, { prepare: false, max: 1 });

function migrationNumber(file: string): string {
  return file.slice(0, 4);
}

async function ensureLedger(files: string[]): Promise<void> {
  const existed = await sql`SELECT to_regclass('public.schema_migrations') AS t`;
  const ledgerExists = existed[0]?.t !== null;

  await sql`
    CREATE TABLE IF NOT EXISTS "schema_migrations" (
      "filename" text PRIMARY KEY,
      "applied_at" timestamptz NOT NULL DEFAULT now()
    )
  `;

  if (ledgerExists) return;

  const probe = await sql`SELECT to_regclass('public.projects') AS t`;
  const databaseIsNotEmpty = probe[0]?.t !== null;

  if (!databaseIsNotEmpty) {
    console.log("Rejestr utworzony, baza pusta — wykonuję wszystkie migracje.");
    return;
  }

  const legacy = files.filter((f) => migrationNumber(f) <= LEGACY_CUTOFF);
  for (const file of legacy) {
    await sql`
      INSERT INTO "schema_migrations" ("filename") VALUES (${file})
      ON CONFLICT DO NOTHING
    `;
  }
  console.log(
    `Rejestr utworzony; oznaczono ${legacy.length} migracji historycznych (≤ ${LEGACY_CUTOFF}) jako zastosowane.`
  );
}

async function run() {
  const migrationsDir = path.resolve(__dirname, "../db/migrations");
  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  await ensureLedger(files);

  const appliedRows = await sql<{ filename: string }[]>`
    SELECT "filename" FROM "schema_migrations"
  `;
  const applied = new Set(appliedRows.map((r) => r.filename));

  let ran = 0;
  for (const file of files) {
    if (applied.has(file)) {
      console.log(`skip (zastosowana): ${file}`);
      continue;
    }

    const content = readFileSync(path.join(migrationsDir, file), "utf-8");
    console.log(`\nRunning ${file}…`);
    const statements = content
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    for (const stmt of statements) {
      try {
        await sql.unsafe(stmt);
      } catch (e: unknown) {
        const err = e as { code?: string; message?: string };
        if (err.code === "42P07" || err.message?.includes("already exists")) {
          console.log(`  skip (already exists): ${stmt.slice(0, 60)}…`);
        } else {
          console.error(`  FAIL: ${stmt.slice(0, 100)}…`);
          console.error(`  ${err.message}`);
          throw e;
        }
      }
    }

    await sql`
      INSERT INTO "schema_migrations" ("filename") VALUES (${file})
      ON CONFLICT DO NOTHING
    `;
    ran += 1;
    console.log(`  ✓ ${file}`);
  }

  await sql.end();
  console.log(`\nDone. Wykonano ${ran} nowych migracji.`);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
