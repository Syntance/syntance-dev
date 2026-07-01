import "server-only";
import { db } from "@/db";
import { elementVisibility } from "@/db/schema";
import { and, eq, isNull } from "drizzle-orm";

export type VisibilityStatus = "visible" | "hidden" | "in_progress";
export type VisibilityOverride = "hidden" | "in_progress";
export type VisibilityScope = "module" | "record";

/** Klucze modułów strategii — używane dla scope="module". */
export const MODULE_KEYS = [
  "discovery",
  "brand",
  "business",
  "segments",
  "funnel",
  "sales",
  "marketing",
  "website",
  "kpi",
  "audit",
] as const;
export type ModuleKey = (typeof MODULE_KEYS)[number];

export interface ProjectVisibility {
  /** moduleKey → override (brak klucza = visible) */
  modules: Record<string, VisibilityOverride>;
  /** entityType → { recordId → override } (brak = visible) */
  records: Record<string, Record<string, VisibilityOverride>>;
}

/**
 * Czyta wszystkie nadpisania widoczności projektu i buduje strukturę
 * do szybkiego sprawdzania. Brak wiersza = element widoczny.
 */
export async function getProjectVisibility(
  projectId: string
): Promise<ProjectVisibility> {
  const rows = await db
    .select()
    .from(elementVisibility)
    .where(eq(elementVisibility.projectId, projectId));

  const modules: Record<string, VisibilityOverride> = {};
  const records: Record<string, Record<string, VisibilityOverride>> = {};

  for (const r of rows) {
    const status = r.status as VisibilityOverride;
    if (status !== "hidden" && status !== "in_progress") continue;
    if (r.scope === "module") {
      modules[r.entityType] = status;
    } else if (r.scope === "record" && r.entityId) {
      (records[r.entityType] ??= {})[r.entityId] = status;
    }
  }

  return { modules, records };
}

/** Odczytuje status modułu (domyślnie visible). */
export function moduleStatus(
  vis: ProjectVisibility,
  moduleKey: string
): VisibilityStatus {
  return vis.modules[moduleKey] ?? "visible";
}

/** Odczytuje status rekordu (domyślnie visible). */
export function recordStatus(
  vis: ProjectVisibility,
  entityType: string,
  recordId: string
): VisibilityStatus {
  return vis.records[entityType]?.[recordId] ?? "visible";
}

interface SetVisibilityInput {
  projectId: string;
  scope: VisibilityScope;
  entityType: string;
  entityId?: string | null;
  status: VisibilityStatus;
  updatedBy?: string | null;
}

/**
 * Ustawia widoczność elementu. status="visible" kasuje nadpisanie
 * (powrót do domyślnej widoczności). W przeciwnym razie upsert.
 */
export async function setVisibility(input: SetVisibilityInput): Promise<void> {
  const { projectId, scope, entityType, status } = input;
  const entityId = input.entityId ?? null;

  const whereClause = and(
    eq(elementVisibility.projectId, projectId),
    eq(elementVisibility.scope, scope),
    eq(elementVisibility.entityType, entityType),
    entityId === null
      ? isNull(elementVisibility.entityId)
      : eq(elementVisibility.entityId, entityId)
  );

  if (status === "visible") {
    await db.delete(elementVisibility).where(whereClause);
    return;
  }

  const existing = await db
    .select({ id: elementVisibility.id })
    .from(elementVisibility)
    .where(whereClause)
    .limit(1);

  if (existing[0]) {
    await db
      .update(elementVisibility)
      .set({ status, updatedAt: new Date(), updatedBy: input.updatedBy ?? null })
      .where(eq(elementVisibility.id, existing[0].id));
  } else {
    await db.insert(elementVisibility).values({
      projectId,
      scope,
      entityType,
      entityId,
      status,
      updatedBy: input.updatedBy ?? null,
    });
  }
}
