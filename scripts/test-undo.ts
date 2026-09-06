/**
 * Testy undo (batch cofanie zmian).
 * node --require ./scripts/stub-server-only.cjs --import tsx --env-file=.env.local scripts/test-undo.ts
 */
import assert from "node:assert/strict";
import { randomUUID } from "crypto";
import { db } from "@/db";
import { projects, organizations } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getListEntity } from "@/lib/strategy-hub/entities/registry";
import { undoBatch } from "@/lib/strategy-hub/undo";
import { trackChange } from "@/lib/strategy-hub/track-change";

async function createTestProject(): Promise<{
  projectId: string;
  organizationId: string;
}> {
  const organizationId = randomUUID();
  const projectId = randomUUID();
  await db.insert(organizations).values({
    id: organizationId,
    name: "Test undo",
    ownerId: randomUUID(),
    ownerEmail: `test-undo-${randomUUID()}@example.com`,
  });
  await db.insert(projects).values({
    id: projectId,
    organizationId,
    name: "Projekt test undo",
    slug: `test-undo-${randomUUID().slice(0, 8)}`,
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

async function main() {
  const prevVoyage = process.env.VOYAGE_API_KEY;
  delete process.env.VOYAGE_API_KEY;

  const { projectId, organizationId } = await createTestProject();

  try {
  const segmentsDef = getListEntity("segments");
  assert.ok(segmentsDef);

  // (a) update → undo
  const created = await segmentsDef.create(projectId, {
    name: "Undo segment",
    personaName: "Test",
  });
  const segId = String(created.id);
  const batchUpdate = randomUUID();

  await segmentsDef.update(projectId, segId, { name: "Zmieniona nazwa" });
  await trackChange({
    projectId,
    entityType: "segment",
    entityId: segId,
    patch: { name: "Zmieniona nazwa" },
    before: { name: "Undo segment" },
    batchId: batchUpdate,
    source: "hub",
  });

  let r = await undoBatch(projectId, batchUpdate, null);
  assert.ok(r.undone >= 1);
  const afterUndoUpdate = segmentsDef.get
    ? await segmentsDef.get(projectId, segId)
    : (await segmentsDef.list(projectId)).find((x) => x.id === segId);
  assert.equal(afterUndoUpdate?.name, "Undo segment");

  // (b) create → undo → soft-deleted
  const batchCreate = randomUUID();
  const created2 = await segmentsDef.create(projectId, { name: "Do usunięcia" });
  const seg2 = String(created2.id);
  await trackChange({
    projectId,
    entityType: "segment",
    entityId: seg2,
    patch: { __created: true },
    batchId: batchCreate,
    source: "ai",
  });
  r = await undoBatch(projectId, batchCreate, null);
  assert.ok(r.undone >= 1);
  const gone = segmentsDef.get
    ? await segmentsDef.get(projectId, seg2)
    : (await segmentsDef.list(projectId)).find((x) => x.id === seg2);
  assert.equal(gone, undefined);

  // (c) delete → undo → restored
  const batchDelete = randomUUID();
  const created3 = await segmentsDef.create(projectId, { name: "Przywracany" });
  const seg3 = String(created3.id);
  await segmentsDef.softDelete(projectId, seg3);
  await trackChange({
    projectId,
    entityType: "segment",
    entityId: seg3,
    patch: { __deleted: true },
    batchId: batchDelete,
    source: "hub",
  });
  r = await undoBatch(projectId, batchDelete, null);
  assert.ok(r.undone >= 1);
  const restored = segmentsDef.get
    ? await segmentsDef.get(projectId, seg3)
    : (await segmentsDef.list(projectId)).find((x) => x.id === seg3);
  assert.ok(restored);

  // (f) drugi undo tego samego batcha
  r = await undoBatch(projectId, batchUpdate, null);
  assert.equal(r.undone, 0);

  console.log("\n✅ test-undo OK");
  } finally {
    await cleanupProject(projectId, organizationId);
    if (prevVoyage) process.env.VOYAGE_API_KEY = prevVoyage;
  }
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
