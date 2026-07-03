import "server-only";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import {
  projectQuestions,
  projectGlossary,
  projectCredentials,
  projectMaterials,
  projectNotes,
  projectTasks,
  segments,
  channels,
  salesPitches,
  salesScripts,
  leadMagnets,
  navItems,
  siteMaintenanceCosts,
  siteAudits,
  sites,
  pages,
  seoKeywords,
  kpis,
} from "@/db/schema";

type Row = Record<string, unknown>;

type ProjectTable =
  | typeof projectQuestions
  | typeof projectGlossary
  | typeof projectCredentials
  | typeof projectMaterials
  | typeof projectNotes
  | typeof projectTasks
  | typeof segments
  | typeof channels
  | typeof salesPitches
  | typeof salesScripts
  | typeof leadMagnets
  | typeof navItems
  | typeof siteMaintenanceCosts
  | typeof siteAudits
  | typeof sites
  | typeof pages
  | typeof seoKeywords
  | typeof kpis;

/** SELECT aktywnego wiersza po id + projectId. */
export function makeGet(table: ProjectTable) {
  return (projectId: string, itemId: string): Promise<Row | undefined> =>
    db
      .select()
      .from(table)
      .where(
        and(
          eq(table.id, itemId),
          eq(table.projectId, projectId),
          isNull(table.deletedAt)
        )
      )
      .limit(1)
      .then((rows) => rows[0] as Row | undefined);
}

/** Przywraca soft-deleted wiersz (undo delete). */
export function makeRestore(table: ProjectTable) {
  return (projectId: string, itemId: string): Promise<boolean> =>
    db
      .update(table)
      .set({ deletedAt: null })
      .where(and(eq(table.id, itemId), eq(table.projectId, projectId)))
      .returning({ id: table.id })
      .then((rows) => rows.length > 0);
}
