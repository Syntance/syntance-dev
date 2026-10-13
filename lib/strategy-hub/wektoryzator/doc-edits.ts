/**
 * Edycje dokumentu jako czyste funkcje (niemutowalne) — store składa z nich historię cofnij/ponów,
 * a testy sprawdzają je bez przeglądarki.
 */
import { hexToOklab, normalizeHex } from "./engine/color";
import { colorName } from "./engine/color-names";
import type { Swatch, VectorDocument, VectorGroup, VectorLayer, VectorPath } from "./engine/document";

export type DocPatch = Pick<VectorDocument, "paths" | "swatches" | "layers">;

function mapLayer(doc: VectorDocument, layerId: string, update: (layer: VectorLayer) => VectorLayer): DocPatch {
  return { ...doc, layers: doc.layers.map((layer) => (layer.id === layerId ? update(layer) : layer)) };
}

function pruneEmptyGroups(layers: VectorLayer[]): VectorLayer[] {
  return layers.map((layer) => {
    const groups = layer.groups.filter((g) => g.pathIds.length > 0);
    return groups.length === layer.groups.length ? layer : { ...layer, groups };
  });
}

export function setSwatchHex(doc: VectorDocument, swatchId: number, hex: string): DocPatch {
  const value = normalizeHex(hex);
  if (!value) return doc;
  return {
    ...doc,
    swatches: doc.swatches.map((s) =>
      s.id === swatchId ? { ...s, hex: value, name: colorName(hexToOklab(value)) } : s,
    ),
  };
}

export function resetSwatch(doc: VectorDocument, swatchId: number): DocPatch {
  const swatch = doc.swatches.find((s) => s.id === swatchId);
  return swatch ? setSwatchHex(doc, swatchId, swatch.originalHex) : doc;
}

export function toggleSwatchHidden(doc: VectorDocument, swatchId: number): DocPatch {
  return { ...doc, swatches: doc.swatches.map((s) => (s.id === swatchId ? { ...s, hidden: !s.hidden } : s)) };
}

/** Kształty koloru `fromId` przyjmują kolor `intoId`; próbka `fromId` znika z palety. */
export function mergeSwatch(doc: VectorDocument, fromId: number, intoId: number): DocPatch {
  if (fromId === intoId) return doc;
  const from = doc.swatches.find((s) => s.id === fromId);
  if (!from || !doc.swatches.some((s) => s.id === intoId)) return doc;
  return {
    ...doc,
    paths: doc.paths.map((p) => (p.swatch === fromId ? { ...p, swatch: intoId } : p)),
    swatches: doc.swatches
      .filter((s) => s.id !== fromId)
      .map((s) => (s.id === intoId ? { ...s, area: s.area + from.area } : s)),
  };
}

/** Nadaje kształtom kolor — istniejąca próbka o tym samym hex albo nowa. */
export function recolorPaths(doc: VectorDocument, ids: readonly number[], hex: string): DocPatch {
  const value = normalizeHex(hex);
  if (!value || ids.length === 0) return doc;
  let swatches: Swatch[] = doc.swatches;
  let target = swatches.find((s) => s.hex === value);
  if (!target) {
    target = {
      id: swatches.reduce((max, s) => Math.max(max, s.id), -1) + 1,
      hex: value,
      originalHex: value,
      area: 0,
      hidden: false,
      name: colorName(hexToOklab(value)),
    };
    swatches = [...swatches, target];
  }
  const targetId = target.id;
  const selected = new Set(ids);
  const moved = new Map<number, number>();
  const paths = doc.paths.map((p) => {
    if (!selected.has(p.id) || p.swatch === targetId) return p;
    moved.set(p.swatch, (moved.get(p.swatch) ?? 0) + p.area);
    moved.set(targetId, (moved.get(targetId) ?? 0) - p.area);
    return { ...p, swatch: targetId };
  });
  return {
    ...doc,
    paths,
    swatches: swatches.map((s) => (moved.has(s.id) ? { ...s, area: Math.max(0, s.area - (moved.get(s.id) ?? 0)) } : s)),
  };
}

export function removePaths(doc: VectorDocument, ids: readonly number[]): DocPatch {
  if (ids.length === 0) return doc;
  const removed = new Set(ids);
  return {
    ...doc,
    paths: doc.paths.map((p) => (removed.has(p.id) ? { ...p, removed: true } : p)),
    layers: pruneEmptyGroups(
      doc.layers.map((layer) => ({
        ...layer,
        groups: layer.groups.map((g) => ({ ...g, pathIds: g.pathIds.filter((id) => !removed.has(id)) })),
      })),
    ),
  };
}

