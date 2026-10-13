/**
 * Geometria ścieżek SVG: parser `d` (pełna składnia: M L H V C S Q T A Z, względne i bezwzględne)
 * do postaci kanonicznej — tylko M/L/C/Z we współrzędnych bezwzględnych.
 *
 * Postać kanoniczna zasila eksport PDF/EPS/DXF, pola powierzchni (grupowanie, statystyki)
 * i obwiednie (zaznaczanie, obiekty).
 */

export const CMD_MOVE = 0;
export const CMD_LINE = 1;
export const CMD_CUBIC = 2;
export const CMD_CLOSE = 3;

export interface PathGeometry {
  /** Komendy: 0 = M, 1 = L, 2 = C, 3 = Z. */
  cmds: Uint8Array;
  /** Współrzędne: M/L → 2 liczby, C → 6, Z → 0. */
  coords: Float64Array;
}

export type Bounds = [x0: number, y0: number, x1: number, y1: number];

export class PathParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PathParseError";
  }
}

function isCommand(code: number): boolean {
  switch (code) {
    case 77:
    case 109: // M m
    case 76:
    case 108: // L l
    case 72:
    case 104: // H h
    case 86:
    case 118: // V v
    case 67:
    case 99: // C c
    case 83:
    case 115: // S s
    case 81:
    case 113: // Q q
    case 84:
    case 116: // T t
    case 65:
    case 97: // A a
    case 90:
    case 122: // Z z
      return true;
    default:
      return false;
  }
}

class Scanner {
  i = 0;
  constructor(private readonly d: string) {}

  get done(): boolean {
    this.skip();
    return this.i >= this.d.length;
  }

  skip(): void {
    const d = this.d;
    while (this.i < d.length) {
      const c = d.charCodeAt(this.i);
      // spacja, przecinek, \t \n \r \f
      if (c === 32 || c === 44 || c === 9 || c === 10 || c === 13 || c === 12) this.i++;
      else break;
    }
  }

  peekCommand(): string | null {
    this.skip();
    if (this.i >= this.d.length) return null;
    const code = this.d.charCodeAt(this.i);
    return isCommand(code) ? this.d[this.i] : null;
  }

  hasNumber(): boolean {
    this.skip();
    if (this.i >= this.d.length) return false;
    const c = this.d.charCodeAt(this.i);
    return (c >= 48 && c <= 57) || c === 45 || c === 43 || c === 46;
  }

  number(): number {
    this.skip();
    const d = this.d;
    const start = this.i;
    let i = this.i;
    if (d[i] === "+" || d[i] === "-") i++;
    let digits = 0;
    while (i < d.length && d.charCodeAt(i) >= 48 && d.charCodeAt(i) <= 57) {
      i++;
      digits++;
    }
    if (d[i] === ".") {
      i++;
      while (i < d.length && d.charCodeAt(i) >= 48 && d.charCodeAt(i) <= 57) {
        i++;
        digits++;
      }
    }
    if (digits === 0) throw new PathParseError(`Oczekiwano liczby na pozycji ${start}`);
    if (d[i] === "e" || d[i] === "E") {
      let j = i + 1;
      if (d[j] === "+" || d[j] === "-") j++;
      if (j < d.length && d.charCodeAt(j) >= 48 && d.charCodeAt(j) <= 57) {
        while (j < d.length && d.charCodeAt(j) >= 48 && d.charCodeAt(j) <= 57) j++;
        i = j;
      }
    }
    this.i = i;
    const value = Number(d.slice(start, i));
    if (!Number.isFinite(value)) throw new PathParseError(`Niepoprawna liczba na pozycji ${start}`);
    return value;
  }

  flag(): boolean {
    this.skip();
    const c = this.d[this.i];
    if (c === "0" || c === "1") {
      this.i++;
      return c === "1";
    }
    throw new PathParseError(`Oczekiwano flagi łuku na pozycji ${this.i}`);
  }
}

class Builder {
  readonly cmds: number[] = [];
  readonly coords: number[] = [];
  x = 0;
  y = 0;
  startX = 0;
  startY = 0;
  open = false;

  move(x: number, y: number): void {
    this.cmds.push(CMD_MOVE);
    this.coords.push(x, y);
    this.x = this.startX = x;
    this.y = this.startY = y;
    this.open = true;
  }

  ensureOpen(): void {
    if (!this.open) this.move(this.x, this.y);
  }

