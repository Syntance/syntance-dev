import { createHash } from "node:crypto";
import {
  ENTITY_TYPE_META,
  isEntityTypeKey,
  type EntityTypeKey,
} from "@/lib/strategy-hub/entities/entity-types";

const SKIP_TYPES = new Set<EntityTypeKey>(["decision", "stage", "element", "flow"]);

const TEXT_FIELDS: Partial<Record<EntityTypeKey, string[]>> = {
  segment: [
    "name",
    "personaName",
    "jtbdMd",
    "problemMd",
    "uvpForSegmentMd",
    "demographicsMd",
  ],
  channel: ["name", "type", "description"],
  kpi: ["name", "category", "target"],
  page: ["name", "urlPath", "goal", "metaTitle", "metaDescription"],
  campaign: ["name", "goal", "stage"],
  geo: ["type", "notesMd"],
  offer: ["name", "pricingMd", "uvpMd"],
  competitor: ["name", "type", "strengthsMd", "weaknessesMd"],
  objection: ["objectionMd", "responseMd", "stage"],
  problem: ["name", "descriptionMd", "ambitionMd"],
  seo_keyword: ["phrase", "intent"],
};

function readField(row: Record<string, unknown>, key: string): string {
  const v = row[key];
  if (v === null || v === undefined) return "";
  if (typeof v === "string") return v.trim();
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return "";
}

/** Buduje tekst do embeddingu; null = pomiń indeksację. */
export function buildEmbeddingText(
  entityType: string,
  row: Record<string, unknown>
): string | null {
  if (!isEntityTypeKey(entityType)) return null;
  if (SKIP_TYPES.has(entityType)) return null;

  const meta = ENTITY_TYPE_META[entityType];
  if (!meta.registryKey) return null;
  if (meta.registryKey === "credentials") return null;

  const fields = TEXT_FIELDS[entityType];
  if (!fields || fields.length === 0) {
    const name = readField(row, "name");
    return name.length > 0 ? name : null;
  }

  const parts = fields
    .map((f) => readField(row, f))
    .filter((p) => p.length > 0);

  if (parts.length === 0) return null;
  return parts.join("\n");
}

export function contentHash(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

export function indexableEntityTypes(): EntityTypeKey[] {
  const keys: EntityTypeKey[] = [];
  for (const k of Object.keys(ENTITY_TYPE_META)) {
    if (!isEntityTypeKey(k)) continue;
    const meta = ENTITY_TYPE_META[k];
    if (!meta.registryKey || meta.registryKey === "credentials") continue;
    if (SKIP_TYPES.has(k)) continue;
    keys.push(k);
  }
  return keys;
}

export function registryKeyForType(entityType: string): string | null {
  if (!isEntityTypeKey(entityType)) return null;
  return ENTITY_TYPE_META[entityType].registryKey;
}
