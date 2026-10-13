/**
 * Automatyczny podział na warstwy i grupowanie kształtów w obiekty.
 *
 * Mozaika (`cutout`) nie ma nakładających się kształtów, więc kolejność warstw nie zmienia wyglądu —
 * można dowolnie dzielić po kolorze, tonie, barwie czy wielkości. Stos (`stacked`) zależy od kolejności
 * rysowania, dlatego tam warstwy to ciągłe wycinki kolejności silnika (bez przestawiania kształtów).
 */
import { deltaE, hexToOklab, rgbToOklabInto, type Lab } from "./color";
import { colorName, HUE_FAMILIES, hueFamily, type HueFamilyId } from "./color-names";
import type { LayerKind, Swatch, VectorDocument, VectorGroup, VectorLayer, VectorPath } from "./document";
import type { LayeringStrategy } from "./settings";

export interface LayeringOptions {
  strategy: LayeringStrategy;
  maxLayers: number;
  separateBackground: boolean;
  groupObjects: boolean;
  /** Odległość łączenia w obiekty, % przekątnej obrazu. */
  groupGap: number;
}

export type LayeringInput = Pick<
  VectorDocument,
  "width" | "height" | "layout" | "paths" | "swatches" | "backgroundSwatches"
>;

interface Bucket {
  name: string;
  kind: LayerKind;
  /** Kolejność od dołu: rosnąco. */
  order: number;
  paths: VectorPath[];
}

/** Kształty mniejsze niż ten ułamek obrazu, stojące samotnie, trafiają do „Drobnych elementów”. */
const TINY_SHAPE_FRACTION = 0.0003;
const MAX_GROUPS_PER_LAYER = 60;

class UnionFind {
  private readonly parent: Int32Array;
  constructor(size: number) {
    this.parent = new Int32Array(size);
    for (let i = 0; i < size; i++) this.parent[i] = i;
  }
  find(i: number): number {
    let root = i;
    while (this.parent[root] !== root) root = this.parent[root];
    while (this.parent[i] !== root) {
      const next = this.parent[i];
      this.parent[i] = root;
      i = next;
    }
    return root;
  }
  union(a: number, b: number): void {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra !== rb) this.parent[rb] = ra;
  }
}

/** Łączy kształty, których obwiednie (powiększone o `gap`) się stykają — „obiekty” w obrębie warstwy. */
export function groupNearbyPaths(paths: readonly VectorPath[], gap: number): VectorPath[][] {
  const n = paths.length;
  if (n <= 1) return n === 0 ? [] : [[...paths]];
  const order = Array.from({ length: n }, (_, i) => i).sort((a, b) => paths[a].bounds[0] - paths[b].bounds[0]);
  const uf = new UnionFind(n);
  let active: number[] = [];
  for (const i of order) {
    const [x0, y0, x1, y1] = paths[i].bounds;
    active = active.filter((j) => paths[j].bounds[2] + gap >= x0);
    for (const j of active) {
      const b = paths[j].bounds;
      if (b[1] - gap <= y1 && b[3] + gap >= y0 && b[0] - gap <= x1) uf.union(j, i);
    }
    active.push(i);
  }
  const components = new Map<number, VectorPath[]>();
  // Zachowaj kolejność rysowania wewnątrz grupy (rosnące id).
  for (let i = 0; i < n; i++) {
    const root = uf.find(i);
    const list = components.get(root);
    if (list) list.push(paths[i]);
    else components.set(root, [paths[i]]);
  }
  return [...components.values()];
}

function areaOf(paths: readonly VectorPath[]): number {
  let total = 0;
  for (const p of paths) total += p.area;
  return total;
}

