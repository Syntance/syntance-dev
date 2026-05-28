import type { Metadata } from "next";
import { requireStrategyHubAccess } from "@/lib/strategy-hub/context";
import { db } from "@/db";
import { projects, notionSyncLog } from "@/db/schema";
import { isNull, desc, eq } from "drizzle-orm";
import { SyncDashboard, type SyncProject } from "./sync-dashboard";

export const metadata: Metadata = {
  title: "Sync z Notion",
};

async function getSyncProjects(): Promise<SyncProject[]> {
  const rows = await db
    .select({
      id: projects.id,
      name: projects.name,
      icon: projects.icon,
      notionPageUrl: projects.notionPageUrl,
    })
    .from(projects)
    .where(isNull(projects.deletedAt))
    .orderBy(desc(projects.updatedAt));

  const result: SyncProject[] = [];
  for (const p of rows) {
    const [last] = await db
      .select({
        direction: notionSyncLog.direction,
        status: notionSyncLog.status,
        syncedAt: notionSyncLog.syncedAt,
        error: notionSyncLog.error,
      })
      .from(notionSyncLog)
      .where(eq(notionSyncLog.projectId, p.id))
      .orderBy(desc(notionSyncLog.syncedAt))
      .limit(1);

    result.push({
      id: p.id,
      name: p.name,
      icon: p.icon,
      hasNotionPage: Boolean(p.notionPageUrl),
      lastSync: last
        ? {
            direction: last.direction ?? "—",
            status: last.status ?? "—",
            syncedAt: last.syncedAt?.toISOString() ?? null,
            error: last.error,
          }
        : null,
    });
  }
  return result;
}

export default async function SyncPage() {
  await requireStrategyHubAccess();
  const items = await getSyncProjects();
  return <SyncDashboard projects={items} />;
}
