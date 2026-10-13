// PLIK GENEROWANY przez scripts/sync-vtracer.mjs — nie edytuj ręcznie.
/** Synchroniczna inicjalizacja modułu WebAssembly (bajty lub skompilowany moduł). */
export function initSync(source: BufferSource | WebAssembly.Module): void
export function isInitialized(): boolean
/** Zakodowany obraz (PNG/JPEG/GIF/BMP) → SVG. */
export function vectorize_bytes(data: Uint8Array, options: object): string
/** Surowe piksele RGBA8 (width * height * 4 bajtów) → SVG. */
export function vectorize_rgba(data: Uint8Array, width: number, height: number, options: object): string