function buildGroups(
  layerId: string,
  paths: VectorPath[],
  input: LayeringInput,
  options: LayeringOptions,
): VectorGroup[] {
  const byId = (a: VectorPath, b: VectorPath) => a.id - b.id;
  const sorted = [...paths].sort(byId);
  if (!options.groupObjects || input.layout === "stacked" || sorted.length <= 1) {
    return [{ id: `${layerId}/g1`, name: "Kształty", visible: true, pathIds: sorted.map((p) => p.id) }];
  }
  const diagonal = Math.hypot(input.width, input.height);
  const gap = (options.groupGap / 100) * diagonal;
  const components = groupNearbyPaths(sorted, gap).sort((a, b) => areaOf(b) - areaOf(a));

  const tinyLimit = input.width * input.height * TINY_SHAPE_FRACTION;
  const objects: VectorPath[][] = [];
  const tiny: VectorPath[] = [];
  for (const component of components) {
    if (component.length === 1 && component[0].area < tinyLimit) tiny.push(component[0]);
    else objects.push(component);
  }
  const overflow = objects.splice(MAX_GROUPS_PER_LAYER - 1);
  const rest = [...overflow.flat(), ...tiny].sort(byId);

  const groups: VectorGroup[] = objects.map((component, index) => ({
    id: `${layerId}/g${index + 1}`,
    name: objects.length === 1 && rest.length === 0 ? "Kształty" : `Obiekt ${index + 1}`,
    visible: true,
    pathIds: component.sort(byId).map((p) => p.id),
  }));
  if (rest.length > 0) {
    groups.push({
      id: `${layerId}/g${groups.length + 1}`,
      name: overflow.length > 0 ? "Pozostałe elementy" : "Drobne elementy",
      visible: true,
      pathIds: rest.map((p) => p.id),
    });
  }
  return groups;
}

interface SwatchStat {
  swatch: Swatch;
  lab: Lab;
  area: number;
  paths: VectorPath[];
}

function swatchStats(paths: readonly VectorPath[], swatches: readonly Swatch[]): SwatchStat[] {
  const byId = new Map<number, SwatchStat>();
  for (const swatch of swatches) byId.set(swatch.id, { swatch, lab: hexToOklab(swatch.hex), area: 0, paths: [] });
  for (const path of paths) {
    const stat = byId.get(path.swatch);
    if (!stat) continue;
    stat.area += path.area;
    stat.paths.push(path);
  }
  return [...byId.values()].filter((s) => s.paths.length > 0);
}

/** Aglomeracja Warda (ważona √pola) — łączy podobne barwy, aż zostanie `limit` grup. */
function clusterSwatches(stats: SwatchStat[], limit: number): SwatchStat[][] {
  interface Cluster {
    members: SwatchStat[];
    lab: [number, number, number];
    weight: number;
  }
  const clusters: Cluster[] = stats.map((s) => {
    const weight = Math.sqrt(Math.max(1, s.area));
    return { members: [s], lab: [s.lab[0], s.lab[1], s.lab[2]], weight };
  });
  while (clusters.length > limit) {
    let bestI = 0;
    let bestJ = 1;
    let bestCost = Infinity;
    for (let i = 0; i < clusters.length; i++) {
      for (let j = i + 1; j < clusters.length; j++) {
        const a = clusters[i];
        const b = clusters[j];
        const d = deltaE(a.lab, b.lab);
        const cost = d * d * ((a.weight * b.weight) / (a.weight + b.weight));
        if (cost < bestCost) {
          bestCost = cost;
          bestI = i;
          bestJ = j;
        }
      }
    }
    const a = clusters[bestI];
    const b = clusters[bestJ];
    const w = a.weight + b.weight;
    a.lab = [
      (a.lab[0] * a.weight + b.lab[0] * b.weight) / w,
      (a.lab[1] * a.weight + b.lab[1] * b.weight) / w,
      (a.lab[2] * a.weight + b.lab[2] * b.weight) / w,
    ];
    a.weight = w;
    a.members.push(...b.members);
    clusters.splice(bestJ, 1);
  }
  return clusters.map((c) => c.members);
}

function weightedLab(members: readonly SwatchStat[]): Lab {
  let L = 0;
  let a = 0;
  let b = 0;
  let w = 0;
  for (const m of members) {
    const weight = Math.max(1, m.area);
    L += m.lab[0] * weight;
    a += m.lab[1] * weight;
    b += m.lab[2] * weight;
    w += weight;
  }
  return [L / w, a / w, b / w];
}