  line(x: number, y: number): void {
    this.ensureOpen();
    this.cmds.push(CMD_LINE);
    this.coords.push(x, y);
    this.x = x;
    this.y = y;
  }

  cubic(x1: number, y1: number, x2: number, y2: number, x: number, y: number): void {
    this.ensureOpen();
    this.cmds.push(CMD_CUBIC);
    this.coords.push(x1, y1, x2, y2, x, y);
    this.x = x;
    this.y = y;
  }

  close(): void {
    if (!this.open) return;
    this.cmds.push(CMD_CLOSE);
    this.x = this.startX;
    this.y = this.startY;
    this.open = false;
  }
}

/** Łuk eliptyczny → krzywe Béziera (SVG 1.1, dodatek F.6). */
function arcToCubics(
  b: Builder,
  rxIn: number,
  ryIn: number,
  rotationDeg: number,
  largeArc: boolean,
  sweep: boolean,
  x: number,
  y: number,
): void {
  const x0 = b.x;
  const y0 = b.y;
  if (x0 === x && y0 === y) return;
  let rx = Math.abs(rxIn);
  let ry = Math.abs(ryIn);
  if (rx === 0 || ry === 0) {
    b.line(x, y);
    return;
  }
  const phi = (rotationDeg * Math.PI) / 180;
  const cos = Math.cos(phi);
  const sin = Math.sin(phi);
  const dx = (x0 - x) / 2;
  const dy = (y0 - y) / 2;
  const x1p = cos * dx + sin * dy;
  const y1p = -sin * dx + cos * dy;
  const lambda = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry);
  if (lambda > 1) {
    const s = Math.sqrt(lambda);
    rx *= s;
    ry *= s;
  }
  const sign = largeArc === sweep ? -1 : 1;
  const num = rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p;
  const den = rx * rx * y1p * y1p + ry * ry * x1p * x1p;
  const coef = sign * Math.sqrt(Math.max(0, num / den));
  const cxp = (coef * (rx * y1p)) / ry;
  const cyp = (coef * -(ry * x1p)) / rx;
  const cx = cos * cxp - sin * cyp + (x0 + x) / 2;
  const cy = sin * cxp + cos * cyp + (y0 + y) / 2;

  const angle = (ux: number, uy: number, vx: number, vy: number) => {
    const a = Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
    return a;
  };
  const theta1 = angle(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry);
  let delta = angle((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry);
  if (!sweep && delta > 0) delta -= 2 * Math.PI;
  if (sweep && delta < 0) delta += 2 * Math.PI;

  const segments = Math.max(1, Math.ceil(Math.abs(delta) / (Math.PI / 2) - 1e-9));
  const step = delta / segments;
  const k = (4 / 3) * Math.tan(step / 4);
  let t = theta1;
  for (let s = 0; s < segments; s++) {
    const t2 = t + step;
    const c1 = Math.cos(t);
    const s1 = Math.sin(t);
    const c2 = Math.cos(t2);
    const s2 = Math.sin(t2);
    const p1x = c1 - k * s1;
    const p1y = s1 + k * c1;
    const p2x = c2 + k * s2;
    const p2y = s2 - k * c2;
    const map = (px: number, py: number): [number, number] => [
      cx + rx * px * cos - ry * py * sin,
      cy + rx * px * sin + ry * py * cos,
    ];
    const [ax, ay] = map(p1x, p1y);
    const [bx, by] = map(p2x, p2y);
    const [ex, ey] = s === segments - 1 ? [x, y] : map(c2, s2);
    b.cubic(ax, ay, bx, by, ex, ey);
    t = t2;
  }
}