/** Przenosi kształty do warstwy (do jej grupy „Przeniesione”) albo do nowej warstwy. */
export function movePathsToLayer(
  doc: VectorDocument,
  ids: readonly number[],
  targetLayerId: string | null,
  newLayerName = "Nowa warstwa",
): DocPatch {
  if (ids.length === 0) return doc;
  const moving = new Set(ids);
  const ordered = [...moving].sort((a, b) => a - b);
  let layers = doc.layers.map((layer) => ({
    ...layer,
    groups: layer.groups.map((g) => ({ ...g, pathIds: g.pathIds.filter((id) => !moving.has(id)) })),
  }));
  const targetId = targetLayerId ?? `layer-custom-${Date.now().toString(36)}`;
  if (targetLayerId === null) {
    const created: VectorLayer = {
      id: targetId,
      name: newLayerName,
      kind: "custom",
      visible: true,
      locked: false,
      groups: [{ id: `${targetId}/g1`, name: "Kształty", visible: true, pathIds: ordered }],
    };
    layers = [...layers, created];
  } else {
    layers = layers.map((layer) => {
      if (layer.id !== targetId) return layer;
      const groupId = `${targetId}/przeniesione`;
      const existing = layer.groups.find((g) => g.id === groupId);
      const groups: VectorGroup[] = existing
        ? layer.groups.map((g) =>
            g.id === groupId ? { ...g, pathIds: [...g.pathIds, ...ordered].sort((a, b) => a - b) } : g,
          )
        : [...layer.groups, { id: groupId, name: "Przeniesione", visible: true, pathIds: ordered }];
      return { ...layer, groups };
    });
  }
  return { ...doc, layers: pruneEmptyGroups(layers) };
}

export function toggleLayerVisible(doc: VectorDocument, layerId: string): DocPatch {
  return mapLayer(doc, layerId, (l) => ({ ...l, visible: !l.visible }));
}

/** Pokaż tylko tę warstwę (ponowne kliknięcie przywraca wszystkie). */
export function soloLayer(doc: VectorDocument, layerId: string): DocPatch {
  const alreadySolo = doc.layers.every((l) => l.visible === (l.id === layerId));
  return { ...doc, layers: doc.layers.map((l) => ({ ...l, visible: alreadySolo ? true : l.id === layerId })) };
}

export function toggleLayerLocked(doc: VectorDocument, layerId: string): DocPatch {
  return mapLayer(doc, layerId, (l) => ({ ...l, locked: !l.locked }));
}

export function renameLayer(doc: VectorDocument, layerId: string, name: string): DocPatch {
  const trimmed = name.trim().slice(0, 80);
  return trimmed ? mapLayer(doc, layerId, (l) => ({ ...l, name: trimmed })) : doc;
}

/** delta > 0 = wyżej (bliżej wierzchu). Tablica warstw jest od dołu do góry. */
export function moveLayer(doc: VectorDocument, layerId: string, delta: number): DocPatch {
  const index = doc.layers.findIndex((l) => l.id === layerId);
  const target = index + delta;
  if (index < 0 || target < 0 || target >= doc.layers.length) return doc;
  const layers = [...doc.layers];
  const [layer] = layers.splice(index, 1);
  layers.splice(target, 0, layer);
  return { ...doc, layers };
}

export function deleteLayer(doc: VectorDocument, layerId: string): DocPatch {
  const layer = doc.layers.find((l) => l.id === layerId);
  if (!layer) return doc;
  const ids = layer.groups.flatMap((g) => g.pathIds);
  const removed = new Set(ids);
  return {
    ...doc,
    paths: doc.paths.map((p) => (removed.has(p.id) ? { ...p, removed: true } : p)),
    layers: doc.layers.filter((l) => l.id !== layerId),
  };
}

/** Scala warstwę z warstwą pod nią (grupy dołączane na końcu). */
export function mergeLayerDown(doc: VectorDocument, layerId: string): DocPatch {
  const index = doc.layers.findIndex((l) => l.id === layerId);
  if (index <= 0) return doc;
  const upper = doc.layers[index];
  const lower = doc.layers[index - 1];
  const merged: VectorLayer = {
    ...lower,
    visible: lower.visible || upper.visible,
    groups: [...lower.groups, ...upper.groups],
  };
  const layers = [...doc.layers];
  layers.splice(index - 1, 2, merged);
  return { ...doc, layers };
}

export function toggleGroupVisible(doc: VectorDocument, layerId: string, groupId: string): DocPatch {
  return mapLayer(doc, layerId, (l) => ({
    ...l,
    groups: l.groups.map((g) => (g.id === groupId ? { ...g, visible: !g.visible } : g)),
  }));
}

export function renameGroup(doc: VectorDocument, layerId: string, groupId: string, name: string): DocPatch {
  const trimmed = name.trim().slice(0, 80);
  if (!trimmed) return doc;
  return mapLayer(doc, layerId, (l) => ({
    ...l,
    groups: l.groups.map((g) => (g.id === groupId ? { ...g, name: trimmed } : g)),
  }));
}

export function deleteGroup(doc: VectorDocument, layerId: string, groupId: string): DocPatch {
  const group = doc.layers.find((l) => l.id === layerId)?.groups.find((g) => g.id === groupId);
  return group ? removePaths(doc, group.pathIds) : doc;
}

/** Kształty, które można zaznaczyć: widoczne, w odblokowanych warstwach, w widocznych kolorach. */
export function selectablePathIds(doc: VectorDocument): number[] {
  const hidden = new Set(doc.swatches.filter((s) => s.hidden).map((s) => s.id));
  const ids: number[] = [];
  for (const layer of doc.layers) {
    if (!layer.visible || layer.locked) continue;
    for (const group of layer.groups) {
      if (!group.visible) continue;
      for (const id of group.pathIds) {
        const path: VectorPath | undefined = doc.paths[id];
        if (path && !path.removed && !hidden.has(path.swatch)) ids.push(id);
      }
    }
  }
  return ids;
}

export function layerOfPath(doc: VectorDocument, pathId: number): VectorLayer | undefined {
  return doc.layers.find((l) => l.groups.some((g) => g.pathIds.includes(pathId)));
}
