/**
 * Testy read-modelu blueprintu segmentu.
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
  entityRelations,
} from "../db/schema";
import { eq, sql } from "drizzle-orm";
import { getBlueprint } from "../lib/strategy-hub/blueprint-data";

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
    name: "Test blueprint",
    ownerId: randomUUID(),
    ownerEmail: `test-${randomUUID()}@example.com`,
  });
  await db.insert(projects).values({
    id: projectId,
    organizationId,
    name: "Projekt blueprint",
    slug: `test-bp-${randomUUID().slice(0, 8)}`,
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
    const [segLow] = await db
      .insert(segments)
      .values({ projectId, name: "Seg niski", code: "L", priority: 1 })
      .returning();
    const [segHigh] = await db
      .insert(segments)
      .values({ projectId, name: "Seg wysoki", code: "H", priority: 10 })
      .returning();

    for (const seg of [segLow, segHigh]) {
      const [stage] = await db
        .insert(purchaseStages)
        .values({
          segmentId: seg.id,
          name: `Etap ${seg.code}`,
          orderIdx: 0,
          phase: seg.id === segLow.id ? "retencja lojalności" : "uwaga",
        })
        .returning();
      const [element] = await db
        .insert(funnelElements)
        .values({
          stageId: stage.id,
          segmentId: seg.id,
          name: `El ${seg.code}`,
          position: 0,
        })
        .returning();
      if (seg.id === segHigh.id) {
        // `channels.workspace_id` to relikt sprzed 0028 (nullable, FK już na
        // `organizations`) — nie ma go w db/schema.ts, więc insert idzie SQL-em.
        const channelRows = await db.execute<{ id: string }>(
          sql`INSERT INTO channels (project_id, workspace_id, name) VALUES (${projectId}::uuid, ${organizationId}::uuid, 'LinkedIn') RETURNING id`
        );
        const channelId = channelRows[0]?.id;
        assert.ok(channelId);
        await db.insert(entityRelations).values({
          projectId,
          sourceType: "element",
          sourceId: element.id,
          targetType: "channel",
          targetId: channelId,
          relationType: "publikowany_w",
          source: "human",
        });
      }
    }

    await test("segmentId=null wybiera najwyższy priority", async () => {
      const bp = await getBlueprint(projectId, null, "editor");
      assert.equal(bp.selected?.id, segHigh.id);
    });

    await test("kolumny wg orderIdx", async () => {
      const bp = await getBlueprint(projectId, segHigh.id, "editor");
      assert.equal(bp.columns.length, 1);
      assert.equal(bp.columns[0].stage.name, "Etap H");
    });

    await test("kanał w komórce kanaly", async () => {
      const bp = await getBlueprint(projectId, segHigh.id, "editor");
      assert.ok(bp.columns[0].cells.kanaly.some((c) => c.label === "LinkedIn"));
    });

    await test("luka tresci gdy brak elementów", async () => {
      const emptyStage = await db
        .insert(purchaseStages)
        .values({
          segmentId: segLow.id,
          name: "Pusty",
          orderIdx: 1,
          phase: "decyzja",
        })
        .returning();
      assert.ok(emptyStage[0]);
      const bp2 = await getBlueprint(projectId, segLow.id, "editor");
      const col = bp2.columns.find((c) => c.stage.name === "Pusty");
      assert.ok(col?.gaps.includes("tresci"));
    });

    await test("retencja — brak luki kanaly/strona", async () => {
      const bp = await getBlueprint(projectId, segLow.id, "editor");
      const retCol = bp.columns.find((c) =>
        c.stage.phase?.toLowerCase().includes("retencj")
      );
      assert.ok(retCol);
      assert.ok(!retCol.gaps.includes("kanaly"));
      assert.ok(!retCol.gaps.includes("strona"));
    });
  } finally {
    await cleanupProject(projectId, organizationId);
  }

  console.log(`\n${passed} testów blueprint OK`);
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
