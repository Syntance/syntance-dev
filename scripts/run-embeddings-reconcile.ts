/**
 * Ręczny reconcile embeddingów (jak cron embeddings, bez HTTP).
 * Użycie: node --require ./scripts/stub-server-only.cjs --import tsx --env-file=.env.local scripts/run-embeddings-reconcile.ts
 */
import { db } from "@/db";
import { projects } from "@/db/schema";
import { isNull } from "drizzle-orm";
import { reconcileProject } from "@/lib/strategy-hub/embeddings/indexer";

async function main() {
  if (!process.env.VOYAGE_API_KEY) {
    console.error("Brak VOYAGE_API_KEY w env");
    process.exit(1);
  }

  const rows = await db
    .select({ id: projects.id, name: projects.name })
    .from(projects)
    .where(isNull(projects.deletedAt))
    .limit(50);

  let totalIndexed = 0;
  let totalSkipped = 0;

  for (const p of rows) {
    const result = await reconcileProject(p.id, { cap: 200 });
    console.log(`  ${p.name ?? p.id}: indexed=${result.indexed} skipped=${result.skipped}`);
    totalIndexed += result.indexed;
    totalSkipped += result.skipped;
  }

  console.log(
    `\n✅ Reconcile zakończony: ${rows.length} projektów, indexed=${totalIndexed}, skipped=${totalSkipped}`
  );
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