export function parsePathData(d: string): PathGeometry {
  const sc = new Scanner(d);
  const b = new Builder();
  let command = "";
  // Odbicia punktów kontrolnych dla S/T.
  let lastCubicX = 0;
  let lastCubicY = 0;
  let lastQuadX = 0;
  let lastQuadY = 0;
  let previous = "";

  while (!sc.done) {
    const next = sc.peekCommand();
    if (next) {
      command = next;
      sc.i++;
    } else if (!command) {
      throw new PathParseError("Ścieżka musi zaczynać się od komendy");
    } else if (command === "Z" || command === "z") {
      throw new PathParseError(`Nieoczekiwana liczba po Z na pozycji ${sc.i}`);
    }
    const rel = command === command.toLowerCase();
    const ox = rel ? b.x : 0;
    const oy = rel ? b.y : 0;

    switch (command) {
      case "M":
      case "m": {
        // Po Z (lub na starcie) względne „m” liczy się od punktu startowego podścieżki.
        const x = sc.number() + ox;
        const y = sc.number() + oy;
        b.move(x, y);
        // Kolejne pary po M to niejawne L.
        command = rel ? "l" : "L";
        break;
      }
      case "L":
      case "l":
        b.line(sc.number() + ox, sc.number() + oy);
        break;
      case "H":
      case "h":
        b.line(sc.number() + (rel ? b.x : 0), b.y);
        break;
      case "V":
      case "v":
        b.line(b.x, sc.number() + (rel ? b.y : 0));
        break;
      case "C":
      case "c": {
        const x1 = sc.number() + ox;
        const y1 = sc.number() + oy;
        const x2 = sc.number() + ox;
        const y2 = sc.number() + oy;
        const x = sc.number() + ox;
        const y = sc.number() + oy;
        b.cubic(x1, y1, x2, y2, x, y);
        lastCubicX = x2;
        lastCubicY = y2;
        break;
      }
      case "S":
      case "s": {
        const smooth = previous === "C" || previous === "S";
        const x1 = smooth ? 2 * b.x - lastCubicX : b.x;
        const y1 = smooth ? 2 * b.y - lastCubicY : b.y;
        const x2 = sc.number() + ox;
        const y2 = sc.number() + oy;
        const x = sc.number() + ox;
        const y = sc.number() + oy;
        b.cubic(x1, y1, x2, y2, x, y);
        lastCubicX = x2;
        lastCubicY = y2;
        break;
      }
      case "Q":
      case "q": {
        const qx = sc.number() + ox;
        const qy = sc.number() + oy;
        const x = sc.number() + ox;
        const y = sc.number() + oy;
        b.cubic(
          b.x + (2 / 3) * (qx - b.x),
          b.y + (2 / 3) * (qy - b.y),
          x + (2 / 3) * (qx - x),
          y + (2 / 3) * (qy - y),
          x,
          y,
        );
        lastQuadX = qx;
        lastQuadY = qy;
        break;
      }
      case "T":
      case "t": {
        const smooth = previous === "Q" || previous === "T";
        const qx = smooth ? 2 * b.x - lastQuadX : b.x;
        const qy = smooth ? 2 * b.y - lastQuadY : b.y;
        const x = sc.number() + ox;
        const y = sc.number() + oy;
        b.cubic(
          b.x + (2 / 3) * (qx - b.x),
          b.y + (2 / 3) * (qy - b.y),
          x + (2 / 3) * (qx - x),
          y + (2 / 3) * (qy - y),
          x,
          y,
        );
        lastQuadX = qx;
        lastQuadY = qy;
        break;
      }
      case "A":
      case "a": {
        const rx = sc.number();
        const ry = sc.number();
        const rotation = sc.number();
        const large = sc.flag();
        const sweep = sc.flag();
        const x = sc.number() + ox;
        const y = sc.number() + oy;
        arcToCubics(b, rx, ry, rotation, large, sweep, x, y);
        break;
      }
      case "Z":
      case "z":
        b.close();
        break;
      default:
        throw new PathParseError(`Nieobsługiwana komenda „${command}”`);
    }
    previous = command.toUpperCase();
  }
  return { cmds: Uint8Array.from(b.cmds), coords: Float64Array.from(b.coords) };
}

/** Obwiednia z punktami kontrolnymi (zawiera całą krzywą; nieco zawyżona na łukach). */
export function geometryBounds(g: PathGeometry): Bounds {
  const c = g.coords;
  if (c.length === 0) return [0, 0, 0, 0];
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (let i = 0; i < c.length; i += 2) {
    const x = c[i];
    const y = c[i + 1];
    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
    if (y < y0) y0 = y;
    if (y > y1) y1 = y;
  }
  return [x0, y0, x1, y1];
}

