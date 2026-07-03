/**
 * Testy store relacji + parytet grafu (npx tsx --env-file=.env.local scripts/test-relations.ts).
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { db } from "../db";
import { projects, workspaces, segments, kpis } from "../db/schema";
import { eq } from "drizzle-orm";
import {
  createRelation,
  updateRelation,
  softDeleteRelation,
  getNeighbors,
  findPath,
  listRelations,
} from "../lib/strategy-hub/relations/store";
import { getRelationGraphData } from "../lib/strategy-hub/relation-graph";

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
    name: "Test relations",
    ownerId: randomUUID(),
    ownerEmail: `test-${randomUUID()}@example.com`,
  });
  await db.insert(projects).values({
    id: projectId,
    workspaceId: wsId,
    name: "Projekt test relacji",
    slug: `test-rel-${randomUUID().slice(0, 8)}`,
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
    .values({ projectId, name: "Seg test", code: "S1" })
    .returning();
  const [kpi] = await db
    .insert(kpis)
    .values({ projectId, name: "KPI test", segmentId: segment.id })
    .returning();
  const [kpi2] = await db
    .insert(kpis)
    .values({ projectId, name: "KPI orphan", segmentId: null })
    .returning();

  await test("self-loop guard", async () => {
    await assert.rejects(
      () =>
        createRelation(
          projectId,
          {
            source: { type: "segment", id: segment.id },
            target: { type: "segment", id: segment.id },
            relationType: "powiazany_z",
          },
          { source: "human" }
        ),
      /samej ze sobą/
    );
  });

  let relId = "";
  await test("create relation", async () => {
    const row = await createRelation(
      projectId,
      {
        source: { type: "segment", id: segment.id },
        target: { type: "kpi", id: kpi.id },
        relationType: "mierzony_przez",
      },
      { source: "human" }
    );
    relId = row.id;
    assert.ok(row.id);
  });

  await test("duplicate guard returns existing", async () => {
    const dup = await createRelation(
      projectId,
      {
        source: { type: "segment", id: segment.id },
        target: { type: "kpi", id: kpi.id },
        relationType: "mierzony_przez",
      },
      { source: "human" }
    );
    assert.equal(dup.id, relId);
  });

  await test("patch relation", async () => {
    const updated = await updateRelation(projectId, relId, { strength: 0.5 }, {});
    assert.equal(updated?.strength, 0.5);
  });

  await test("getNeighbors depth 1", async () => {
    const n = await getNeighbors(
      projectId,
      { type: "segment", id: segment.id },
      1
    );
    assert.ok(n.nodes.some((x) => x.type === "kpi" && x.id === kpi.id));
  });

  await test("getNeighbors depth 2 reverse", async () => {
    const n = await getNeighbors(projectId, { type: "kpi", id: kpi.id }, 1);
    assert.ok(n.nodes.some((x) => x.type === "segment" && x.id === segment.id));
  });

  await test("findPath existing", async () => {
    const path = await findPath(
      projectId,
      { type: "segment", id: segment.id },
      { type: "kpi", id: kpi.id }
    );
    assert.ok(path && path.length >= 1);
  });

  await test("findPath missing", async () => {
    const path = await findPath(
      projectId,
      { type: "segment", id: segment.id },
      { type: "kpi", id: kpi2.id }
    );
    assert.equal(path, null);
  });

  await test("softDelete", async () => {
    const ok = await softDeleteRelation(projectId, relId, {});
    assert.equal(ok, true);
    const all = await listRelations(projectId);
    assert.equal(all.length, 0);
  });

  await test("graph data builds without error", async () => {
    const data = await getRelationGraphData(projectId);
    assert.ok(data.nodes.length >= 2);
  });

  await cleanupProject(projectId);
  console.log(`\n${passed} testów relacji OK`);
  process.exit(0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
