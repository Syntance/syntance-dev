/**
 * Testy modułu Wektoryzator (npx tsx scripts/test-wektoryzator.ts) — bez bazy i przeglądarki:
 * silnik VTracer (WASM) w Node, geometria, kwantyzacja, warstwy, edycje i eksportery.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { unzipSync, strFromU8 } from "fflate";
import * as edits from "../lib/strategy-hub/wektoryzator/doc-edits";
import { deltaE, hexToRgb, normalizeHex, oklabToRgb, rgbToOklab } from "../lib/strategy-hub/wektoryzator/engine/color";
import { colorName } from "../lib/strategy-hub/wektoryzator/engine/color-names";
import {
  visibleLayers,
  type Swatch,
  type VectorDocument,
  type VectorPath,
} from "../lib/strategy-hub/wektoryzator/engine/document";
import { fitWorkingSize, resizeImage, type RgbaImage } from "../lib/strategy-hub/wektoryzator/engine/image";
import {
  buildLayers,
  detectBackgroundSwatches,
  groupNearbyPaths,
} from "../lib/strategy-hub/wektoryzator/engine/layering";
import {
  flattenGeometry,
  geometryBounds,
  geometrySignedArea,
  parsePathData,
  serializeGeometry,
} from "../lib/strategy-hub/wektoryzator/engine/path-geometry";
import { runPipeline } from "../lib/strategy-hub/wektoryzator/engine/pipeline";
import { dilateMask, silhouetteMask } from "../lib/strategy-hub/wektoryzator/engine/outline";
import { quantizeImage, TRANSPARENT_LABEL } from "../lib/strategy-hub/wektoryzator/engine/quantize";
import {
  DEFAULT_SETTINGS,
  getPreset,
  needsOutline,
  needsRelayer,
  needsRetrace,
  OUTLINE_FIELDS,
  outlineStyle,
  parseSettings,
  PRESETS,
  scaledSettings,
  traceSettingsSchema,
} from "../lib/strategy-hub/wektoryzator/engine/settings";
import { parseTracedSvg } from "../lib/strategy-hub/wektoryzator/engine/svg-output";
import { createTracer } from "../lib/strategy-hub/wektoryzator/engine/vtracer";
import { buildLayersZip } from "../lib/strategy-hub/wektoryzator/export/bundle";
import { buildDxf, buildDxfPreviewSvg, nearestAci } from "../lib/strategy-hub/wektoryzator/export/dxf";
import { buildEps } from "../lib/strategy-hub/wektoryzator/export/eps";
import { buildAse, buildCss, buildGpl, usedSwatches } from "../lib/strategy-hub/wektoryzator/export/palette";
import { buildPdf } from "../lib/strategy-hub/wektoryzator/export/pdf";
import {
  convertSize,
  defaultExportSize,
  rasterPixels,
  toPoints,
  type VectorExportOptions,
} from "../lib/strategy-hub/wektoryzator/export/shared";
import { buildSvg } from "../lib/strategy-hub/wektoryzator/export/svg";
import { checkInputFile, sniffImageKind } from "../lib/strategy-hub/wektoryzator/file-input";
import { createUserPreset, parseUserPresets } from "../lib/strategy-hub/wektoryzator/user-presets";
import { VTRACER_WASM_URL } from "../lib/strategy-hub/wektoryzator/vendor/vtracer/version";
import { plural } from "../components/strategy-hub/apps/wektoryzator/controls";

let passed = 0;
function test(name: string, fn: () => void) {
  try {
    fn();
    passed += 1;
  } catch (error) {
    console.error(`✗ ${name}`);
    throw error;
  }
}

function makeImage(width: number, height: number, paint: (x: number, y: number) => readonly number[]): RgbaImage {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const [r, g, b, a = 255] = paint(x, y);
      data.set([r, g, b, a], (y * width + x) * 4);
    }
  }
  return { width, height, data };
}

/** Białe tło, czerwony prostokąt, niebieskie koło, grafitowy pasek. */
function sampleGraphic(width = 240, height = 160): RgbaImage {
  return makeImage(width, height, (x, y) => {
    const dx = x - width * 0.7;
    const dy = y - height * 0.5;
    if (dx * dx + dy * dy < (height * 0.28) ** 2) return [30, 80, 220];
    if (x > width * 0.1 && x < width * 0.4 && y > height * 0.2 && y < height * 0.6) return [220, 40, 40];
    if (y > height * 0.82 && y < height * 0.9 && x > width * 0.1 && x < width * 0.9) return [25, 25, 30];
    return [250, 250, 248];
  });
}

