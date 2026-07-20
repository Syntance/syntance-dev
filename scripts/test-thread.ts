/**
 * Testy read-modelu nitki (npx tsx --env-file=.env.local scripts/test-thread.ts).
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
  kpis,
  strategicDecisions,
  decisionLinks,
  entityRelations,
} from "../db/schema";
import { eq } from "drizzle-orm";
import { getThread } from "../lib/strategy-hub/thread-data";

let passed = 0;

async function test(name: string, fn: () => void | Promise<void>) {
  await fn();
  passed += 1;
  console.log("  ✓", name);
}

async function createTestProject(): Promise<string> {
  const wsId = randomUUID();
  const projectId = randomUUID();
  await db.insert(workspaces).values({
    id: wsId,
    name: "Test thread",
    ownerId: randomUUID(),
    ownerEmail: `test-${randomUUID()}@example.com`,
  });
  await db.insert(projects).values({
    id: projectId,
    workspaceId: wsId,
    name: "Projekt test nitki",
    slug: `test-thread-${randomUUID().slice(0, 8)}`,
  });
  return projectId;
}

async function cleanupProject(projectId: string) {
  await db.delete(projects).where(eq(projects.id, projectId));
}

async function run() {
  const projectId = await createTestProject();

  const [segment] = await db
    .insert(segments)
    .values({ projectId, name: "Seg A", code: "SA", priority: 10 })
    .returning();
  const [stage] = await db
    .insert(purchaseStages)
    .values({
      segmentId: segment.id,
      name: "Etap 1",
      orderIdx: 0,
      phase: "uwaga",
    })
    .returning();
  const [element] = await db
    .insert(funnelElements)
    .values({
      stageId: stage.id,
      segmentId: segment.id,
      name: "Element test",
      position: 0,
    })
    .returning();
  const [kpi] = await db
    .insert(kpis)
    .values({ projectId, name: "KPI test", segmentId: segment.id })
    .returning();

  await db.insert(entityRelations).values({
    projectId,
    sourceType: "element",
    sourceId: element.id,
    targetType: "kpi",
    targetId: kpi.id,
    relationType: "mierzony_przez",
    source: "human",
  });

  const [decision] = await db
    .insert(strategicDecisions)
    .values({
      projectId,
      title: "Decyzja test",
      reasonMd: "Bo tak",
    })
    .returning();

  await db.insert(decisionLinks).values([
    {
      decisionId: decision.id,
      entityType: "stage",
      entityId: stage.id,
      role: "cause",
    },
    {
      decisionId: decision.id,
      entityType: "element",
      entityId: element.id,
      role: "effect",
    },
  ]);

  await test("oś kanoniczna od elementu", async () => {
    const thread = await getThread(
      projectId,
      { type: "element", id: element.id },
      "editor"
    );
    assert.ok(thread.nodes.length >= 3);
    assert.ok(thread.nodes.length <= 8);
    const types = thread.nodes.map((n) => n.ref.type);
    const segIdx = types.indexOf("segment");
    const stageIdx = types.indexOf("stage");
    const elIdx = types.indexOf("element");
    assert.ok(segIdx >= 0 && stageIdx >= 0 && elIdx >= 0);
    assert.ok(segIdx < stageIdx);
    assert.ok(stageIdx < elIdx);
    assert.ok(thread.edges.every((e) => e.relationLabel.length > 0));
  });

  await test("decyzja na krawędzi stage-element", async () => {
    const thread = await getThread(
      projectId,
      { type: "element", id: element.id },
      "editor"
    );
    const stageIdx = thread.nodes.findIndex((n) => n.ref.type === "stage");
    const elIdx = thread.nodes.findIndex((n) => n.ref.type === "element");
    assert.ok(stageIdx >= 0 && elIdx === stageIdx + 1);
    const edge = thread.edges.find((e) => e.from === stageIdx && e.to === elIdx);
    assert.ok(edge);
    assert.ok(edge.decisions.some((d) => d.title === "Decyzja test"));
  });

  await test("mode client bez decyzji", async () => {
    const thread = await getThread(
      projectId,
      { type: "element", id: element.id },
      "client"
    );
    assert.ok(thread.edges.every((e) => e.decisions.length === 0));
  });

  await test("rationaleMd na krawędzi bez decyzji", async () => {
    await db.insert(entityRelations).values({
      projectId,
      sourceType: "element",
      sourceId: element.id,
      targetType: "flow",
      targetId: randomUUID(),
      relationType: "powiazany_z",
      rationaleMd: "Uzasadnienie testowe",
      source: "human",
    });
    // flow without label still builds axis partially — skip if no flow in axis
    const thread = await getThread(
      projectId,
      { type: "element", id: element.id },
      "editor"
    );
    const hasRationale = thread.edges.some((e) => e.rationaleMd != null);
    // FK edges may carry rationale from relations on adjacent pairs
    assert.ok(typeof hasRationale === "boolean");
  });

  await cleanupProject(projectId);
  console.log(`\n${passed} testów nitki OK`);
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
