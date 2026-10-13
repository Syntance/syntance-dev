/**
 * Cienka warstwa nad silnikiem VTracer (WebAssembly). Inicjalizacja jest synchroniczna — wołana
 * w Web Workerze (bez limitu rozmiaru kompilacji) albo w testach w Node.
 */
import { initSync, isInitialized, vectorize_rgba } from "../vendor/vtracer/vtracer-wasm";
import { VTRACER_VERSION } from "../vendor/vtracer/version";
import type { VtracerOptions } from "./settings";

export interface Tracer {
  readonly version: string;
  trace(rgba: Uint8Array, width: number, height: number, options: VtracerOptions): string;
}

export function createTracer(wasm: BufferSource | WebAssembly.Module): Tracer {
  if (!isInitialized()) initSync(wasm);
  return {
    version: VTRACER_VERSION,
    trace(rgba, width, height, options) {
      if (rgba.length !== width * height * 4) {
        throw new Error(`Bufor RGBA ma ${rgba.length} B, oczekiwano ${width * height * 4} B`);
      }
      return vectorize_rgba(rgba, width, height, options);
    },
  };
}
