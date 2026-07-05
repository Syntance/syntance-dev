/**
 * Tokeny wizualne Konstelacji — „nocne niebo strategii" (docs/strategy-hub-2.0/10-design-konstelacja.md).
 * Scope: wyłącznie komponenty konstelacji; nie zmienia globalnej palety aplikacji.
 */

export const KONST = {
  bg: "#16130E",
  bgVignette:
    "radial-gradient(ellipse 75% 65% at 50% 45%, transparent 50%, rgba(8,6,3,0.5) 100%)",
  node: "#EFE7CE",
  nodeBright: "#F4EDD6",
  nodeDim: "rgba(239,231,206,0.55)",
  chrome: "#1E1A13",
  chromeSide: "#1C1B18",
  chromeBg: "rgba(33,29,21,0.92)",
  chromeBorder: "#3A342A",
  edge: "rgba(231,223,198,0.22)",
  edgeBright: "rgba(237,228,200,0.5)",
  cross: "rgba(231,223,198,0.18)",
  crossAi: "rgba(216,178,122,0.42)",
  display: "#E9E1C6",
  label: "#CFC7AC",
  muted: "#8E8672",
  watermark: "rgba(233,225,198,0.07)",
  orbit: "rgba(231,223,198,0.05)",
  star: "#D8D2C0",
  up: "#9FB2DC",
  upText: "#AEB9D6",
  upEdgeLabel: "#8D9BC0",
  upDot: "#CBD6EE",
  down: "#E3BE85",
  downText: "#DEC69A",
  downEdgeLabel: "#C6A876",
  downDot: "#F0DCB6",
  halo: "rgba(232,185,106,0.1)",
  spark: "#E3AE63",
  ember: "#C97F52",
  review: "#FACC15",
  empty: "rgba(248,113,113,0.7)",
  pathHighlight: "#E3BE85",
} as const;

/** Deterministyczny PRNG (mulberry32 z hashem stringa) — stabilny render między sesjami. */
export function seededRandom(seed: string): () => number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface StarPoint {
  x: number;
  y: number;
  r: number;
  o: number;
}

/** Gwiazdy w przestrzeni ekranu (poza kamerą) — nie skalują się przy zoomie. */
export function generateStars(
  seed: string,
  count: number,
  width: number,
  height: number
): StarPoint[] {
  const rand = seededRandom(`stars:${seed}`);
  const stars: StarPoint[] = [];
  for (let i = 0; i < count; i++) {
    stars.push({
      x: Math.round(rand() * width),
      y: Math.round(rand() * height),
      r: 0.6 + rand() * 0.9,
      o: 0.1 + rand() * 0.18,
    });
  }
  return stars;
}

export interface BurstParticle {
  x: number;
  y: number;
  r: number;
  color: string;
}

export interface CoreBurst {
  particles: BurstParticle[];
  /** Kąty promienistych iskier (linie od centrum). */
  sparkAngles: number[];
}

/** Rozbłysk rdzenia — klaster drobin, unikalny per projekt (seed = projectId). */
export function generateCoreBurst(seed: string, radius = 26): CoreBurst {
  const rand = seededRandom(`burst:${seed}`);
  const particles: BurstParticle[] = [];
  const count = 46 + Math.floor(rand() * 14);
  for (let i = 0; i < count; i++) {
    const angle = rand() * 2 * Math.PI;
    // gęściej przy środku (sqrt odwrócone przez potęgę)
    const dist = Math.pow(rand(), 1.6) * radius;
    const t = rand();
    const color =
      t < 0.82 ? KONST.node : t < 0.94 ? KONST.spark : KONST.ember;
    particles.push({
      x: Math.cos(angle) * dist,
      y: Math.sin(angle) * dist,
      r: 0.6 + Math.pow(rand(), 2) * 2,
      color,
    });
  }
  const sparkAngles: number[] = [];
  const sparks = 5 + Math.floor(rand() * 2);
  for (let i = 0; i < sparks; i++) {
    sparkAngles.push(rand() * 2 * Math.PI);
  }
  return { particles, sparkAngles };
}
