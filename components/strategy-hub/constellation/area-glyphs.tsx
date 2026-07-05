/**
 * Autorskie glify 7 obszarów strategii (zero-stock) — styl „gwiezdny minimalizm":
 * stroke 1.3, grid 12×12 wycentrowany w (0,0), zaokrąglone końcówki.
 */

import type { StrategyArea } from "@/lib/strategy-hub/entities/entity-types";

interface AreaGlyphProps {
  area: StrategyArea;
  /** Skala względem bazowego gridu 12×12. */
  scale?: number;
  color?: string;
}

const GLYPHS: Record<StrategyArea, React.ReactNode> = {
  // kamień węgielny
  fundament: <path d="M0 -5 L5 4 H-5 Z" />,
  // trzy punkty na orbicie
  segmenty: (
    <>
      <circle r={4.5} />
      <circle cx={0} cy={-4.5} r={1.2} fill="currentColor" stroke="none" />
      <circle cx={3.9} cy={2.2} r={1.2} fill="currentColor" stroke="none" />
      <circle cx={-3.9} cy={2.2} r={1.2} fill="currentColor" stroke="none" />
    </>
  ),
  // strumień przez klepsydrę
  lejek: <path d="M-5.5 -4.5 H5.5 L2.5 0 H5.5 L-5.5 4.5 L-2.5 0 H-5.5 Z" />,
  // rozgałęziona strzałka
  kanaly: (
    <path d="M-5 0 H3 M0 -4 L5 0 L0 4 M-5 0 L-2.5 -3.5 M-5 0 L-2.5 3.5" />
  ),
  // fale sygnału
  przekaz: (
    <path d="M-5 -3 C-2 -5 2 -1 5 -3 M-5 1 C-2 -1 2 3 5 1 M-5 5 C-2 3 2 7 5 5" />
  ),
  // ramka z linią hero
  strona: (
    <>
      <rect x={-5} y={-5} width={10} height={10} rx={1.2} />
      <path d="M-5 -1.5 H5 M-3 1.5 H1" />
    </>
  ),
  // słupki wznoszące
  kpi: <path d="M-4.5 4.5 V0 M0 4.5 V-4.5 M4.5 4.5 V-1.5" />,
};

export function AreaGlyph({ area, scale = 1, color = "#EFE7CE" }: AreaGlyphProps) {
  return (
    <g
      transform={scale === 1 ? undefined : `scale(${scale})`}
      fill="none"
      stroke={color}
      strokeWidth={1.3}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {GLYPHS[area]}
    </g>
  );
}
