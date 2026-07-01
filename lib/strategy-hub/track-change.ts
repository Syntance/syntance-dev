import "server-only";
import { db } from "@/db";
import { changeHistory } from "@/db/schema";

/**
 * Mapowanie klucza encji z registry (liczba mnoga) na `entityType`
 * zapisywany w `change_history` (liczba pojedyncza).
 *
 * Konsumenci (alerts.ts, EntityMetaPanel, LastUpdateBadge) filtrują po
 * tej liczbie pojedynczej — np. alerty KPI szukają `entityType = "kpi"`.
 */
const ENTITY_TYPE_MAP: Record<string, string> = {
  kpis: "kpi",
  segments: "segment",
  channels: "channel",
  campaigns: "campaign",
  objections: "objection",
  problems: "problem",
  pages: "page",
  sites: "site",
  offers: "offer",
  "seo-keywords": "seo_keyword",
  "sales-pitches": "sales_pitch",
  "sales-scripts": "sales_script",
  "lead-magnets": "lead_magnet",
  "geo-assets": "geo_asset",
  "geo-queries": "geo_query",
};

/** Zwraca `entityType` (l. poj.) dla klucza encji z registry. */
export function entityTypeFor(entityKey: string): string {
  return ENTITY_TYPE_MAP[entityKey] ?? entityKey;
}

/** Pola czysto techniczne — nie zapisujemy ich do historii. */
const IGNORED_FIELDS = new Set(["updatedAt", "createdAt", "orderIdx"]);
const MAX_FIELDS = 12;

function serializeValue(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

/**
 * Zapisuje wpisy audytu (jeden na zmienione pole) do `change_history`.
 * Cicho ignoruje błędy — audyt nie może wywrócić właściwego zapisu encji.
 */
export async function trackChange(params: {
  projectId: string | null | undefined;
  entityType: string;
  entityId: string;
  patch: Record<string, unknown>;
  source?: string;
  userId?: string | null;
}): Promise<void> {
  const {
    projectId,
    entityType,
    entityId,
    patch,
    source = "hub",
    userId = null,
  } = params;

  if (!projectId) return;

  const fields = Object.entries(patch)
    .filter(([key, value]) => !IGNORED_FIELDS.has(key) && value !== undefined)
    .slice(0, MAX_FIELDS);

  if (fields.length === 0) return;

  try {
    await db.insert(changeHistory).values(
      fields.map(([field, value]) => ({
        projectId,
        entityType,
        entityId,
        field,
        oldValue: null,
        newValue: serializeValue(value),
        source,
        userId,
      }))
    );
  } catch (err) {
    console.error("trackChange failed", err);
  }
}
