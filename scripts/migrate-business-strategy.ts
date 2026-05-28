/**
 * Migracja: business_strategy (4 markdownów) → 5 nowych encji relacyjnych.
 *
 * Mapowanie:
 *   goalsMd       → business_problems[]  (text→problemMd, note→ambitionMd, weight→priority)
 *   uvpMd         → uvp.valueAddsJson    (cała lista jako JSON; coreUvpMd zostaje null)
 *   competitorsMd → competitors[1]       (notesMd=markdown, name="Z notatek (do podzielenia)")
 *   objectionsMd  → objections[]         (text→objectionMd, note→responseMd, weight→priority)
 *
 * Idempotencja: dla każdego projektu skipujemy migrację, jeśli choć jedna z nowych
 * encji ma już dane (zakłada się że dane były wcześniej zmigrowane lub user ręcznie dodał).
 *
 * Uruchomienie: `pnpm tsx scripts/migrate-business-strategy.ts`
 *               `pnpm tsx scripts/migrate-business-strategy.ts --dry-run`
 *               `pnpm tsx scripts/migrate-business-strategy.ts --project=<uuid>`
 */
import "dotenv/config";
import { db } from "@/db";
import {
  businessStrategy,
  businessProblems,
  uvp,
  competitors,
  objections,
} from "@/db/schema";
import { eq } from "drizzle-orm";
import { parseStrategyListItems } from "@/lib/strategy-hub/business-strategy-lists";

interface MigrationStats {
  projectId: string;
  problems: number;
  objections: number;
  uvpSet: boolean;
  competitorsBlock: boolean;
  skipped: boolean;
  reason?: string;
}

async function alreadyMigrated(projectId: string): Promise<boolean> {
  const [problemsCount, uvpRow, objectionsCount, competitorsCount] =
    await Promise.all([
      db
        .select({ id: businessProblems.id })
        .from(businessProblems)
        .where(eq(businessProblems.projectId, projectId))
        .limit(1),
      db.select().from(uvp).where(eq(uvp.projectId, projectId)).limit(1),
      db
        .select({ id: objections.id })
        .from(objections)
        .where(eq(objections.projectId, projectId))
        .limit(1),
      db
        .select({ id: competitors.id })
        .from(competitors)
        .where(eq(competitors.projectId, projectId))
        .limit(1),
    ]);
  return (
    problemsCount.length > 0 ||
    !!uvpRow[0] ||
    objectionsCount.length > 0 ||
    competitorsCount.length > 0
  );
}

async function migrateProject(
  projectId: string,
  strat: typeof businessStrategy.$inferSelect,
  dryRun: boolean
): Promise<MigrationStats> {
  const stats: MigrationStats = {
    projectId,
    problems: 0,
    objections: 0,
    uvpSet: false,
    competitorsBlock: false,
    skipped: false,
  };

  if (await alreadyMigrated(projectId)) {
    stats.skipped = true;
    stats.reason = "nowe encje już mają dane";
    return stats;
  }

  const goals = parseStrategyListItems(strat.goalsMd);
  const objectionsList = parseStrategyListItems(strat.objectionsMd);
  const uvpItems = parseStrategyListItems(strat.uvpMd);

  if (goals.length > 0 && !dryRun) {
    await db.insert(businessProblems).values(
      goals.map((item, idx) => ({
        projectId,
        problemMd: item.text,
        ambitionMd: item.note || null,
        priority: item.weight,
        orderIdx: idx,
        source: "migration",
      }))
    );
  }
  stats.problems = goals.length;

  if (objectionsList.length > 0 && !dryRun) {
    await db.insert(objections).values(
      objectionsList.map((item, idx) => ({
        projectId,
        objectionMd: item.text,
        responseMd: item.note || null,
        priority: item.weight,
        orderIdx: idx,
        status: "active",
        source: "migration",
      }))
    );
  }
  stats.objections = objectionsList.length;

  if (uvpItems.length > 0 && !dryRun) {
    await db.insert(uvp).values({
      projectId,
      valueAddsJson: JSON.stringify(uvpItems),
    });
    stats.uvpSet = true;
  }

  const competitorsMd = strat.competitorsMd?.trim();
  if (competitorsMd && !dryRun) {
    await db.insert(competitors).values({
      projectId,
      name: "Z notatek (do podzielenia)",
      notesMd: competitorsMd,
      type: "direct",
      source: "migration",
    });
    stats.competitorsBlock = true;
  } else if (competitorsMd) {
    stats.competitorsBlock = true;
  }

  return stats;
}

async function run() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const onlyProject = args.find((a) => a.startsWith("--project="))?.split("=")[1];

  console.log(
    `\n🚀 Migracja business_strategy → 5 encji relacyjnych${dryRun ? " (DRY-RUN)" : ""}`
  );
  if (onlyProject) console.log(`   Filtr: project=${onlyProject}`);

  const allRows = await db.select().from(businessStrategy);
  const rows = onlyProject
    ? allRows.filter((r) => r.projectId === onlyProject)
    : allRows;

  console.log(`\n📊 Znaleziono ${rows.length} projektów do przetworzenia.\n`);

  const all: MigrationStats[] = [];
  for (const strat of rows) {
    try {
      const stats = await migrateProject(strat.projectId, strat, dryRun);
      all.push(stats);
      const tag = stats.skipped ? "⏭️  SKIP" : dryRun ? "🔍 DRY" : "✅ DONE";
      const summary = stats.skipped
        ? stats.reason
        : `problems=${stats.problems} objections=${stats.objections} uvp=${stats.uvpSet ? "✓" : "—"} competitors=${stats.competitorsBlock ? "✓" : "—"}`;
      console.log(`${tag} ${stats.projectId}  ${summary}`);
    } catch (err) {
      console.error(`❌ FAIL ${strat.projectId}:`, err);
    }
  }

  const migrated = all.filter((s) => !s.skipped).length;
  const skipped = all.filter((s) => s.skipped).length;
  console.log(
    `\n📈 Sumarycznie: zmigrowano=${migrated} skip=${skipped} łącznie=${all.length}`
  );

  process.exit(0);
}

run().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
