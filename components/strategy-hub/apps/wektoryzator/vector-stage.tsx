"use client";

import { memo, useMemo, type CSSProperties } from "react";
import type {
  Swatch,
  VectorDocument,
  VectorGroup,
  VectorLayer,
  VectorPath,
} from "@/lib/strategy-hub/wektoryzator/engine/document";
import type { OutlineStyle } from "@/lib/strategy-hub/wektoryzator/engine/settings";
import { cn } from "@/lib/utils";
import styles from "./wektoryzator.module.css";

const HEX_RE = /^#[0-9a-f]{6}$/;

/** Kolory kształtów jako klasy — zmiana palety przepisuje tylko ten arkusz, nie tysiące ścieżek. */
function swatchStyles(swatches: readonly Swatch[], scope: string): string {
  const rules: string[] = [];
  for (const swatch of swatches) {
    if (!HEX_RE.test(swatch.hex)) continue;
    rules.push(`.${scope} .s${swatch.id}{fill:${swatch.hex};stroke:${swatch.hex}}`);
    if (swatch.hidden) rules.push(`.${scope} .s${swatch.id}{display:none}`);
  }
  return rules.join("\n");
}

const GroupPaths = memo(function GroupPaths({ group, paths }: { group: VectorGroup; paths: readonly VectorPath[] }) {
  return (
    <g data-group={group.id} display={group.visible ? undefined : "none"}>
      {group.pathIds.map((id) => {
        const path = paths[id];
        if (!path || path.removed) return null;
        return <path key={id} data-id={id} className={`s${path.swatch}`} d={path.d} />;
      })}
    </g>
  );
});

const LayerSvg = memo(function LayerSvg({
  layer,
  paths,
  viewBox,
  width,
  height,
  dim,
}: {
  layer: VectorLayer;
  paths: readonly VectorPath[];
  viewBox: string;
  width: number;
  height: number;
  dim: boolean;
}) {
  return (
    <svg
      className={styles.layer}
      viewBox={viewBox}
      width={width}
      height={height}
      preserveAspectRatio="none"
      data-layer={layer.id}
      data-locked={layer.locked}
      data-dim={dim}
      style={{ display: layer.visible ? undefined : "none" }}
      aria-hidden
    >
      {layer.groups.map((group) => (
        <GroupPaths key={group.id} group={group} paths={paths} />
      ))}
    </svg>
  );
});

function OutlineSvg({
  d,
  style,
  viewBox,
  width,
  height,
  cssStyle,
}: {
  d: string;
  style: OutlineStyle;
  viewBox: string;
  width: number;
  height: number;
  cssStyle?: CSSProperties;
}) {
  if (!HEX_RE.test(style.color)) return null;
  return (
    <svg
      className={styles.layer}
      viewBox={viewBox}
      width={width}
      height={height}
      preserveAspectRatio="none"
      data-outline-layer
      style={{ ...cssStyle, pointerEvents: "none" }}
      aria-hidden
    >
      {/* Grubość jako styl inline — wygrywa z regułą `.stage path { stroke-width: 0 }` arkusza płótna. */}
      <path
        d={d}
        fill={style.mode === "backing" ? style.color : "none"}
        stroke={style.color}
        strokeLinejoin="round"
        strokeLinecap="round"
        style={{ strokeWidth: style.width }}
      />
    </svg>
  );
}

