/**
 * Odczyt wyjścia VTracer. Silnik emituje płaski SVG: `<path d fill/>` oraz (przy optimize=2)
 * grupy `<g fill>` z kolejnymi ścieżkami w tym samym kolorze. Parser nie używa DOM (działa w workerze)
 * i przyjmuje wyłącznie poprawne kolory hex — reszta jest odrzucana.
 */
import { normalizeHex } from "./color";

export interface RawTracedPath {
  d: string;
  fill: string;
}

export interface RawTrace {
  width: number;
  height: number;
  paths: RawTracedPath[];
}

const TAG_RE = /<(\/?)(svg|g|path)\b([^>]*?)(\/?)>/g;
const ATTR_RE = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*"([^"]*)"/g;

function attributes(source: string): Map<string, string> {
  const attrs = new Map<string, string>();
  for (const match of source.matchAll(ATTR_RE)) attrs.set(match[1], match[2]);
  return attrs;
}

export function parseTracedSvg(svg: string): RawTrace {
  let width = 0;
  let height = 0;
  const paths: RawTracedPath[] = [];
  const fillStack: Array<string | null> = [];

  for (const match of svg.matchAll(TAG_RE)) {
    const closing = match[1] === "/";
    const tag = match[2];
    const attrs = attributes(match[3]);
    const selfClosing = match[4] === "/";

    if (tag === "svg") {
      if (!closing) {
        width = Number(attrs.get("width") ?? 0);
        height = Number(attrs.get("height") ?? 0);
      }
      continue;
    }
    if (tag === "g") {
      if (closing) fillStack.pop();
      else if (!selfClosing) fillStack.push(normalizeHex(attrs.get("fill") ?? "") ?? null);
      continue;
    }
    // <path>
    if (closing) continue;
    const d = attrs.get("d");
    if (!d) continue;
    const inherited = [...fillStack].reverse().find((f) => f !== null) ?? null;
    const fill = normalizeHex(attrs.get("fill") ?? "") ?? inherited;
    if (!fill) continue;
    paths.push({ d, fill });
  }

  if (!(width > 0 && height > 0)) throw new Error("Silnik zwrócił SVG bez wymiarów");
  return { width, height, paths };
}
