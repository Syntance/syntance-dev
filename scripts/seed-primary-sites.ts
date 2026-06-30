/**
 * Idempotentny backfill primary site per projekt + przypisanie site_id.
 * Alternatywa / uzupełnienie migracji 0011_multisite.sql.
 * Użycie: npx tsx --env-file=.env.local scripts/seed-primary-sites.ts
 */
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import {
  navItems,
  pages,
  projects,
  seoKeywords,
  siteAudits,
  sites,
} from "@/db/schema";

async function ensurePrimarySite(projectId: string, name: string, domain: string | null) {
  const existing = await db
    .select({ id: sites.id })
    .from(sites)
    .where(
      and(
        eq(sites.projectId, projectId),
        eq(sites.isPrimary, true),
        isNull(sites.deletedAt)
      )
    )
    .limit(1);

  if (existing[0]) return existing[0].id;

  const [created] = await db
    .insert(sites)
    .values({
      projectId,
      name,
      domain: domain ?? undefined,
      isPrimary: true,
      status: "active",
      type: "main",
    })
    .returning({ id: sites.id });

  return created.id;
}

async function assignSiteId(
  projectId: string,
  siteId: string,
  table: typeof pages | typeof navItems | typeof seoKeywords | typeof siteAudits
) {
  await db
    .update(table)
    .set({ siteId })
    .where(and(eq(table.projectId, projectId), isNull(table.siteId)));
}

async function main() {
  const projectRows = await db
    .select({ id: projects.id, name: projects.name, domain: projects.domain })
    .from(projects)
    .where(isNull(projects.deletedAt));

  let created = 0;
  let assigned = 0;

  for (const project of projectRows) {
    const hadPrimary = await db
      .select({ id: sites.id })
      .from(sites)
      .where(
        and(
          eq(sites.projectId, project.id),
          eq(sites.isPrimary, true),
          isNull(sites.deletedAt)
        )
      )
      .limit(1);

    const siteId = await ensurePrimarySite(
      project.id,
      project.name,
      project.domain
    );

    if (!hadPrimary[0]) created += 1;

    for (const table of [pages, navItems, seoKeywords, siteAudits] as const) {
      const before = await db
        .select({ id: table.id })
        .from(table)
        .where(and(eq(table.projectId, project.id), isNull(table.siteId)));
      if (before.length > 0) {
        await assignSiteId(project.id, siteId, table);
        assigned += before.length;
      }
    }
  }

  console.log(
    `✅ Primary sites: ${created} utworzono, ${assigned} rekordów przypisano do site_id`
  );
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