const tracer = createTracer(readFileSync(join(process.cwd(), "public", VTRACER_WASM_URL.replace(/^\//, ""))));

// ── Kolory ────────────────────────────────────────────────────────────────────
test("hex: parsowanie i normalizacja", () => {
  assert.deepEqual(hexToRgb("#FF8000"), [255, 128, 0]);
  assert.equal(normalizeHex("ABCDEF"), "#abcdef");
  assert.equal(normalizeHex("url(javascript:1)"), null);
});

test("OKLab: konwersja w obie strony z dokładnością 1/255", () => {
  for (let i = 0; i < 400; i++) {
    const rgb = [(i * 37) % 256, (i * 91) % 256, (i * 53) % 256] as const;
    const back = oklabToRgb(rgbToOklab(rgb));
    for (let c = 0; c < 3; c++) assert.ok(Math.abs(back[c] - rgb[c]) <= 1);
  }
  assert.ok(
    deltaE(rgbToOklab([220, 30, 30]), rgbToOklab([200, 30, 30])) <
      deltaE(rgbToOklab([220, 30, 30]), rgbToOklab([30, 30, 220])),
  );
});

test("polskie nazwy kolorów", () => {
  assert.equal(colorName(rgbToOklab([255, 255, 255])), "Biel");
  assert.equal(colorName(rgbToOklab([10, 10, 10])), "Czerń");
  assert.equal(colorName(rgbToOklab([210, 30, 30])), "Czerwień");
  assert.equal(colorName(rgbToOklab([40, 160, 60])), "Zieleń");
});

// ── Geometria ścieżek ─────────────────────────────────────────────────────────
test("ścieżka: kwadrat bezwzględny i względny mają pole 100", () => {
  assert.equal(Math.abs(geometrySignedArea(parsePathData("M0 0 L10 0 L10 10 L0 10 Z"))), 100);
  assert.equal(Math.abs(geometrySignedArea(parsePathData("m0 0 h10 v10 h-10 z"))), 100);
  assert.deepEqual(geometryBounds(parsePathData("M2 3 L12 3 L12 9 Z")), [2, 3, 12, 9]);
});

test("ścieżka: otwór o przeciwnej orientacji odejmuje pole", () => {
  const holed = parsePathData("M0 0 L10 0 L10 10 L0 10 Z M3 3 L3 7 L7 7 L7 3 Z");
  assert.equal(Math.abs(geometrySignedArea(holed)), 84);
});

test("ścieżka: koło z 4 krzywych Béziera ≈ πr²", () => {
  const k = 0.5522847498 * 10;
  const d = `M10 0 C10 ${k} ${k} 10 0 10 C${-k} 10 -10 ${k} -10 0 C-10 ${-k} ${-k} -10 0 -10 C${k} -10 10 ${-k} 10 0 Z`;
  const area = Math.abs(geometrySignedArea(parsePathData(d)));
  assert.ok(Math.abs(area - Math.PI * 100) / (Math.PI * 100) < 0.001, `pole ${area}`);
});

test("ścieżka: łuki, S/T, zwarty zapis liczb", () => {
  const arc = parsePathData("M0 0 A10 10 0 0 1 20 0");
  const last = arc.coords.slice(-2);
  assert.ok(Math.abs(last[0] - 20) < 1e-9 && Math.abs(last[1]) < 1e-9);
  const compact = parsePathData("M.5.5L1e1-2");
  assert.deepEqual([...compact.coords], [0.5, 0.5, 10, -2]);
  const smooth = parsePathData("M0 0 C0 10 10 10 10 0 S20 -10 20 0 Q25 5 30 0 T40 0");
  assert.equal(smooth.cmds.length, 5);
  assert.throws(() => parsePathData("X10 10"));
});

test("ścieżka: spłaszczanie trzyma tolerancję, serializacja jest odwracalna", () => {
  const circle = parsePathData(
    "M10 0 C10 5.52 5.52 10 0 10 C-5.52 10 -10 5.52 -10 0 C-10 -5.52 -5.52 -10 0 -10 C5.52 -10 10 -5.52 10 0 Z",
  );
  const [poly] = flattenGeometry(circle, 0.05);
  assert.ok(poly.closed && poly.points.length > 16);
  for (let i = 0; i < poly.points.length; i += 2) {
    const r = Math.hypot(poly.points[i], poly.points[i + 1]);
    assert.ok(Math.abs(r - 10) < 0.1, `promień ${r}`);
  }
  const again = parsePathData(serializeGeometry(circle, 3));
  assert.deepEqual([...again.cmds], [...circle.cmds]);
});

// ── Obraz i kwantyzacja ───────────────────────────────────────────────────────
test("rozmiar roboczy: pomniejszanie, powiększanie maks. ×4", () => {
  assert.deepEqual(fitWorkingSize(4000, 2000, 2000, true), { width: 2000, height: 1000, scale: 0.5 });
  assert.equal(fitWorkingSize(100, 50, 2000, true).width, 400);
  assert.equal(fitWorkingSize(100, 50, 2000, false).width, 100);
});

test("skalowanie z alfą przemnożoną nie przyciemnia krawędzi", () => {
  const image = makeImage(4, 4, (x) => (x < 2 ? [255, 0, 0, 255] : [0, 0, 0, 0]));
  const small = resizeImage(image, 2, 2);
  const p = small.data;
  assert.equal(p[0], 255);
  assert.equal(p[7], 0);
});

test("kwantyzacja auto: 3 kolory płaskie → paleta 3 barw, przezroczystość zachowana", () => {
  const image = makeImage(60, 40, (x, y) => {
    if (y < 5) return [0, 0, 0, 0];
    if (x < 20) return [230, 60, 40];
    if (x < 40) return [30, 120, 220];
    return [245, 240, 230];
  });
  const q = quantizeImage(image, { colors: 32, auto: true });
  assert.equal(q.palette.length, 3);
  assert.ok(q.error95 < 0.02);
  assert.equal(q.labels[0], TRANSPARENT_LABEL);
  assert.equal(q.image.data[3], 0);
  assert.equal(q.image.data[(10 * 60 + 5) * 4 + 3], 255);
});

// ── Ustawienia ────────────────────────────────────────────────────────────────
test("ustawienia: presety spełniają schemat, złe pola wracają do domyślnych", () => {
  for (const preset of PRESETS) assert.ok(traceSettingsSchema.safeParse(preset.settings).success, preset.id);
  const parsed = parseSettings({ ...DEFAULT_SETTINGS, colors: 9999, smoothing: 2 });
  assert.equal(parsed.colors, DEFAULT_SETTINGS.colors);
  assert.equal(parsed.smoothing, 2);
  assert.deepEqual(parseSettings("śmieci"), DEFAULT_SETTINGS);
});

test("ustawienia: geometria vs warstwy", () => {
  assert.ok(needsRetrace(DEFAULT_SETTINGS, { ...DEFAULT_SETTINGS, colors: 12 }));
  assert.ok(!needsRetrace(DEFAULT_SETTINGS, { ...DEFAULT_SETTINGS, layering: "tone" }));
  assert.ok(needsRelayer(DEFAULT_SETTINGS, { ...DEFAULT_SETTINGS, maxLayers: 4 }));
});

// ── Silnik + dokument (prawdziwy VTracer w WebAssembly) ──────────────────────
const graphic = sampleGraphic();
const logoSettings = getPreset("logo").settings;
const { doc, stats } = runPipeline({ working: graphic, sourceWidth: 240, sourceHeight: 160 }, logoSettings, tracer);

test("pipeline: paleta, ścieżki i statystyki", () => {
  assert.equal(doc.width, 240);
  assert.ok(doc.swatches.length >= 4 && doc.swatches.length <= 6, `kolorów: ${doc.swatches.length}`);
  assert.ok(doc.paths.length >= 4);
  assert.ok(doc.paths.every((p) => /^[MmLlHhVvCcSsQqTtAaZz0-9eE.,\-+\s]+$/.test(p.d)));
  assert.equal(stats.paths, doc.paths.length);
  const red = doc.swatches.find(
    (s) => deltaE(rgbToOklab(hexToRgb(s.hex) ?? [0, 0, 0]), rgbToOklab([220, 40, 40])) < 0.03,
  );
  assert.ok(red, "czerwień w palecie");
});

test("pipeline: wykryte tło trafia do osobnej warstwy na dole", () => {
  const white = doc.swatches.find((s) => s.hex === "#fafaf8");
  assert.ok(white && doc.backgroundSwatches.includes(white.id));
  assert.equal(doc.layers[0].name, "Tło");
  assert.equal(doc.layers[0].kind, "background");
  const assigned = new Set(doc.layers.flatMap((l) => l.groups.flatMap((g) => g.pathIds)));
  assert.equal(assigned.size, doc.paths.length, "każda ścieżka w dokładnie jednej grupie");
});

test("warstwy: strategie kolor/ton/rozmiar/jedna + limit warstw", () => {
  const base = { ...doc };
  const options = {
    strategy: "color" as const,
    maxLayers: 12,
    separateBackground: false,
    groupObjects: true,
    groupGap: 1.5,
  };
  const byColor = buildLayers(base, options);
  assert.equal(byColor.length, new Set(doc.paths.map((p) => p.swatch)).size);
  assert.equal(buildLayers(base, { ...options, strategy: "single" }).length, 1);
  assert.ok(buildLayers(base, { ...options, strategy: "auto", maxLayers: 2 }).length <= 2);
  assert.ok(buildLayers(base, { ...options, strategy: "tone" }).length >= 2);
  const size = buildLayers(base, { ...options, strategy: "size" });
  assert.ok(size.every((l) => l.kind === "size"));
});

test("warstwy: grupowanie bliskich kształtów w obiekty", () => {
  const box = (id: number, x: number, y: number): VectorPath => ({
    id,
    d: "M0 0Z",
    swatch: 0,
    area: 100,
    bounds: [x, y, x + 10, y + 10],
    touchesEdge: false,
    segments: 4,
  });
  const groups = groupNearbyPaths([box(0, 0, 0), box(1, 12, 0), box(2, 200, 200)], 5);
  assert.equal(groups.length, 2);
});

test("tło: brak dominującego koloru krawędzi = brak tła", () => {
  const swatches: Swatch[] = [
    { id: 0, hex: "#ff0000", originalHex: "#ff0000", area: 1, hidden: false, name: "a" },
    { id: 1, hex: "#0000ff", originalHex: "#0000ff", area: 1, hidden: false, name: "b" },
    { id: 2, hex: "#00ff00", originalHex: "#00ff00", area: 1, hidden: false, name: "c" },
    { id: 3, hex: "#ffff00", originalHex: "#ffff00", area: 1, hidden: false, name: "d" },
  ];
  const border = Uint8ClampedArray.from([255, 0, 0, 0, 0, 255, 0, 255, 0, 255, 255, 0]);
  assert.deepEqual(detectBackgroundSwatches(border, swatches), []);
});

test("stos: warstwy to ciągłe wycinki kolejności rysowania", () => {
  const stacked = runPipeline(
    { working: graphic, sourceWidth: 240, sourceHeight: 160 },
    { ...logoSettings, layout: "stacked" },
    tracer,
  ).doc;
  const order = stacked.layers.flatMap((l) => l.groups.flatMap((g) => g.pathIds));
  assert.deepEqual(
    order,
    [...order].sort((a, b) => a - b),
  );
});

test("czarno-biały: line art daje kształty jednego koloru", () => {
  const bw = runPipeline(
    { working: graphic, sourceWidth: 240, sourceHeight: 160 },
    getPreset("lineart").settings,
    tracer,
  ).doc;
  assert.ok(bw.paths.length > 0);
  assert.equal(bw.colorMode, "bw");
});

test("wyjście silnika: grupy <g fill> są dziedziczone", () => {
  const raw = parseTracedSvg(
    '<svg width="10" height="10"><g fill="#ABCDEF"><path d="M0 0L1 1Z"/></g><path d="M0 0Z" fill="#000000"/></svg>',
  );
  assert.deepEqual(
    raw.paths.map((p) => p.fill),
    ["#abcdef", "#000000"],
  );
});

// ── Edycje ────────────────────────────────────────────────────────────────────
function asDoc(patch: edits.DocPatch): VectorDocument {
  return { ...doc, ...patch };
}

test("edycje: przekolorowanie tworzy próbkę i przenosi pole", () => {
  const ids = doc.paths.filter((p) => p.swatch === doc.paths[0].swatch).map((p) => p.id);
  const next = asDoc(edits.recolorPaths(doc, ids, "#123456"));
  const swatch = next.swatches.find((s) => s.hex === "#123456");
  assert.ok(swatch);
  assert.ok(ids.every((id) => next.paths[id].swatch === swatch.id));
  assert.ok(swatch.area > 0);
});

test("edycje: scalanie kolorów, usuwanie i przenoszenie do nowej warstwy", () => {
  const [a, b] = doc.swatches;
  const merged = asDoc(edits.mergeSwatch(doc, a.id, b.id));
  assert.ok(!merged.swatches.some((s) => s.id === a.id));
  assert.ok(merged.paths.every((p) => p.swatch !== a.id));

  const removed = asDoc(edits.removePaths(doc, [0]));
  assert.ok(removed.paths[0].removed);
  assert.ok(!removed.layers.some((l) => l.groups.some((g) => g.pathIds.includes(0))));

  const moved = asDoc(edits.movePathsToLayer(doc, [1, 2], null, "Moja"));
  const custom = moved.layers[moved.layers.length - 1];
  assert.equal(custom.name, "Moja");
  assert.deepEqual(custom.groups[0].pathIds, [1, 2]);
  assert.equal(
    edits.selectablePathIds(asDoc(edits.toggleLayerLocked(moved, custom.id))).filter((id) => id === 1).length,
    0,
  );
});

test("edycje: kolejność, scalanie warstw i tryb solo", () => {
  if (doc.layers.length < 2) return;
  const top = doc.layers[doc.layers.length - 1];
  const down = asDoc(edits.moveLayer(doc, top.id, -1));
  assert.equal(down.layers[down.layers.length - 2].id, top.id);
  const merged = asDoc(edits.mergeLayerDown(doc, top.id));
  assert.equal(merged.layers.length, doc.layers.length - 1);
  const solo = asDoc(edits.soloLayer(doc, top.id));
  assert.ok(solo.layers.every((l) => l.visible === (l.id === top.id)));
  assert.ok(asDoc(edits.soloLayer(solo, top.id)).layers.every((l) => l.visible));
});

// ── Eksport ───────────────────────────────────────────────────────────────────
const exportOptions: VectorExportOptions = {
  size: { ...defaultExportSize(doc), unit: "mm", width: 100, height: (100 * doc.height) / doc.width },
  background: null,
  gapFill: 0.6,
  title: "Test · zażółć gęślą jaźń",
};

test("jednostki: mm → pt, konwersja rozmiaru, piksele rastra", () => {
  assert.ok(Math.abs(toPoints(25.4, "mm", 300) - 72) < 1e-9);
  const inches = convertSize({ width: 254, height: 127, unit: "mm", dpi: 300 }, "in");
  assert.ok(Math.abs(inches.width - 10) < 1e-9);
  assert.deepEqual(rasterPixels({ width: 1, height: 0.5, unit: "in", dpi: 300 }), { width: 300, height: 150 });
});

test("SVG: warstwy Inkscape, viewBox, escapowanie tytułu", () => {
  const svg = buildSvg(doc, exportOptions);
  assert.ok(svg.startsWith('<?xml version="1.0" encoding="UTF-8"?>'));
  assert.ok(svg.includes(`viewBox="0 0 ${doc.width} ${doc.height}"`));
  assert.ok(svg.includes('width="100mm"'));
  assert.equal((svg.match(/inkscape:groupmode="layer"/g) ?? []).length, visibleLayers(doc).length);
  assert.equal((svg.match(/<path /g) ?? []).length, doc.paths.length);
  assert.ok(svg.includes("<title>Test · zażółć gęślą jaźń</title>"));
  const onlyBg = buildSvg(doc, { ...exportOptions, layerIds: new Set([doc.layers[0].id]) });
  assert.equal((onlyBg.match(/inkscape:groupmode="layer"/g) ?? []).length, 1);
});

test("PDF: nagłówek, poprawne przesunięcia xref, warstwy OCG", () => {
  for (const compress of [false, true]) {
    const pdf = buildPdf(doc, { ...exportOptions, compress, now: new Date(Date.UTC(2026, 9, 13)) });
    const text = Buffer.from(pdf).toString("latin1");
    assert.ok(text.startsWith("%PDF-1.5"));
    assert.ok(text.trimEnd().endsWith("%%EOF"));
    const startxref = Number(/startxref\n(\d+)/.exec(text)?.[1]);
    assert.ok(text.slice(startxref).startsWith("xref"));
    const entries = [...text.slice(startxref).matchAll(/(\d{10}) 00000 n /g)].map((m) => Number(m[1]));
    entries.forEach((offset, index) =>
      assert.ok(text.slice(offset).startsWith(`${index + 1} 0 obj`), `obiekt ${index + 1}`),
    );
    assert.equal((text.match(/\/Type \/OCG/g) ?? []).length, visibleLayers(doc).length);
    const mediaBox = /\/MediaBox \[0 0 ([\d.]+) ([\d.]+)\]/.exec(text);
    assert.ok(mediaBox && Math.abs(Number(mediaBox[1]) - 283.4646) < 0.01, "100 mm = 283,46 pt");
  }
});

test("EPS: nagłówek DSC i ramka", () => {
  const eps = buildEps(doc, { ...exportOptions, now: new Date(0) });
  assert.ok(eps.startsWith("%!PS-Adobe-3.0 EPSF-3.0"));
  assert.ok(/%%BoundingBox: 0 0 284 \d+/.test(eps));
  assert.ok(eps.includes("%%Title: Test  zazolc gesla jazn") || eps.includes("%%Title: Test"));
  assert.ok(eps.trimEnd().endsWith("%%EOF"));
  assert.ok(!/[^\x00-\x7f]/.test(eps), "tylko ASCII");
});

test("DXF: sekcje R12, tabela warstw, zamknięte polilinie w mm", () => {
  const dxf = buildDxf(doc, { size: exportOptions.size, unit: "mm", tolerance: 0.05 });
  const lines = dxf.split("\r\n");
  assert.ok(dxf.includes("AC1009"));
  assert.equal(lines[lines.length - 2], "EOF");
  assert.ok(dxf.includes("$INSUNITS\r\n70\r\n4"));
  const polylines = (dxf.match(/\r\nPOLYLINE\r\n/g) ?? []).length;
  const seqends = (dxf.match(/\r\nSEQEND\r\n/g) ?? []).length;
  assert.ok(polylines > 0 && polylines === seqends);
  assert.ok(/\r\nLAYER\r\n2\r\nTLO\r\n/.test(dxf), "warstwa TŁO → TLO");
  assert.equal(nearestAci([255, 0, 0]), 1);
});

test("Paleta: ASE (nagłówek + bloki), GPL, CSS", () => {
  const swatches = usedSwatches(doc);
  const ase = buildAse(swatches);
  const view = new DataView(ase.buffer);
  assert.equal(String.fromCharCode(...ase.subarray(0, 4)), "ASEF");
  assert.equal(view.getUint16(4), 1);
  assert.equal(view.getUint32(8), swatches.length);
  assert.ok(buildGpl(swatches, "T").startsWith("GIMP Palette\nName: T\n"));
  assert.ok(buildCss(swatches).includes("--wektor-1: oklch("));
});

test("ZIP: całość, każda warstwa osobno i paleta", () => {
  const files = unzipSync(buildLayersZip(doc, exportOptions));
  const names = Object.keys(files);
  assert.ok(names.some((n) => n.endsWith(".svg") && !n.includes("/")));
  assert.equal(names.filter((n) => n.startsWith("warstwy/")).length, visibleLayers(doc).length);
  assert.ok(names.includes("paleta/paleta.ase"));
  assert.ok(strFromU8(files["paleta/paleta.gpl"]).startsWith("GIMP Palette"));
});

test("eksport pomija ukryte warstwy i ukryte kolory", () => {
  const hiddenLayer = asDoc(edits.toggleLayerVisible(doc, doc.layers[0].id));
  assert.equal(visibleLayers(hiddenLayer).length, visibleLayers(doc).length - 1);
  const hiddenSwatch = asDoc(edits.toggleSwatchHidden(doc, doc.swatches[0].id));
  const svg = buildSvg(hiddenSwatch, exportOptions);
  assert.ok(!svg.includes(`fill="${doc.swatches[0].hex}"`));
});

// ── Obrys całości ─────────────────────────────────────────────────────────────
test("obrys: maska sylwetki wypełnia otwory i pomija tło połączone z krawędzią", () => {
  // Pierścień (czerwony) na białym tle — otwór w środku też jest biały.
  const ring = makeImage(40, 40, (x, y) => {
    const r = Math.hypot(x - 20, y - 20);
    return r < 14 && r > 6 ? [200, 30, 30] : [255, 255, 255];
  });
  const filled = silhouetteMask(ring, { backgroundColors: [[255, 255, 255]], fillHoles: true });
  const holed = silhouetteMask(ring, { backgroundColors: [[255, 255, 255]], fillHoles: false });
  const center = 20 * 40 + 20;
  assert.equal(filled[center], 1, "otwór wypełniony");
  assert.equal(holed[center], 0, "otwór zostaje");
  assert.equal(filled[0], 0, "narożnik to tło");
});

test("obrys: odsunięcie EDT jest dokładne (okrągłe)", () => {
  const mask = new Uint8Array(41 * 41);
  mask[20 * 41 + 20] = 1;
  const grown = dilateMask(mask, 41, 41, 10);
  let count = 0;
  for (const v of grown) count += v;
  assert.ok(Math.abs(count - Math.PI * 100) / (Math.PI * 100) < 0.05, `pole ${count}`);
  assert.equal(grown[20 * 41 + 30], 1);
  assert.equal(grown[30 * 41 + 30], 0, "przekątna poza promieniem");
});

const outlined = runPipeline(
  { working: graphic, sourceWidth: 240, sourceHeight: 160 },
  { ...logoSettings, outline: true, outlineOffset: 0 },
  tracer,
).doc;

test("obrys: pipeline dołącza kontur, odsunięcie go powiększa", () => {
  assert.ok(outlined.outline?.d, "jest obrys");
  const base = geometryBounds(parsePathData(outlined.outline.d));
  const wider = runPipeline(
    { working: graphic, sourceWidth: 240, sourceHeight: 160 },
    { ...logoSettings, outline: true, outlineOffset: 4 },
    tracer,
  ).doc;
  assert.ok(wider.outline?.d);
  const grown = geometryBounds(parsePathData(wider.outline.d));
  assert.ok(grown[0] < base[0] && grown[2] > base[2], `${base} → ${grown}`);
  const off = runPipeline({ working: graphic, sourceWidth: 240, sourceHeight: 160 }, logoSettings, tracer).doc;
  assert.equal(off.outline, null);
});

test("obrys: eksport SVG/PDF/EPS/DXF/ZIP z warstwą obrysu", () => {
  const style = outlineStyle(
    { ...logoSettings, outlineColor: "#ff00aa", outlineWidth: 0.5 },
    outlined.width,
    outlined.height,
  );
  const opts: VectorExportOptions = { ...exportOptions, outline: style };
  const svg = buildSvg(outlined, opts);
  assert.ok(svg.includes('id="obrys"') && svg.includes('stroke="#ff00aa"') && svg.includes('fill="none"'));
  assert.ok(svg.indexOf('id="obrys"') > svg.lastIndexOf('<path fill="#'), "linia na wierzchu");
  const backing = buildSvg(outlined, { ...opts, outline: { ...style, mode: "backing" } });
  assert.ok(backing.indexOf('id="obrys"') < backing.indexOf('inkscape:label="Tło"'), "podkład pod grafiką");
  const pdf = Buffer.from(buildPdf(outlined, { ...opts, compress: false })).toString("latin1");
  assert.equal((pdf.match(/\/Type \/OCG/g) ?? []).length, visibleLayers(outlined).length + 1);
  assert.ok(buildEps(outlined, opts).includes("% Obrys"));
  const dxf = buildDxf(outlined, { size: opts.size, unit: "mm", tolerance: 0.05, outline: style });
  assert.ok(/\r\nLAYER\r\n2\r\nOBRYS\r\n/.test(dxf));
  const cutOnly = buildDxf(outlined, {
    size: opts.size,
    unit: "mm",
    tolerance: 0.05,
    outline: style,
    onlyOutline: true,
  });
  assert.ok(!/\r\n8\r\nTLO\r\n/.test(cutOnly) && /\r\n8\r\nOBRYS\r\n/.test(cutOnly), "tylko warstwa OBRYS");
  assert.ok(
    buildDxfPreviewSvg(outlined, { size: opts.size, unit: "mm", tolerance: 0.05, outline: style }).includes("<polygon"),
  );
  const zipNames = Object.keys(unzipSync(buildLayersZip(outlined, opts)));
  assert.ok(zipNames.some((n) => n.endsWith("-obrys.svg")));
  const hidden = { ...outlined, outline: outlined.outline ? { ...outlined.outline, visible: false } : null };
  assert.ok(!buildSvg(hidden, opts).includes('id="obrys"'), "ukryty obrys pomijany");
});

// ── Podgląd na żywo i presety ─────────────────────────────────────────────────
test("podgląd roboczy: mniejsza rozdzielczość, progi skalowane, małe obrazy bez podglądu", () => {
  const draft = scaledSettings({ ...DEFAULT_SETTINGS, speckle: 8, simplify: 2 }, 4000, 3000, 720);
  assert.ok(draft);
  assert.equal(draft.workingSize, 720);
  assert.equal(draft.speckle, Math.round(8 * (720 / 2000)));
  assert.equal(scaledSettings({ ...DEFAULT_SETTINGS, upscale: false }, 600, 400, 720), null);
  // Z powiększaniem mały obraz pracuje w 2000 px — podgląd roboczy realnie przyspiesza.
  assert.ok(scaledSettings(DEFAULT_SETTINGS, 600, 400, 720));
});

test("presety użytkownika: walidacja odrzuca uszkodzone wpisy", () => {
  const good = createUserPreset("  Naklejki  ", DEFAULT_SETTINGS);
  assert.equal(good.name, "Naklejki");
  const parsed = parseUserPresets([good, { id: "x", name: "", settings: {} }, "śmieci"]);
  assert.equal(parsed.length, 1);
  assert.deepEqual(parseUserPresets(null), []);
});

test("obrys nie jest częścią presetu", () => {
  assert.ok(OUTLINE_FIELDS.has("outlineColor"));
  assert.ok(!needsRetrace(DEFAULT_SETTINGS, { ...DEFAULT_SETTINGS, outline: true, outlineOffset: 3 }));
  assert.ok(needsOutline(DEFAULT_SETTINGS, { ...DEFAULT_SETTINGS, outline: true }));
  assert.ok(!needsOutline(DEFAULT_SETTINGS, { ...DEFAULT_SETTINGS, outlineColor: "#ffffff" }));
});

test("polska odmiana liczebników", () => {
  const forms = (n: number) => plural(n, "warstwa", "warstwy", "warstw");
  assert.deepEqual([1, 2, 4, 5, 12, 14, 22, 25, 112].map(forms), [
    "warstwa",
    "warstwy",
    "warstwy",
    "warstw",
    "warstw",
    "warstw",
    "warstwy",
    "warstw",
    "warstw",
  ]);
});

// ── Pliki wejściowe ───────────────────────────────────────────────────────────
test("wejście: rozpoznanie formatu po bajtach, odrzucenie SVG i zbyt dużych plików", () => {
  const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
  const jpeg = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]);
  const svg = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"/>');
  assert.equal(sniffImageKind(png), "png");
  assert.equal(sniffImageKind(jpeg), "jpeg");
  assert.equal(sniffImageKind(svg), null);
  assert.deepEqual(checkInputFile("a.png", 1000, png), { ok: true, kind: "png" });
  assert.equal(checkInputFile("a.png", 200 * 1024 * 1024, png).ok, false);
  assert.equal(checkInputFile("a.svg", 100, svg).ok, false);
});

console.log(`✓ wektoryzator: ${passed} testów OK`);