export function VectorStage({
  doc,
  width,
  height,
  gapFill,
  outline,
  outlineStyle,
  exploded,
  zoom,
  hoverLayerId,
  clipPath,
  interactive = true,
}: {
  doc: VectorDocument;
  /** Wymiary sceny (mogą różnić się od dokumentu — podgląd roboczy w mniejszej rozdzielczości). */
  width: number;
  height: number;
  gapFill: boolean;
  outline: boolean;
  outlineStyle: OutlineStyle | null;
  exploded: boolean;
  zoom: number;
  hoverLayerId: string | null;
  clipPath?: string;
  interactive?: boolean;
}) {
  const css = useMemo(() => swatchStyles(doc.swatches, styles.stage), [doc.swatches]);
  const visible = doc.layers.filter((l) => l.visible);
  const spacing = 70 / Math.max(zoom, 0.05);
  const labelSize = 12 / Math.max(zoom, 0.05);
  const viewBox = `0 0 ${doc.width} ${doc.height}`;
  const shape = doc.outline?.visible && outlineStyle ? doc.outline : null;
  const backing = shape && outlineStyle?.mode === "backing";
  const depthOf = (index: number) => (index - (visible.length - 1) / 2) * spacing;

  return (
    <div
      className={cn(styles.stage, exploded && styles.explodable)}
      data-gap={gapFill && !outline ? "on" : "off"}
      data-outline={outline ? "on" : "off"}
      style={{ clipPath, pointerEvents: interactive ? undefined : "none" }}
    >
      <style>{css}</style>
      {shape && outlineStyle && backing ? (
        <div
          className={cn(styles.stage, exploded && styles.explodable)}
          style={{ transform: exploded ? `translateZ(${depthOf(-1)}px)` : undefined }}
        >
          <OutlineSvg d={shape.d} style={outlineStyle} viewBox={viewBox} width={width} height={height} />
        </div>
      ) : null}
      {doc.layers.map((layer) => {
        const depth = visible.indexOf(layer);
        const transform = exploded && depth >= 0 ? `translateZ(${depthOf(depth)}px)` : undefined;
        return (
          <div key={layer.id} className={cn(styles.stage, exploded && styles.explodable)} style={{ transform }}>
            <LayerSvg
              layer={layer}
              paths={doc.paths}
              viewBox={viewBox}
              width={width}
              height={height}
              dim={hoverLayerId !== null && hoverLayerId !== layer.id}
            />
            {exploded && layer.visible ? (
              <span className={styles.layerLabel} style={{ fontSize: labelSize }}>
                {layer.name}
              </span>
            ) : null}
          </div>
        );
      })}
      {shape && outlineStyle && !backing ? (
        <div
          className={cn(styles.stage, exploded && styles.explodable)}
          style={{ transform: exploded ? `translateZ(${depthOf(visible.length)}px)` : undefined }}
        >
          <OutlineSvg d={shape.d} style={outlineStyle} viewBox={viewBox} width={width} height={height} />
          {exploded ? (
            <span className={styles.layerLabel} style={{ fontSize: labelSize }}>
              Obrys
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function SelectionOverlay({ doc, selection }: { doc: VectorDocument; selection: readonly number[] }) {
  const paths = useMemo(
    () => selection.map((id) => doc.paths[id]).filter((p): p is VectorPath => p !== undefined && !p.removed),
    [doc.paths, selection],
  );
  if (paths.length === 0) return null;
  return (
    <svg
      className={cn(styles.layer, styles.selection)}
      viewBox={`0 0 ${doc.width} ${doc.height}`}
      width={doc.width}
      height={doc.height}
      style={{ pointerEvents: "none" }}
      aria-hidden
    >
      {paths.map((p) => (
        <path key={p.id} d={p.d} />
      ))}
    </svg>
  );
}

/** Miniatura dokumentu (presety) — wszystkie ścieżki z kolorami wprost, bez warstw. */
export const DocThumbnail = memo(function DocThumbnail({
  doc,
  className,
}: {
  doc: VectorDocument;
  className?: string;
}) {
  const fills = useMemo(() => new Map(doc.swatches.map((s) => [s.id, s.hex])), [doc.swatches]);
  return (
    <svg
      viewBox={`0 0 ${doc.width} ${doc.height}`}
      className={className}
      preserveAspectRatio="xMidYMid meet"
      aria-hidden
    >
      {doc.paths.map((p) => {
        if (p.removed) return null;
        const fill = fills.get(p.swatch) ?? "#000000";
        return <path key={p.id} d={p.d} fill={fill} stroke={fill} strokeWidth={0.6} />;
      })}
    </svg>
  );
});