// Całki ∫ bᵢ(t)·bⱼ'(t) dt dla bazy Bernsteina 3. stopnia — dokładne (kwadratura Gaussa 3 pkt, wielomian 5. st.).
const CUBIC_AREA_K: number[][] = (() => {
  const nodes = [-Math.sqrt(3 / 5), 0, Math.sqrt(3 / 5)];
  const weights = [5 / 9, 8 / 9, 5 / 9];
  const basis = (t: number) => [(1 - t) ** 3, 3 * t * (1 - t) ** 2, 3 * t * t * (1 - t), t ** 3];
  const dbasis = (t: number) => [
    -3 * (1 - t) ** 2,
    3 * (1 - t) ** 2 - 6 * t * (1 - t),
    6 * t * (1 - t) - 3 * t * t,
    3 * t * t,
  ];
  const m = [0, 1, 2, 3].map(() => [0, 0, 0, 0]);
  for (let q = 0; q < 3; q++) {
    const t = (nodes[q] + 1) / 2;
    const w = weights[q] / 2;
    const bs = basis(t);
    const ds = dbasis(t);
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) m[i][j] += w * bs[i] * ds[j];
  }
  // ½ ∮ (x dy − y dx) = ½ Σᵢⱼ Mᵢⱼ (xᵢ yⱼ − yᵢ xⱼ) → współczynnik antysymetryczny dla i<j.
  return m.map((row, i) => row.map((_, j) => (i < j ? (m[i][j] - m[j][i]) / 2 : 0)));
})();

function cubicArea(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  x3: number,
  y3: number,
): number {
  const xs = [x0, x1, x2, x3];
  const ys = [y0, y1, y2, y3];
  let area = 0;
  for (let i = 0; i < 3; i++) {
    for (let j = i + 1; j < 4; j++) area += CUBIC_AREA_K[i][j] * (xs[i] * ys[j] - ys[i] * xs[j]);
  }
  return area;
}

/**
 * Pole ze znakiem (twierdzenie Greena; podścieżki domykane). Otwory o przeciwnej orientacji
 * odejmują się — wartość bezwzględna to pole netto kształtu przy regule nonzero.
 */
export function geometrySignedArea(g: PathGeometry): number {
  const { cmds, coords } = g;
  let area = 0;
  let ci = 0;
  let x = 0;
  let y = 0;
  let sx = 0;
  let sy = 0;
  const closeTo = () => {
    if (x !== sx || y !== sy) area += (x * sy - sx * y) / 2;
    x = sx;
    y = sy;
  };
  for (let k = 0; k < cmds.length; k++) {
    switch (cmds[k]) {
      case CMD_MOVE:
        closeTo();
        x = sx = coords[ci];
        y = sy = coords[ci + 1];
        ci += 2;
        break;
      case CMD_LINE: {
        const nx = coords[ci];
        const ny = coords[ci + 1];
        area += (x * ny - nx * y) / 2;
        x = nx;
        y = ny;
        ci += 2;
        break;
      }
      case CMD_CUBIC: {
        const nx = coords[ci + 4];
        const ny = coords[ci + 5];
        area += cubicArea(x, y, coords[ci], coords[ci + 1], coords[ci + 2], coords[ci + 3], nx, ny);
        x = nx;
        y = ny;
        ci += 6;
        break;
      }
      case CMD_CLOSE:
        closeTo();
        break;
    }
  }
  closeTo();
  return area;
}

export function segmentCount(g: PathGeometry): number {
  let count = 0;
  for (const c of g.cmds) if (c === CMD_LINE || c === CMD_CUBIC) count++;
  return count;
}

export interface Polyline {
  points: number[];
  closed: boolean;
}

function flattenCubic(
  out: number[],
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  x3: number,
  y3: number,
  tolerance2: number,
  depth: number,
): void {
  // Płaskość: odległość punktów kontrolnych od cięciwy.
  const dx = x3 - x0;
  const dy = y3 - y0;
  const len2 = dx * dx + dy * dy;
  let d1: number;
  let d2: number;
  if (len2 < 1e-12) {
    d1 = (x1 - x0) ** 2 + (y1 - y0) ** 2;
    d2 = (x2 - x0) ** 2 + (y2 - y0) ** 2;
  } else {
    const c1 = (x1 - x0) * dy - (y1 - y0) * dx;
    const c2 = (x2 - x0) * dy - (y2 - y0) * dx;
    d1 = (c1 * c1) / len2;
    d2 = (c2 * c2) / len2;
  }
  if (depth >= 16 || Math.max(d1, d2) <= tolerance2) {
    out.push(x3, y3);
    return;
  }
  // de Casteljau w t = 0,5.
  const x01 = (x0 + x1) / 2;
  const y01 = (y0 + y1) / 2;
  const x12 = (x1 + x2) / 2;
  const y12 = (y1 + y2) / 2;
  const x23 = (x2 + x3) / 2;
  const y23 = (y2 + y3) / 2;
  const xa = (x01 + x12) / 2;
  const ya = (y01 + y12) / 2;
  const xb = (x12 + x23) / 2;
  const yb = (y12 + y23) / 2;
  const xm = (xa + xb) / 2;
  const ym = (ya + yb) / 2;
  flattenCubic(out, x0, y0, x01, y01, xa, ya, xm, ym, tolerance2, depth + 1);
  flattenCubic(out, xm, ym, xb, yb, x23, y23, x3, y3, tolerance2, depth + 1);
}

