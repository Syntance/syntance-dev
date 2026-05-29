import { readFileSync } from "fs";
import { join } from "path";
import { db } from "@/db";
import { sql } from "drizzle-orm";

const migrationSQL = readFileSync(
  join(process.cwd(), "db/migrations/0006_workspace_owner_email.sql"),
  "utf-8"
);

async function main() {
  console.log("Uruchamiam migrację 0006_workspace_owner_email...");
  await db.execute(sql.raw(migrationSQL));
  console.log("✅ Migracja zakończona.");
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Błąd migracji:", err);
  process.exit(1);
});