function colorBuckets(stats: SwatchStat[], limit: number): Bucket[] {
  const groups = limit >= stats.length ? stats.map((s) => [s]) : clusterSwatches(stats, limit);
  return groups.map((members) => {
    const lab = weightedLab(members);
    const name = members.length === 1 ? members[0].swatch.name : colorName(lab);
    return {
      name,
      kind: "color" as const,
      // Jasne kolory na dole, ciemne na górze (jak w sitodruku).
      order: -lab[0],
      paths: members.flatMap((m) => m.paths),
    };
  });
}

const TONE_BANDS_5 = [
  { min: 0.8, name: "Światła" },
  { min: 0.65, name: "Jasne półtony" },
  { min: 0.5, name: "Półtony" },
  { min: 0.35, name: "Ciemne półtony" },
  { min: -Infinity, name: "Cienie" },
];
const TONE_BANDS_3 = [
  { min: 0.7, name: "Światła" },
  { min: 0.4, name: "Półtony" },
  { min: -Infinity, name: "Cienie" },
];

function toneBuckets(stats: SwatchStat[], maxLayers: number): Bucket[] {
  const bands = maxLayers >= 5 ? TONE_BANDS_5 : TONE_BANDS_3;
  return bands.map((band, index) => ({
    name: band.name,
    kind: "tone" as const,
    order: index,
    paths: stats
      .filter((s) => {
        const bandIndex = bands.findIndex((b) => s.lab[0] >= b.min);
        return bandIndex === index;
      })
      .flatMap((s) => s.paths),
  }));
}

function hueBuckets(stats: SwatchStat[]): Bucket[] {
  const families = new Map<HueFamilyId, SwatchStat[]>();
  for (const s of stats) {
    const family = hueFamily(s.lab);
    const list = families.get(family);
    if (list) list.push(s);
    else families.set(family, [s]);
  }
  return HUE_FAMILIES.filter((f) => families.has(f.id)).map((family) => {
    const members = families.get(family.id) ?? [];
    return {
      name: family.name,
      kind: "hue" as const,
      order: -weightedLab(members)[0],
      paths: members.flatMap((m) => m.paths),
    };
  });
}

function sizeBuckets(paths: VectorPath[], imageArea: number): Bucket[] {
  const big: VectorPath[] = [];
  const medium: VectorPath[] = [];
  const small: VectorPath[] = [];
  for (const p of paths) {
    if (p.area >= imageArea * 0.01) big.push(p);
    else if (p.area >= imageArea * 0.0005) medium.push(p);
    else small.push(p);
  }
  return [
    { name: "Duże formy", kind: "size", order: 0, paths: big },
    { name: "Średnie kształty", kind: "size", order: 1, paths: medium },
    { name: "Detale", kind: "size", order: 2, paths: small },
  ];
}

/** Stos: warstwy jako ciągłe wycinki kolejności rysowania (zachowują wygląd). */
function stackedBuckets(paths: VectorPath[], imageArea: number, strategy: LayeringStrategy): Bucket[] {
  const sorted = [...paths].sort((a, b) => a.id - b.id);
  if (strategy === "single" || sorted.length < 3) {
    return [{ name: "Wszystkie kształty", kind: "all", order: 0, paths: sorted }];
  }
  const firstBelow = (from: number, limit: number) => {
    for (let i = Math.max(1, from); i < sorted.length; i++) if (sorted[i].area < limit) return i;
    return sorted.length;
  };
  const i1 = firstBelow(0, imageArea * 0.01);
  const i2 = Math.max(i1, firstBelow(i1, imageArea * 0.0005));
  return [
    { name: "Duże formy", kind: "size", order: 0, paths: sorted.slice(0, i1) },
    { name: "Średnie kształty", kind: "size", order: 1, paths: sorted.slice(i1, i2) },
    { name: "Detale", kind: "size", order: 2, paths: sorted.slice(i2) },
  ];
}

