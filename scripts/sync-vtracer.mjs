/**
 * Synchronizuje silnik VTracer (WebAssembly) z paczki @visioncortex/vtracer do modułu Wektoryzator.
 *
 * Paczka npm jest zbudowana pod Node (`wasm-pack --target nodejs`: glue czyta .wasm przez `fs`).
 * Ten skrypt:
 *  1. kopiuje binarkę do public/wasm/vtracer-<wersja>.wasm (serwowana statycznie, ładowana w Web Workerze),
 *  2. przepisuje glue wasm-bindgen na moduł ESM z jawnym `initSync(bytes)` zamiast odczytu z dysku,
 *  3. zapisuje wersję + SHA-256 binarki, żeby glue i .wasm zawsze pochodziły z tego samego builda.
 *
 * Glue jest generowany per build wasm — po aktualizacji paczki ZAWSZE uruchom `pnpm sync:vtracer`.
 */
import { createHash } from "node:crypto";
import { copyFileSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const pkgJsonPath = require.resolve("@visioncortex/vtracer/package.json");
const pkgDir = dirname(pkgJsonPath);
const { version, license } = JSON.parse(readFileSync(pkgJsonPath, "utf-8"));

const VENDOR_DIR = "lib/strategy-hub/wektoryzator/vendor/vtracer";
const WASM_DIR = "public/wasm";
const wasmName = `vtracer-${version}.wasm`;

// 1. Binarka
mkdirSync(WASM_DIR, { recursive: true });
for (const file of readdirSync(WASM_DIR)) {
  if (/^vtracer-.*\.wasm$/.test(file) && file !== wasmName) rmSync(join(WASM_DIR, file));
}
const wasmSrc = join(pkgDir, "pkg", "vtracer_wasm_bg.wasm");
copyFileSync(wasmSrc, join(WASM_DIR, wasmName));
const sha256 = createHash("sha256").update(readFileSync(wasmSrc)).digest("hex");

// 2. Glue → ESM
let glue = readFileSync(join(pkgDir, "pkg", "vtracer_wasm.js"), "utf-8");

function replaceOnce(source, search, replacement, label) {
  const index = source.indexOf(search);
  if (index === -1) {
    throw new Error(`[vtracer] Nie znaleziono fragmentu "${label}" — format glue się zmienił, zaktualizuj skrypt.`);
  }
  return source.slice(0, index) + replacement + source.slice(index + search.length);
}

glue = glue.replace(/^\/\* @ts-self-types=.*\*\/\s*/m, "");
glue = replaceOnce(glue, "exports.vectorize_bytes = vectorize_bytes;\n", "", "exports.vectorize_bytes");
glue = replaceOnce(glue, "exports.vectorize_rgba = vectorize_rgba;\n", "", "exports.vectorize_rgba");

const loaderStart = glue.indexOf("const wasmPath = `${__dirname}/vtracer_wasm_bg.wasm`;");
if (loaderStart === -1) {
  throw new Error("[vtracer] Nie znaleziono loadera Node — format glue się zmienił, zaktualizuj skrypt.");
}
glue = `${glue.slice(0, loaderStart)}let wasm;

/** Inicjalizacja synchroniczna (Web Worker / Node). Wielokrotne wywołanie jest no-opem. */
export function initSync(source) {
    if (wasm) return;
    const module = source instanceof WebAssembly.Module ? source : new WebAssembly.Module(source);
    const instance = new WebAssembly.Instance(module, __wbg_get_imports());
    wasm = instance.exports;
    cachedDataViewMemory0 = null;
    cachedUint8ArrayMemory0 = null;
    wasm.__wbindgen_start();
}

export function isInitialized() {
    return wasm !== undefined;
}

export { vectorize_bytes, vectorize_rgba };
`;

const header = `/* eslint-disable */
// PLIK GENEROWANY przez scripts/sync-vtracer.mjs — nie edytuj ręcznie.
// Źródło: @visioncortex/vtracer@${version} (pkg/vtracer_wasm.js), licencja ${license}.
// Binarka: public/wasm/${wasmName} (sha256 ${sha256}).
`;
mkdirSync(VENDOR_DIR, { recursive: true });
writeFileSync(join(VENDOR_DIR, "vtracer-wasm.js"), header + glue, "utf-8");

writeFileSync(
  join(VENDOR_DIR, "vtracer-wasm.d.ts"),
  `// PLIK GENEROWANY przez scripts/sync-vtracer.mjs — nie edytuj ręcznie.
/** Synchroniczna inicjalizacja modułu WebAssembly (bajty lub skompilowany moduł). */
export function initSync(source: BufferSource | WebAssembly.Module): void
export function isInitialized(): boolean
/** Zakodowany obraz (PNG/JPEG/GIF/BMP) → SVG. */
export function vectorize_bytes(data: Uint8Array, options: object): string
/** Surowe piksele RGBA8 (width * height * 4 bajtów) → SVG. */
export function vectorize_rgba(data: Uint8Array, width: number, height: number, options: object): string
`,
  "utf-8",
);

writeFileSync(
  join(VENDOR_DIR, "version.ts"),
  `// PLIK GENEROWANY przez scripts/sync-vtracer.mjs — nie edytuj ręcznie.
export const VTRACER_VERSION = '${version}'
export const VTRACER_WASM_URL = '/wasm/${wasmName}'
export const VTRACER_WASM_SHA256 = '${sha256}'
`,
  "utf-8",
);

writeFileSync(
  join(VENDOR_DIR, "README.md"),
  `# VTracer (vendor)

Silnik wektoryzacji modułu Wektoryzator: [VTracer](https://github.com/visioncortex/vtracer) © visioncortex,
licencja ${license}. Pliki w tym katalogu są generowane przez \`pnpm sync:vtracer\` z paczki
\`@visioncortex/vtracer@${version}\` — nie edytuj ich ręcznie.

- \`vtracer-wasm.js\` — glue wasm-bindgen przepisany na ESM z \`initSync(bytes)\` (oryginał czyta .wasm przez \`fs\`).
- \`public/wasm/${wasmName}\` — binarka WebAssembly (sha256 \`${sha256}\`).

Glue i binarka muszą pochodzić z tego samego builda: po podbiciu wersji paczki uruchom skrypt ponownie.
`,
  "utf-8",
);

console.log(`[vtracer] ${version} → ${WASM_DIR}/${wasmName} (sha256 ${sha256.slice(0, 16)}…)`);
console.log(`[vtracer] glue → ${VENDOR_DIR}/vtracer-wasm.js`);
