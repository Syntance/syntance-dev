/**
 * Idempotentny seed join-tabel → entity_relations (jednorazowa migracja danych).
 * Po DROP join-tabel (0022) skrypt kończy się komunikatem — dane są już w entity_relations.
 * Użycie: npx tsx --env-file=.env.local scripts/seed-entity-relations.ts
 */
import { db } from "@/db";
import { entityRelations } from "../db/schema";
import { isNull } from "drizzle-orm";
import postgres from "postgres";
import { getDatabaseUrl } from "../lib/strategy-hub/db-url";

async function joinTablesExist(): Promise<boolean> {
  const sql = postgres(getDatabaseUrl(), { prepare: false, max: 1 });
  try {
    const rows = await sql`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'funnel_element_channels'
      ) AS exists
    `;
    return Boolean(rows[0]?.exists);
  } finally {
    await sql.end();
  }
}

type SeedRow = {
  projectId: string;
  sourceType: string;
  sourceId: string;
  targetType: string;
  targetId: string;
  relationType: string;
};

function relationKey(r: SeedRow): string {
  return [
    r.projectId,
    r.sourceType,
    r.sourceId,
    r.targetType,
    r.targetId,
    r.relationType,
  ].join("|");
}

async function loadExistingKeys(): Promise<Set<string>> {
  const rows = await db
    .select({
      projectId: entityRelations.projectId,
      sourceType: entityRelations.sourceType,
      sourceId: entityRelations.sourceId,
      targetType: entityRelations.targetType,
      targetId: entityRelations.targetId,
      relationType: entityRelations.relationType,
    })
    .from(entityRelations)
    .where(isNull(entityRelations.deletedAt));

  return new Set(rows.map(relationKey));
}

async function main() {
  if (!(await joinTablesExist())) {
    console.log("✅ Join-tabele już usunięte — seed pominięty (dane w entity_relations)");
    process.exit(0);
  }

  const sql = postgres(getDatabaseUrl(), { prepare: false, max: 1 });
  const toInsert: SeedRow[] = [];

  const channelRows = await sql`
    SELECT fe.id AS element_id, s.project_id, fec.channel_id
    FROM funnel_element_channels fec
    INNER JOIN funnel_elements fe ON fe.id = fec.funnel_element_id
    INNER JOIN purchase_stages ps ON ps.id = fe.stage_id
    INNER JOIN segments s ON s.id = ps.segment_id
    WHERE fe.deleted_at IS NULL
  `;
  for (const r of channelRows) {
    toInsert.push({
      projectId: r.project_id as string,
      sourceType: "element",
      sourceId: r.element_id as string,
      targetType: "channel",
      targetId: r.channel_id as string,
      relationType: "publikowany_w",
    });
  }

  const kpiRows = await sql`
    SELECT fe.id AS element_id, s.project_id, fek.kpi_id
    FROM funnel_element_kpis fek
    INNER JOIN funnel_elements fe ON fe.id = fek.funnel_element_id
    INNER JOIN purchase_stages ps ON ps.id = fe.stage_id
    INNER JOIN segments s ON s.id = ps.segment_id
    WHERE fe.deleted_at IS NULL
  `;
  for (const r of kpiRows) {
    toInsert.push({
      projectId: r.project_id as string,
      sourceType: "element",
      sourceId: r.element_id as string,
      targetType: "kpi",
      targetId: r.kpi_id as string,
      relationType: "mierzony_przez",
    });
  }

  const campaignRows = await sql`
    SELECT fe.id AS element_id, s.project_id, fec.campaign_id
    FROM funnel_element_campaigns fec
    INNER JOIN funnel_elements fe ON fe.id = fec.funnel_element_id
    INNER JOIN purchase_stages ps ON ps.id = fe.stage_id
    INNER JOIN segments s ON s.id = ps.segment_id
    WHERE fe.deleted_at IS NULL
  `;
  for (const r of campaignRows) {
    toInsert.push({
      projectId: r.project_id as string,
      sourceType: "element",
      sourceId: r.element_id as string,
      targetType: "campaign",
      targetId: r.campaign_id as string,
      relationType: "promowany_przez",
    });
  }

  const geoRows = await sql`
    SELECT fe.id AS element_id, s.project_id, feg.geo_asset_id
    FROM funnel_element_geo feg
    INNER JOIN funnel_elements fe ON fe.id = feg.funnel_element_id
    INNER JOIN purchase_stages ps ON ps.id = fe.stage_id
    INNER JOIN segments s ON s.id = ps.segment_id
    WHERE fe.deleted_at IS NULL
  `;
  for (const r of geoRows) {
    toInsert.push({
      projectId: r.project_id as string,
      sourceType: "element",
      sourceId: r.element_id as string,
      targetType: "geo",
      targetId: r.geo_asset_id as string,
      relationType: "wspierany_przez",
    });
  }

  const flowPageRows = await sql`
    SELECT uf.project_id, ufp.user_flow_id, ufp.page_id
    FROM user_flow_pages ufp
    INNER JOIN user_flows uf ON uf.id = ufp.user_flow_id
    WHERE uf.deleted_at IS NULL
  `;
  for (const r of flowPageRows) {
    toInsert.push({
      projectId: r.project_id as string,
      sourceType: "flow",
      sourceId: r.user_flow_id as string,
      targetType: "page",
      targetId: r.page_id as string,
      relationType: "prowadzi_przez",
    });
  }

  const offerSegRows = await sql`
    SELECT o.project_id, os.offer_id, os.segment_id
    FROM offer_segments os
    INNER JOIN offers o ON o.id = os.offer_id
    WHERE o.deleted_at IS NULL
  `;
  for (const r of offerSegRows) {
    toInsert.push({
      projectId: r.project_id as string,
      sourceType: "offer",
      sourceId: r.offer_id as string,
      targetType: "segment",
      targetId: r.segment_id as string,
      relationType: "skierowana_do",
    });
  }

  await sql.end();

  const existing = await loadExistingKeys();
  const missing = toInsert.filter((r) => !existing.has(relationKey(r)));

  if (missing.length === 0) {
    console.log("✅ Brak nowych relacji do seedowania");
    process.exit(0);
  }

  const now = new Date();
  await db.insert(entityRelations).values(
    missing.map((r) => ({
      projectId: r.projectId,
      sourceType: r.sourceType,
      sourceId: r.sourceId,
      targetType: r.targetType,
      targetId: r.targetId,
      relationType: r.relationType,
      source: "human",
      updatedAt: now,
    }))
  );

  console.log(`✅ Zaseedowano ${missing.length} relacji z join-tabel`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
