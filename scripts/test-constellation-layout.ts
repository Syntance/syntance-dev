/**
 * Test układu radialnego konstelacji (npx tsx scripts/test-constellation-layout.ts).
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { StrategyArea } from "../lib/strategy-hub/entities/entity-types";
import {
  CORE_NODE_ID,
  areaNodeId,
  entityNodeId,
} from "../lib/strategy-hub/constellation-types";
import {
  computeRadialLayout,
  maxLayoutRadius,
  type LayoutInputNode,
} from "../components/strategy-hub/constellation/radial-layout";

const AREAS: StrategyArea[] = [
  "fundament",
  "segmenty",
  "lejek",
  "kanaly",
  "przekaz",
  "strona",
  "kpi",
];

function buildSyntheticTree(): LayoutInputNode[] {
  const nodes: LayoutInputNode[] = [
    { id: CORE_NODE_ID, parentId: null },
  ];

  for (const area of AREAS) {
    const areaId = areaNodeId(area);
    nodes.push({ id: areaId, parentId: CORE_NODE_ID });
    for (let i = 0; i < 10; i++) {
      nodes.push({
        id: entityNodeId("segment", randomUUID()),
        parentId: areaId,
      });
    }
  }
  return nodes;
}

let passed = 0;

function test(name: string, fn: () => void) {
  fn();
  passed += 1;
  console.log("  ✓", name);
}

const cx = 400;
const cy = 300;
const nodes = buildSyntheticTree();
const layout = computeRadialLayout(nodes, AREAS, cx, cy);

test("unikalne pozycje dla każdego węzła", () => {
  const coords = new Set<string>();
  for (const [id, pos] of layout) {
    const key = `${pos.x.toFixed(2)},${pos.y.toFixed(2)}`;
    assert.ok(!coords.has(key), `duplikat pozycji dla ${id}`);
    coords.add(key);
  }
  assert.equal(layout.size, nodes.length);
});

test("wszystkie węzły w promieniu layoutu", () => {
  const maxR = maxLayoutRadius(layout, cx, cy) + 50;
  for (const [, pos] of layout) {
    const r = Math.hypot(pos.x - cx, pos.y - cy);
    assert.ok(r <= maxR, `węzeł poza promieniem: r=${r}, max=${maxR}`);
  }
});

test("kąty obszarów rosną wg areasOrder", () => {
  const angles = AREAS.map((a) => layout.get(areaNodeId(a))?.angle ?? -1);
  for (let i = 1; i < angles.length; i++) {
    assert.ok(
      angles[i] > angles[i - 1],
      `kąty obszarów nie rosną: ${angles[i - 1]} -> ${angles[i]}`
    );
  }
});

console.log(`\n${passed} testów layoutu konstelacji OK`);