/** Spłaszczenie do łamanych (DXF, plotery tnące). `tolerance` w jednostkach ścieżki. */
export function flattenGeometry(g: PathGeometry, tolerance: number): Polyline[] {
  const { cmds, coords } = g;
  const result: Polyline[] = [];
  const tol2 = Math.max(1e-6, tolerance * tolerance);
  let current: Polyline | null = null;
  let ci = 0;
  let x = 0;
  let y = 0;
  for (let k = 0; k < cmds.length; k++) {
    switch (cmds[k]) {
      case CMD_MOVE:
        if (current && current.points.length >= 4) result.push(current);
        x = coords[ci];
        y = coords[ci + 1];
        ci += 2;
        current = { points: [x, y], closed: false };
        break;
      case CMD_LINE:
        x = coords[ci];
        y = coords[ci + 1];
        ci += 2;
        current?.points.push(x, y);
        break;
      case CMD_CUBIC:
        if (current) {
          flattenCubic(
            current.points,
            x,
            y,
            coords[ci],
            coords[ci + 1],
            coords[ci + 2],
            coords[ci + 3],
            coords[ci + 4],
            coords[ci + 5],
            tol2,
            0,
          );
        }
        x = coords[ci + 4];
        y = coords[ci + 5];
        ci += 6;
        break;
      case CMD_CLOSE:
        if (current) {
          current.closed = true;
          // Usuń zdublowany punkt końcowy (= startowy).
          const p = current.points;
          if (p.length >= 4 && Math.abs(p[0] - p[p.length - 2]) < 1e-9 && Math.abs(p[1] - p[p.length - 1]) < 1e-9) {
            p.length -= 2;
          }
          if (p.length >= 4) result.push(current);
          x = p[0];
          y = p[1];
        }
        current = null;
        break;
    }
  }
  if (current && current.points.length >= 4) result.push(current);
  return result;
}

function formatNumber(value: number, precision: number): string {
  const fixed = value.toFixed(precision);
  if (precision === 0) return fixed === "-0" ? "0" : fixed;
  const trimmed = fixed.replace(/\.?0+$/, "");
  return trimmed === "-0" ? "0" : trimmed;
}

/** Serializacja do `d` (bezwzględne M/L/C/Z) z opcjonalną transformacją skali/przesunięcia. */
export function serializeGeometry(
  g: PathGeometry,
  precision = 2,
  transform: { scale: number; dx: number; dy: number } = { scale: 1, dx: 0, dy: 0 },
): string {
  const { cmds, coords } = g;
  const { scale, dx, dy } = transform;
  const parts: string[] = [];
  const fx = (v: number) => formatNumber(v * scale + dx, precision);
  const fy = (v: number) => formatNumber(v * scale + dy, precision);
  let ci = 0;
  for (let k = 0; k < cmds.length; k++) {
    switch (cmds[k]) {
      case CMD_MOVE:
        parts.push(`M${fx(coords[ci])} ${fy(coords[ci + 1])}`);
        ci += 2;
        break;
      case CMD_LINE:
        parts.push(`L${fx(coords[ci])} ${fy(coords[ci + 1])}`);
        ci += 2;
        break;
      case CMD_CUBIC:
        parts.push(
          `C${fx(coords[ci])} ${fy(coords[ci + 1])} ${fx(coords[ci + 2])} ${fy(coords[ci + 3])} ${fx(coords[ci + 4])} ${fy(coords[ci + 5])}`,
        );
        ci += 6;
        break;
      case CMD_CLOSE:
        parts.push("Z");
        break;
    }
  }
  return parts.join("");
}
