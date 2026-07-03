/**
 * Testy embeddingów (npx tsx --env-file=.env.local scripts/test-embeddings.ts).
 */
import assert from "node:assert/strict";
import { buildEmbeddingText, contentHash } from "../lib/strategy-hub/embeddings/content";
import { embedDocuments } from "../lib/strategy-hub/embeddings/provider";

let passed = 0;

async function test(name: string, fn: () => void | Promise<void>) {
  await fn();
  passed += 1;
  console.log("  ✓", name);
}

async function run() {
  await test("buildEmbeddingText segment", () => {
    const text = buildEmbeddingText("segment", {
      name: "SMB SaaS",
      personaName: "Anna CTO",
      jtbdMd: "Skalować sprzedaż",
      problemMd: "Chaos w KPI",
    });
    assert.ok(text);
    assert.match(text!, /SMB SaaS/);
    assert.match(text!, /Anna CTO/);
  });

  await test("buildEmbeddingText pomija credentials", () => {
    const text = buildEmbeddingText("credentials", { secret: "x" });
    assert.equal(text, null);
  });

  await test("buildEmbeddingText pomija stage bez registry", () => {
    const text = buildEmbeddingText("stage", { name: "TOFU" });
    assert.equal(text, null);
  });

  await test("contentHash deterministyczny", () => {
    const a = contentHash("hello");
    const b = contentHash("hello");
    assert.equal(a, b);
    assert.notEqual(a, contentHash("world"));
  });

  await test("degradacja bez VOYAGE_API_KEY", async () => {
    const prev = process.env.VOYAGE_API_KEY;
    delete process.env.VOYAGE_API_KEY;
    const result = await embedDocuments(["test"]);
    assert.equal(result, null);
    if (prev) process.env.VOYAGE_API_KEY = prev;
  });

  console.log(`\n${passed} testów embeddingów OK`);
  process.exit(0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