function dedupeNames(buckets: Bucket[]): void {
  const counts = new Map<string, number>();
  for (const b of buckets) counts.set(b.name, (counts.get(b.name) ?? 0) + 1);
  const seen = new Map<string, number>();
  for (const b of buckets) {
    if ((counts.get(b.name) ?? 0) < 2) continue;
    const n = (seen.get(b.name) ?? 0) + 1;
    seen.set(b.name, n);
    b.name = `${b.name} ${n}`;
  }
}

export function buildLayers(input: LayeringInput, options: LayeringOptions): VectorLayer[] {
  const active = input.paths.filter((p) => !p.removed);
  const imageArea = input.width * input.height;
  let buckets: Bucket[];
  let background: VectorPath[] = [];

  if (input.layout === "stacked") {
    buckets = stackedBuckets(active, imageArea, options.strategy);
  } else {
    let rest = active;
    if (options.separateBackground && input.backgroundSwatches.length > 0) {
      const bg = new Set(input.backgroundSwatches);
      background = active.filter((p) => bg.has(p.swatch) && p.touchesEdge);
      if (background.length > 0) rest = active.filter((p) => !(bg.has(p.swatch) && p.touchesEdge));
    }
    const stats = swatchStats(rest, input.swatches);
    const limit = Math.max(1, options.maxLayers - (background.length > 0 ? 1 : 0));
    switch (options.strategy) {
      case "single":
        buckets = [{ name: "Wszystkie kształty", kind: "all", order: 0, paths: rest }];
        break;
      case "color":
        buckets = colorBuckets(stats, Number.POSITIVE_INFINITY);
        break;
      case "tone":
        buckets = toneBuckets(stats, options.maxLayers);
        break;
      case "hue":
        buckets = hueBuckets(stats);
        break;
      case "size":
        buckets = sizeBuckets(rest, imageArea);
        break;
      case "auto":
      default:
        buckets = colorBuckets(stats, limit);
        break;
    }
  }

  buckets = buckets.filter((b) => b.paths.length > 0).sort((a, b) => a.order - b.order);
  dedupeNames(buckets);

  const layers: VectorLayer[] = [];
  if (background.length > 0) {
    const id = "layer-tlo";
    layers.push({
      id,
      name: "Tło",
      kind: "background",
      visible: true,
      locked: false,
      groups: buildGroups(id, background, input, { ...options, groupObjects: false }),
    });
  }
  buckets.forEach((bucket, index) => {
    const id = `layer-${index + 1}`;
    layers.push({
      id,
      name: bucket.name,
      kind: bucket.kind,
      visible: true,
      locked: false,
      groups: buildGroups(id, bucket.paths, input, options),
    });
  });
  return layers;
}

/**
 * Tło: kolor(y) dominujące na krawędziach obrazu. Zwraca id próbek; puste, gdy krawędzie
 * są przezroczyste albo żaden kolor nie przeważa (np. zdjęcie „na spad”).
 */
export function detectBackgroundSwatches(border: Uint8ClampedArray, swatches: readonly Swatch[]): number[] {
  if (border.length === 0 || swatches.length === 0) return [];
  const labs = swatches.map((s) => hexToOklab(s.hex));
  const counts = new Float64Array(swatches.length);
  const scratch = new Float64Array(3);
  const total = border.length / 3;
  for (let i = 0; i < border.length; i += 3) {
    rgbToOklabInto(border[i], border[i + 1], border[i + 2], scratch, 0);
    let best = 0;
    let bestD = Infinity;
    for (let s = 0; s < labs.length; s++) {
      const d = (scratch[0] - labs[s][0]) ** 2 + (scratch[1] - labs[s][1]) ** 2 + (scratch[2] - labs[s][2]) ** 2;
      if (d < bestD) {
        bestD = d;
        best = s;
      }
    }
    counts[best]++;
  }
  const ranked = swatches.map((s, i) => ({ s, i, share: counts[i] / total })).sort((a, b) => b.share - a.share);
  const top = ranked[0];
  if (top.share < 0.3) return [];
  const result = [top.s.id];
  for (const candidate of ranked.slice(1)) {
    if (candidate.share < 0.06) break;
    if (deltaE(labs[candidate.i], labs[top.i]) < 0.06) result.push(candidate.s.id);
  }
  return result;
}
