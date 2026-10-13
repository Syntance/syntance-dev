/**
 * Polskie nazwy kolorów z OKLCH — czytelne nazwy warstw („Ciemny brąz”, „Jasna zieleń”)
 * zamiast samych kodów hex.
 */
import { oklabToOklch, type Lab } from "./color";

type Gender = "m" | "f";

interface HueName {
  /** Górna granica kąta barwy (stopnie OKLCH). */
  until: number;
  name: string;
  gender: Gender;
}

// Granice wyznaczone dla kolorów referencyjnych: czerwień ≈ 29°, pomarańcz ≈ 55°, żółć ≈ 110°,
// zieleń ≈ 142°, cyjan ≈ 195°, niebieski ≈ 264°, magenta ≈ 328°.
const HUES: HueName[] = [
  { until: 12, name: "Róż", gender: "m" },
  { until: 42, name: "Czerwień", gender: "f" },
  { until: 70, name: "Pomarańcz", gender: "m" },
  { until: 100, name: "Ochra", gender: "f" },
  { until: 125, name: "Żółć", gender: "f" },
  { until: 170, name: "Zieleń", gender: "f" },
  { until: 215, name: "Turkus", gender: "m" },
  { until: 245, name: "Błękit", gender: "m" },
  { until: 285, name: "Granat", gender: "m" },
  { until: 320, name: "Fiolet", gender: "m" },
  { until: 345, name: "Purpura", gender: "f" },
  { until: 361, name: "Róż", gender: "m" },
];

function withTone(base: string, gender: Gender, lightness: number): string {
  if (lightness >= 0.82) return `${gender === "f" ? "Jasna" : "Jasny"} ${base.toLowerCase()}`;
  if (lightness <= 0.38) return `${gender === "f" ? "Ciemna" : "Ciemny"} ${base.toLowerCase()}`;
  return base;
}

export function colorName(lab: Lab): string {
  const { l, c, h } = oklabToOklch(lab);
  if (c < 0.028) {
    if (l >= 0.94) return "Biel";
    if (l >= 0.78) return "Jasna szarość";
    if (l >= 0.5) return "Szarość";
    if (l >= 0.26) return "Grafit";
    return "Czerń";
  }
  // Ciepłe barwy o niskim nasyceniu: beże i brązy.
  if (h >= 30 && h < 100 && c < 0.12) {
    if (l >= 0.72) return l >= 0.88 ? "Kremowy" : "Beż";
    if (l <= 0.55) return withTone("Brąz", "m", l + 0.15);
  }
  if (h >= 40 && h < 80 && l < 0.55) return withTone("Brąz", "m", l + 0.15);
  const hue = HUES.find((entry) => h < entry.until) ?? HUES[HUES.length - 1];
  if (hue.name === "Ochra" && l >= 0.8) return "Złoto";
  return withTone(hue.name, hue.gender, l);
}

export const HUE_FAMILIES = [
  { id: "neutral", name: "Neutralne" },
  { id: "red", name: "Czerwienie i róże" },
  { id: "orange", name: "Pomarańcze i brązy" },
  { id: "yellow", name: "Żółcie i ochry" },
  { id: "green", name: "Zielenie" },
  { id: "cyan", name: "Turkusy" },
  { id: "blue", name: "Niebieskie" },
  { id: "purple", name: "Fiolety" },
] as const;

export type HueFamilyId = (typeof HUE_FAMILIES)[number]["id"];

export function hueFamily(lab: Lab): HueFamilyId {
  const { c, h } = oklabToOklch(lab);
  if (c < 0.03) return "neutral";
  if (h < 42 || h >= 345) return "red";
  if (h < 75) return "orange";
  if (h < 125) return "yellow";
  if (h < 170) return "green";
  if (h < 220) return "cyan";
  if (h < 290) return "blue";
  return "purple";
}
