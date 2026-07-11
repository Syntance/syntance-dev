import "server-only";
import { db } from "@/db";
import {
  segments,
  objections,
  funnelElements,
  purchaseStages,
  salesActivities,
  pages,
  kpis,
  strategicDecisions,
} from "@/db/schema";
import { eq, and, isNull, inArray } from "drizzle-orm";
import { resolveRules } from "./resolve";
import { reviewTablesOnChange } from "./propagate";

/** Tabele z kolumną `review_flag`, per klucz zwracany przez `reviewTablesOnChange`. */
async function markReviewByProjectId(
  key: string,
  projectId: string
): Promise<void> {
  switch (key) {
    case "segments":
      await db
        .update(segments)
        .set({ reviewFlag: true })
        .where(and(eq(segments.projectId, projectId), isNull(segments.deletedAt)));
      return;
    case "objections":
      await db
        .update(objections)
        .set({ reviewFlag: true })
        .where(and(eq(objections.projectId, projectId), isNull(objections.deletedAt)));
      return;
    case "pages":
      await db
        .update(pages)
        .set({ reviewFlag: true })
        .where(and(eq(pages.projectId, projectId), isNull(pages.deletedAt)));
      return;
    case "kpis":
      await db
        .update(kpis)
        .set({ reviewFlag: true })
        .where(and(eq(kpis.projectId, projectId), isNull(kpis.deletedAt)));
      return;
    case "strategicDecisions":
      await db
        .update(strategicDecisions)
        .set({ reviewFlag: true })
        .where(
          and(eq(strategicDecisions.projectId, projectId), isNull(strategicDecisions.deletedAt))
        );
      return;
    case "funnelElements": {
      // funnel_elements nie ma project_id bezpośrednio — scoped przez stage -> segment.
      const stageRows = await db
        .select({ id: purchaseStages.id })
        .from(purchaseStages)
        .innerJoin(segments, eq(purchaseStages.segmentId, segments.id))
        .where(and(eq(segments.projectId, projectId), isNull(purchaseStages.deletedAt)));
      const stageIds = stageRows.map((s) => s.id);
      if (stageIds.length === 0) return;
      await db
        .update(funnelElements)
        .set({ reviewFlag: true })
        .where(
          and(inArray(funnelElements.stageId, stageIds), isNull(funnelElements.deletedAt))
        );
      return;
    }
    case "salesActivities": {
      // sales_activities scoped przez stage -> segment (jak funnel_elements).
      const stageRows = await db
        .select({ id: purchaseStages.id })
        .from(purchaseStages)
        .innerJoin(segments, eq(purchaseStages.segmentId, segments.id))
        .where(and(eq(segments.projectId, projectId), isNull(purchaseStages.deletedAt)));
      const stageIds = stageRows.map((s) => s.id);
      if (stageIds.length === 0) return;
      await db
        .update(salesActivities)
        .set({ reviewFlag: true })
        .where(
          and(inArray(salesActivities.stageId, stageIds), isNull(salesActivities.deletedAt))
        );
      return;
    }
    default:
      return;
  }
}

/**
 * Propagacja „do przeglądu" (spec — Logika modułów): po zmianie encji `changedEntityKey`
 * (gotowej, nie nowo tworzonej), oznacza `review_flag = true` na wszystkich downstream
 * tabelach modułu (per `rules/propagate.ts`), w obrębie projektu.
 *
 * Świadomie best-effort: błąd tutaj nigdy nie blokuje właściwego zapisu encji
 * (ten sam wzorzec co `trackChange`).
 */
export async function applyReviewPropagation(
  projectId: string,
  changedEntityKey: string
): Promise<void> {
  try {
    const rules = await resolveRules(projectId);
    const tableKeys = reviewTablesOnChange(rules, changedEntityKey);
    if (tableKeys.length === 0) return;
    await Promise.all(tableKeys.map((key) => markReviewByProjectId(key, projectId)));
  } catch (err) {
    console.error("applyReviewPropagation failed", err);
  }
}

const CLEARABLE_TABLES = {
  segments,
  objections,
  funnelElements,
  salesActivities,
  pages,
  kpis,
  strategicDecisions,
} as const;

/** Czyści flagę „do przeglądu" na encji, którą użytkownik właśnie zapisał (uznajemy za przejrzaną). */
export async function clearReviewFlag(
  entityKey: string,
  itemId: string
): Promise<void> {
  const table = CLEARABLE_TABLES[entityKey as keyof typeof CLEARABLE_TABLES];
  if (!table) return;
  try {
    await db.update(table).set({ reviewFlag: false }).where(eq(table.id, itemId));
  } catch (err) {
    console.error("clearReviewFlag failed", err);
  }
}
