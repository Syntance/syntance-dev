/**
 * Testy jednostkowe maszyny stanów reguł (bez frameworka — `npx tsx scripts/test-rules.ts`).
 * Weryfikuje: lock upstream→downstream, stany empty/in_progress/ready/review, propagację „do przeglądu".
 */
import assert from "node:assert/strict";
import { DEFAULT_RULES } from "../lib/strategy-hub/rules/defaults";
import {
  resolveModuleStatuses,
  downstreamOf,
} from "../lib/strategy-hub/rules/state";
import { reviewTablesOnChange } from "../lib/strategy-hub/rules/propagate";

let passed = 0;
function test(name: string, fn: () => void) {
  fn();
  passed += 1;
  console.log("  ✓", name);
}

// 1. Lock: pusty fundament blokuje segmenty (nie może osiągnąć ✅).
test("lock: pusty fundament blokuje segmenty", () => {
  const s = resolveModuleStatuses(DEFAULT_RULES, {
    scoreOf: (k) => (k === "fundament" ? 0 : 100),
  });
  const seg = s.get("segmenty");
  assert.ok(seg);
  assert.equal(seg.locked, true);
  assert.deepEqual(seg.blockedBy, ["fundament"]);
  assert.notEqual(seg.state, "ready");
});

// 2. Pełne dane → KPI gotowe i odblokowane.
test("ready: pełne dane → kpi ✅", () => {
  const s = resolveModuleStatuses(DEFAULT_RULES, { scoreOf: () => 100 });
  const kpi = s.get("kpi");
  assert.ok(kpi);
  assert.equal(kpi.state, "ready");
  assert.equal(kpi.locked, false);
});

// 3. Brak danych → 🔴 empty.
test("empty: brak danych → 🔴", () => {
  const s = resolveModuleStatuses(DEFAULT_RULES, { scoreOf: () => 0 });
  assert.equal(s.get("fundament")?.state, "empty");
});

// 4. Częściowe dane → 🟡 in_progress.
test("in_progress: score między 0 a progiem → 🟡", () => {
  const s = resolveModuleStatuses(DEFAULT_RULES, { scoreOf: () => 40 });
  assert.equal(s.get("fundament")?.state, "in_progress");
});

// 5. Review: ✅ + flaga zmiany upstream → 🟡 „do przeglądu".
test("review: ✅ + flaga → 🟡 review", () => {
  const s = resolveModuleStatuses(DEFAULT_RULES, {
    scoreOf: () => 100,
    reviewOf: (k) => k === "lejek",
  });
  const lejek = s.get("lejek");
  assert.ok(lejek);
  assert.equal(lejek.review, true);
  assert.equal(lejek.state, "review");
});

// 6. Propagacja bezpośrednia: zmiana segmentów → lejek i strona.
test("propagacja: downstream segmentów zawiera lejek i strona", () => {
  const ds = downstreamOf(DEFAULT_RULES, "segmenty");
  assert.ok(ds.includes("lejek"));
  assert.ok(ds.includes("strona"));
});

// 7. Propagacja tranzytywna: fundament → cały łańcuch do KPI.
test("propagacja transitive: fundament → kpi", () => {
  const ds = downstreamOf(DEFAULT_RULES, "fundament", { transitive: true });
  assert.ok(ds.includes("kpi"));
});

// 8. Blokada w środku łańcucha: pusty lejek blokuje kanały i stronę.
test("lock: pusty lejek blokuje kanaly i strona", () => {
  const s = resolveModuleStatuses(DEFAULT_RULES, {
    scoreOf: (k) => (k === "lejek" ? 0 : 100),
  });
  assert.equal(s.get("kanaly")?.locked, true);
  assert.ok(s.get("strona")?.blockedBy.includes("lejek"));
});

// 9. Propagacja review: zmiana segmentu flaguje funnel_elements i pages.
test("propagate: zmiana segmentu → review na funnelElements i pages", () => {
  const t = reviewTablesOnChange(DEFAULT_RULES, "segments");
  assert.ok(t.includes("funnelElements"));
  assert.ok(t.includes("pages"));
});

// 10. Propagacja review: KPI jest terminalne → brak downstream do oflagowania.
test("propagate: zmiana kpi → brak downstream", () => {
  assert.deepEqual(reviewTablesOnChange(DEFAULT_RULES, "kpis"), []);
});

// ── Faza 1 (M1) — dopełnienie macierzy 13 locków ze spec Notion ──

// 11. Buyer journey wymaga Segment.
test("lock: pusty segmenty blokuje buyer_journey", () => {
  const s = resolveModuleStatuses(DEFAULT_RULES, {
    scoreOf: (k) => (k === "segmenty" ? 0 : 100),
  });
  assert.equal(s.get("buyer_journey")?.locked, true);
  assert.ok(s.get("buyer_journey")?.blockedBy.includes("segmenty"));
});

// 12. Pitche wymagają Segment+UVP+Obiekcje (fundament).
test("lock: pusty fundament blokuje pitche", () => {
  const s = resolveModuleStatuses(DEFAULT_RULES, {
    scoreOf: (k) => (k === "fundament" ? 0 : 100),
  });
  assert.equal(s.get("pitche")?.locked, true);
});

// 13. Sekcje wymagają Strona (Rola+Segment+Obiekcje pokryte transitywnie).
test("lock: pusta strona blokuje sekcje", () => {
  const s = resolveModuleStatuses(DEFAULT_RULES, {
    scoreOf: (k) => (k === "strona" ? 0 : 100),
  });
  assert.equal(s.get("sekcje")?.locked, true);
});

// 14. SEO wymaga Lejek+Mapa serwisu (strona pokrywa oba transitywnie).
test("lock: pusta strona blokuje seo i geo (transitive)", () => {
  const s = resolveModuleStatuses(DEFAULT_RULES, {
    scoreOf: (k) => (k === "strona" ? 0 : 100),
  });
  assert.equal(s.get("seo")?.locked, true);
  assert.equal(s.get("geo")?.locked, true);
});

// 15. Oferta wymaga UVP+Segmenty (fundament pokrywa UVP).
test("lock: pusty fundament blokuje oferte", () => {
  const s = resolveModuleStatuses(DEFAULT_RULES, {
    scoreOf: (k) => (k === "fundament" ? 0 : 100),
  });
  assert.equal(s.get("oferta")?.locked, true);
});

// 16. Kampania wymaga Elementy+Segment+Kanały+Oferta.
test("lock: pusta oferta blokuje kampanie, mimo gotowych kanałów/lejka", () => {
  const s = resolveModuleStatuses(DEFAULT_RULES, {
    scoreOf: (k) => (k === "oferta" ? 0 : 100),
  });
  assert.equal(s.get("kampanie")?.locked, true);
  assert.ok(s.get("kampanie")?.blockedBy.includes("oferta"));
});

// 17. Pełne dane → cała nowa macierz odblokowana i gotowa.
test("ready: pełne dane → pitche/sekcje/seo/geo/oferta/kampanie ✅", () => {
  const s = resolveModuleStatuses(DEFAULT_RULES, { scoreOf: () => 100 });
  for (const key of ["pitche", "sekcje", "seo", "geo", "oferta", "kampanie", "buyer_journey"]) {
    assert.equal(s.get(key)?.state, "ready", `${key} powinien być ready`);
  }
});

console.log(`\n${passed} testów reguł przeszło ✅`);
