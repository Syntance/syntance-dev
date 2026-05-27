import "dotenv/config";
import { readFileSync, readdirSync } from "fs";
import path from "path";
import postgres from "postgres";

const connectionString =
  process.env.DATABASE_URL ||
  process.env.Database_DATABASE_URL_UNPOOLED ||
  process.env.Database_POSTGRES_PRISMA_URL;

if (!connectionString) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}

const sql = postgres(connectionString, { prepare: false, max: 1 });

async function run() {
  const migrationsDir = path.resolve(__dirname, "../db/migrations");
  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  for (const file of files) {
    const filePath = path.join(migrationsDir, file);
    const content = readFileSync(filePath, "utf-8");
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
    console.log(`  ✓ ${file}`);
  }

  await sql.end();
  console.log("\nDone.");
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
