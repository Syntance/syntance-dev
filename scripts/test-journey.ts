/**
 * Testy logiki Negacza: gap engine podróży zakupowej (getJourneyView),
 * wiersz SPRZEDAŻ blueprintu, sales-board i konfiguracja journeyCoverage.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { db } from "../db";
import {
  projects,
  workspaces,
  segments,
  purchaseStages,
  funnelElements,
  salesActivities,
  salesPitches,
  entityRelations,
} from "../db/schema";
import { eq, sql } from "drizzle-orm";
import { getJourneyView } from "../lib/strategy-hub/journey-data";
import { getBlueprint } from "../lib/strategy-hub/blueprint-data";
import { getSalesBoard } from "../lib/strategy-hub/sales-board-data";
import { DEFAULT_RULES, findModuleRule } from "../lib/strategy-hub/rules/defaults";
import { RulesConfigSchema } from "../lib/strategy-hub/rules/types";
import { reviewTablesOnChange } from "../lib/strategy-hub/rules/propagate";

let passed = 0;

async function test(name: string, fn: () => void | Promise<void>) {
  await fn();
  passed += 1;
  console.log("  ✓", name);
}

async function run() {
  const wsId = randomUUID();
  const projectId = randomUUID();
  await db.insert(workspaces).values({
    id: wsId,
    name: "Test journey",
    ownerId: randomUUID(),
    ownerEmail: `test-${randomUUID()}@example.com`,
  });
  await db.insert(projects).values({
    id: projectId,
    workspaceId: wsId,
    name: "Projekt journey",
    slug: `test-jr-${randomUUID().slice(0, 8)}`,
  });

  const [segment] = await db
    .insert(segments)
    .values({ projectId, name: "Segment N", code: "N", priority: 5 })
    .returning();

  // Trzy etapy: marketingowy → wspólny → sprzedażowy (retencja, ostatni).
  const [stage0] = await db
    .insert(purchaseStages)
    .values({
      segmentId: segment.id,
      name: "Uświadomienie",
      orderIdx: 0,
      ownerSide: "marketing",
      questions: "Dlaczego to boli?",
    })
    .returning();
  const [stage1] = await db
    .insert(purchaseStages)
    .values({
      segmentId: segment.id,
      name: "Porównanie ofert",
      orderIdx: 1,
      ownerSide: "shared",
    })
    .returning();
  const [stage2] = await db
    .insert(purchaseStages)
    .values({
      segmentId: segment.id,
      name: "Lojalność",
      orderIdx: 2,
      phase: "retencja",
      ownerSide: "sales",
      exitCriterion: "Odnowienie umowy",
    })
    .returning();

  const [element] = await db
    .insert(funnelElements)
    .values({
      stageId: stage0.id,
      segmentId: segment.id,
      name: "Artykuł edukacyjny",
      position: 0,
    })
    .returning();

  const channelRows = await db.execute<{ id: string }>(
    sql`INSERT INTO channels (project_id, workspace_id, name) VALUES (${projectId}::uuid, ${wsId}::uuid, 'LinkedIn') RETURNING id`
  );
  const channelId = channelRows[0]?.id;
  assert.ok(channelId);

  await db.insert(entityRelations).values([
    {
      projectId,
      sourceType: "element",
      sourceId: element.id,
      targetType: "channel",
      targetId: channelId,
      relationType: "publikowany_w",
      source: "human",
    },
    {
      projectId,
      sourceType: "element",
      sourceId: element.id,
      targetType: "stage",
      targetId: stage1.id,
      relationType: "prowadzi_do_etapu",
      source: "human",
    },
  ]);

  const [activity] = await db
    .insert(salesActivities)
    .values({ stageId: stage1.id, name: "Discovery call", type: "discovery" })
    .returning();

  const [pitch] = await db
    .insert(salesPitches)
    .values({ projectId, title: "Pitch wartości", segmentId: segment.id })
    .returning();
  await db.insert(entityRelations).values({
    projectId,
    sourceType: "sales_pitch",
    sourceId: pitch.id,
    targetType: "stage",
    targetId: stage1.id,
    relationType: "uzywany_w_etapie",
    source: "human",
  });

  try {
    await test("journeyCoverage: defaulty konfiguracji reguł", () => {
      const parsed = RulesConfigSchema.parse({
        version: 2,
        modules: [],
        connections: [],
        presentationOrder: [],
        correlations: [],
        alerts: {},
        palette: {},
      });
      assert.equal(parsed.journeyCoverage.requireContent, true);
      assert.equal(parsed.journeyCoverage.retentionSkipsChannel, true);
    });

    await test("DEFAULT_RULES ma moduł sprzedaz z lockiem segmenty+lejek", () => {
      const mod = findModuleRule(DEFAULT_RULES, "sprzedaz");
      assert.ok(mod);
      assert.deepEqual(mod?.lock.requiresUpstream, ["segmenty", "lejek"]);
      assert.ok(DEFAULT_RULES.presentationOrder.includes("sprzedaz"));
    });

    await test("buyer_journey liczy purchaseStages (scalona taksonomia)", () => {
      const mod = findModuleRule(DEFAULT_RULES, "buyer_journey");
      assert.equal(mod?.criteria[0]?.entity, "purchaseStages");
    });

    const view = await getJourneyView(projectId, segment.id);

    await test("getJourneyView: etapy w kolejności orderIdx", () => {
      assert.deepEqual(
        view.stages.map((s) => s.name),
        ["Uświadomienie", "Porównanie ofert", "Lojalność"]
      );
    });

    await test("etap marketingowy: content/kanał/wyjście OK, sprzedaż niewymagana", () => {
      const s0 = view.stages[0];
      const cov = Object.fromEntries(s0.coverage.map((c) => [c.key, c]));
      assert.equal(cov.content.ok, true);
      assert.equal(cov.channel.ok, true);
      assert.equal(cov.exit.ok, true);
      assert.equal(cov.sales.required, false);
      assert.equal(cov.kpi.ok, false);
      assert.equal(cov.kpi.required, true);
    });

    await test("etap wspólny: akcja sprzedażowa liczy się do pokrycia", () => {
      const s1 = view.stages[1];
      const cov = Object.fromEntries(s1.coverage.map((c) => [c.key, c]));
      assert.equal(cov.sales.ok, true);
      assert.equal(cov.sales.required, true);
      assert.equal(cov.content.ok, false);
    });

    await test("retencja + ostatni etap: kanał i wyjście niewymagane", () => {
      const s2 = view.stages[2];
      const cov = Object.fromEntries(s2.coverage.map((c) => [c.key, c]));
      assert.equal(cov.channel.required, false);
      assert.equal(cov.exit.required, false);
      assert.equal(cov.sales.required, true);
      assert.equal(cov.sales.ok, false);
    });

    await test("gapCount sumuje wymagane braki", () => {
      const expected = view.stages
        .flatMap((s) => s.coverage)
        .filter((c) => c.required && !c.ok).length;
      assert.equal(view.gapCount, expected);
      assert.ok(view.gapCount > 0);
    });

    const blueprint = await getBlueprint(projectId, segment.id, "editor");

    await test("blueprint: komórka SPRZEDAŻ ma akcję i przypięty pitch", () => {
      const col1 = blueprint.columns.find((c) => c.stage.id === stage1.id);
      assert.ok(col1);
      const labels = col1!.cells.sprzedaz.map((i) => i.label);
      assert.ok(labels.includes("Discovery call"));
      assert.ok(labels.includes("Pitch wartości"));
    });

    await test("blueprint: etap marketingowy bez luki sprzedaż, sales-owned z luką", () => {
      const col0 = blueprint.columns.find((c) => c.stage.id === stage0.id);
      const col2 = blueprint.columns.find((c) => c.stage.id === stage2.id);
      assert.ok(col0 && col2);
      assert.equal(col0!.gaps.includes("sprzedaz"), false);
      assert.equal(col2!.gaps.includes("sprzedaz"), true);
    });

    const board = await getSalesBoard(projectId, segment.id);

    await test("sales-board: akcje, materiały i biblioteka", () => {
      assert.equal(board.stages.length, 3);
      assert.equal(
        board.activities.find((a) => a.id === activity.id)?.stageId,
        stage1.id
      );
      const att = board.attachments.find((a) => a.id === pitch.id);
      assert.equal(att?.stageId, stage1.id);
      assert.equal(att?.type, "sales_pitch");
      assert.ok(board.library.some((l) => l.type === "sales_pitch"));
    });

    await test("propagacja: zmiana etapu flaguje elementy i akcje sprzedażowe", () => {
      const tables = reviewTablesOnChange(DEFAULT_RULES, "purchase-stages");
      assert.ok(tables.includes("funnelElements"));
      assert.ok(tables.includes("salesActivities"));
    });

    await test("propagacja: sales-activities → downstream kpi", () => {
      const tables = reviewTablesOnChange(DEFAULT_RULES, "sales-activities");
      assert.ok(tables.includes("kpis"));
    });
  } finally {
    await db.delete(projects).where(eq(projects.id, projectId));
    await db.delete(workspaces).where(eq(workspaces.id, wsId));
  }

  console.log(`\ntest-journey: ${passed} testów OK`);
  process.exit(0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
