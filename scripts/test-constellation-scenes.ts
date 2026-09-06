/**
 * Test scen konstelacji (node --require ./scripts/stub-server-only.cjs --import tsx --env-file=.env.local scripts/test-constellation-scenes.ts).
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { db } from "../db";
import {
  projects,
  organizations,
  segments,
  purchaseStages,
  funnelElements,
  userFlows,
  pages,
} from "../db/schema";
import { eq } from "drizzle-orm";
import { createRelation } from "../lib/strategy-hub/relations/store";
import { getConstellationScene } from "../lib/strategy-hub/constellation-scenes";
import { areaNodeId, entityNodeId } from "../lib/strategy-hub/constellation-types";

let passed = 0;

async function test(name: string, fn: () => void | Promise<void>) {
  await fn();
  passed += 1;
  console.log("  ✓", name);
}

async function createTestProject(): Promise<{
  projectId: string;
  organizationId: string;
}> {
  const organizationId = randomUUID();
  const projectId = randomUUID();
  await db.insert(organizations).values({
    id: organizationId,
    name: "Test constellation scenes",
    ownerId: randomUUID(),
    ownerEmail: `test-${randomUUID()}@example.com`,
  });
  await db.insert(projects).values({
    id: projectId,
    organizationId,
    name: "Projekt test scen",
    slug: `test-scene-${randomUUID().slice(0, 8)}`,
  });
  return { projectId, organizationId };
}

/**
 * Sprząta CAŁĄ piaskownicę: projekt i organizację utworzoną na ten przebieg.
 * Kasowanie samego projektu zostawiało organizacje-śmieci, które po refaktorze
 * trafiały do selektora organizacji (migracja 0033 sprząta zaległości).
 * Wiersze `organizationMembers` lecą kaskadowo po FK.
 */
async function cleanupProject(projectId: string, organizationId: string) {
  await db.delete(projects).where(eq(projects.id, projectId));
  await db.delete(organizations).where(eq(organizations.id, organizationId));
}

async function run() {
  const { projectId, organizationId } = await createTestProject();

  try {
    const [segment] = await db
      .insert(segments)
      .values({ projectId, name: "Seg sceny", code: "SC1" })
      .returning();

    const [stage] = await db
      .insert(purchaseStages)
      .values({
        segmentId: segment.id,
        name: "Etap test",
        phase: "awareness",
        orderIdx: 0,
      })
      .returning();

    const [element] = await db
      .insert(funnelElements)
      .values({
        stageId: stage.id,
        segmentId: segment.id,
        name: "Element test",
        format: "Post",
        status: "active",
        position: 0,
      })
      .returning();

    const [flow] = await db
      .insert(userFlows)
      .values({
        projectId,
        segmentId: segment.id,
        entryElementId: element.id,
        name: "Flow test",
        status: "active",
      })
      .returning();

    const [page] = await db
      .insert(pages)
      .values({
        projectId,
        name: "Landing test",
        urlPath: "/test",
        status: "draft",
      })
      .returning();

    await createRelation(
      projectId,
      {
        source: { type: "flow", id: flow.id },
        target: { type: "page", id: page.id },
        relationType: "prowadzi_przez",
      },
      { source: "human" }
    );

    await test("scena entity: flow ma element/segment upstream i page downstream", async () => {
      const scene = await getConstellationScene(projectId, {
        level: "entity",
        ref: { type: "flow", id: flow.id },
      });

      const upstreamIds = new Set(scene.upstream.map((n) => n.id));
      assert.ok(
        upstreamIds.has(entityNodeId("element", element.id)),
        "brak elementu w upstream"
      );
      assert.ok(
        upstreamIds.has(entityNodeId("segment", segment.id)),
        "brak segmentu w upstream"
      );

      const downstreamIds = new Set(scene.downstream.map((n) => n.id));
      assert.ok(
        downstreamIds.has(entityNodeId("page", page.id)),
        "brak podstrony w downstream"
      );
    });

    await test("scena area lejek: segmenty upstream, strona downstream (AREA_DEPENDENCIES)", async () => {
      const scene = await getConstellationScene(projectId, {
        level: "area",
        area: "lejek",
      });

      const upstreamIds = new Set(scene.upstream.map((n) => n.id));
      assert.ok(
        upstreamIds.has(areaNodeId("segmenty")),
        "brak obszaru segmenty w upstream"
      );

      const downstreamIds = new Set(scene.downstream.map((n) => n.id));
      assert.ok(
        downstreamIds.has(areaNodeId("strona")),
        "brak obszaru strona w downstream"
      );
    });
  } finally {
    await cleanupProject(projectId, organizationId);
  }

  console.log(`\n${passed} testów scen konstelacji OK`);
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
