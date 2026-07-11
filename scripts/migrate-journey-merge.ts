/**
 * Migracja danych — scalenie podwójnej taksonomii podróży zakupowej.
 *
 * buyer_journey_stages (Customer Journey) → purchase_stages (kręgosłup strategii):
 * - match po (segmentId, lower(trim(name))) → dopisuje clientDoesMd/ourActionMd/timeHint
 *   TYLKO tam, gdzie docelowe pole jest puste (idempotentne, nie nadpisuje pracy),
 * - brak matcha → insert nowego purchase_stage na końcu osi segmentu.
 * Dodatkowo backfill stage_id na campaigns/channel_activity_plan tam, gdzie
 * (segment + faza) wskazuje dokładnie JEDEN etap.
 *
 * Tabela buyer_journey_stages NIE jest usuwana (faza contract N5 — osobna decyzja).
 * Uruchomienie: node --require ./scripts/stub-server-only.cjs --import tsx --env-file=.env.local scripts/migrate-journey-merge.ts
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "../db";
import {
  buyerJourneyStages,
  purchaseStages,
  segments,
  campaigns,
  channelActivityPlan,
} from "../db/schema";

function normName(name: string): string {
  return name.trim().toLowerCase();
}

function normalizePhase(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const v = raw.toLowerCase();
  if (v.includes("tofu") || v.includes("świado")) return "TOFU";
  if (v.includes("mofu") || v.includes("rozważ")) return "MOFU";
  if (v.includes("bofu") || v.includes("decyz")) return "BOFU";
  if (v.includes("reten") || v.includes("loja")) return "retention";
  return null;
}

async function run() {
  const [buyerRows, stageRows, segmentRows] = await Promise.all([
    db.select().from(buyerJourneyStages).where(isNull(buyerJourneyStages.deletedAt)),
    db.select().from(purchaseStages).where(isNull(purchaseStages.deletedAt)),
    db.select({ id: segments.id, projectId: segments.projectId }).from(segments),
  ]);

  // Backup przed jakąkolwiek zmianą.
  const backupDir = path.resolve(__dirname, "backups");
  mkdirSync(backupDir, { recursive: true });
  const backupFile = path.join(
    backupDir,
    `journey-merge-${new Date().toISOString().replace(/[:.]/g, "-")}.json`
  );
  writeFileSync(
    backupFile,
    JSON.stringify({ buyerRows, stageRows }, null, 2),
    "utf8"
  );
  console.log(`Backup: ${backupFile}`);

  const stagesBySegment = new Map<string, (typeof stageRows)[number][]>();
  for (const s of stageRows) {
    const list = stagesBySegment.get(s.segmentId) ?? [];
    list.push(s);
    stagesBySegment.set(s.segmentId, list);
  }

  let updated = 0;
  let inserted = 0;
  let skipped = 0;

  for (const b of buyerRows) {
    const stages = stagesBySegment.get(b.segmentId) ?? [];
    const match = stages.find((s) => normName(s.name) === normName(b.name));

    if (match) {
      const patch: Partial<typeof purchaseStages.$inferInsert> = {};
      if (!match.clientDoesMd?.trim() && b.whatDoesMd?.trim())
        patch.clientDoesMd = b.whatDoesMd;
      if (!match.ourActionMd?.trim() && b.ourActionMd?.trim())
        patch.ourActionMd = b.ourActionMd;
      if (!match.timeHint?.trim() && b.timeHint?.trim())
        patch.timeHint = b.timeHint;
      if (Object.keys(patch).length === 0) {
        skipped += 1;
        continue;
      }
      await db
        .update(purchaseStages)
        .set(patch)
        .where(eq(purchaseStages.id, match.id));
      updated += 1;
    } else {
      const maxOrder = stages.reduce((m, s) => Math.max(m, s.orderIdx ?? 0), -1);
      const [row] = await db
        .insert(purchaseStages)
        .values({
          segmentId: b.segmentId,
          name: b.name,
          orderIdx: maxOrder + 1 + (b.orderIdx ?? 0),
          clientDoesMd: b.whatDoesMd,
          ourActionMd: b.ourActionMd,
          timeHint: b.timeHint,
        })
        .returning();
      stages.push(row);
      stagesBySegment.set(b.segmentId, stages);
      inserted += 1;
    }
  }

  console.log(
    `Journey merge: ${updated} zaktualizowanych, ${inserted} nowych etapów, ${skipped} bez zmian.`
  );

  // Backfill stage_id po (segmentId + znormalizowana faza), gdy wskazuje 1 etap.
  const segmentProject = new Map(segmentRows.map((s) => [s.id, s.projectId]));
  void segmentProject;

  function uniqueStageFor(segmentId: string | null, phaseRaw: string | null) {
    if (!segmentId || !phaseRaw) return null;
    const phase = normalizePhase(phaseRaw);
    if (!phase) return null;
    const candidates = (stagesBySegment.get(segmentId) ?? []).filter(
      (s) => normalizePhase(s.phase) === phase
    );
    return candidates.length === 1 ? candidates[0] : null;
  }

  const [campaignRows, planRows] = await Promise.all([
    db
      .select()
      .from(campaigns)
      .where(and(isNull(campaigns.deletedAt), isNull(campaigns.stageId))),
    db
      .select()
      .from(channelActivityPlan)
      .where(
        and(
          isNull(channelActivityPlan.deletedAt),
          isNull(channelActivityPlan.stageId)
        )
      ),
  ]);

  let campaignBackfilled = 0;
  for (const c of campaignRows) {
    const stage = uniqueStageFor(c.segmentId, c.stage);
    if (!stage) continue;
    await db.update(campaigns).set({ stageId: stage.id }).where(eq(campaigns.id, c.id));
    campaignBackfilled += 1;
  }

  let planBackfilled = 0;
  for (const p of planRows) {
    const stage = uniqueStageFor(p.segmentId, p.stage);
    if (!stage) continue;
    await db
      .update(channelActivityPlan)
      .set({ stageId: stage.id })
      .where(eq(channelActivityPlan.id, p.id));
    planBackfilled += 1;
  }

  console.log(
    `Backfill stage_id: ${campaignBackfilled} kampanii, ${planBackfilled} pozycji planu kanałów.`
  );
  console.log("Done.");
  process.exit(0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
