import type { Metadata } from "next";
import {
  requireStrategyHubAccess,
  getCurrentOrganizationForAdmin,
} from "@/lib/strategy-hub/context";
import { db } from "@/db";
import { projects, notionSyncLog } from "@/db/schema";
import { and, isNull, desc, eq, inArray } from "drizzle-orm";
import { SyncDashboard, type SyncProject } from "./sync-dashboard";

export const metadata: Metadata = {
  title: "Sync z Notion",
};

/**
 * Scoped do bieżącej organizacji — bez tego widok pokazywał projekty
 * WSZYSTKICH tenantów (wyciek multi-tenant, audyt 2026-07). Log synca
 * dociągany jednym zapytaniem `DISTINCT ON` zamiast N+1 per projekt.
 */
async function getSyncProjects(organizationId: string): Promise<SyncProject[]> {
  const rows = await db
    .select({
      id: projects.id,
      name: projects.name,
      icon: projects.icon,
      notionPageUrl: projects.notionPageUrl,
    })
    .from(projects)
    .where(and(isNull(projects.deletedAt), eq(projects.organizationId, organizationId)))
    .orderBy(desc(projects.updatedAt));

  if (rows.length === 0) return [];

  const projectIds = rows.map((p) => p.id);
  const lastSyncRows = await db
    .selectDistinctOn([notionSyncLog.projectId], {
      projectId: notionSyncLog.projectId,
      direction: notionSyncLog.direction,
      status: notionSyncLog.status,
      syncedAt: notionSyncLog.syncedAt,
      error: notionSyncLog.error,
    })
    .from(notionSyncLog)
    .where(inArray(notionSyncLog.projectId, projectIds))
    .orderBy(notionSyncLog.projectId, desc(notionSyncLog.syncedAt));

  const lastSyncByProject = new Map(lastSyncRows.map((r) => [r.projectId, r]));

  return rows.map((p) => {
    const last = lastSyncByProject.get(p.id);
    return {
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
    };
  });
}

export default async function SyncPage() {
  const access = await requireStrategyHubAccess();
  const organization = await getCurrentOrganizationForAdmin(access.session.email);
  const items = await getSyncProjects(organization.id);
  return <SyncDashboard projects={items} />;
}
