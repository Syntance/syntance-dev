/**
 * Kontrakt wiadomości UI ↔ Web Worker. Żądania są walidowane Zodem po stronie workera
 * (granica wątków); odpowiedzi pochodzą wyłącznie z naszego workera.
 */
import { z } from "zod";
import type { TraceStats, VectorDocument } from "../engine/document";
import type { OutlineShape } from "../engine/outline";
import type { PipelineStage } from "../engine/pipeline";
import type { TraceSettings } from "../engine/settings";

export const workerRequestSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("init"),
    wasmUrl: z.string().regex(/^\/wasm\/[a-z0-9.-]+\.wasm$/),
    sha256: z.string().regex(/^[0-9a-f]{64}$/),
  }),
  z.object({ type: z.literal("load"), jobId: z.number().int().nonnegative(), bytes: z.instanceof(ArrayBuffer) }),
  z.object({ type: z.literal("trace"), jobId: z.number().int().nonnegative(), settings: z.unknown() }),
  z.object({ type: z.literal("outline"), jobId: z.number().int().nonnegative(), settings: z.unknown() }),
]);

export type WorkerRequest =
  | { type: "init"; wasmUrl: string; sha256: string }
  | { type: "load"; jobId: number; bytes: ArrayBuffer }
  | { type: "trace"; jobId: number; settings: TraceSettings }
  | { type: "outline"; jobId: number; settings: TraceSettings };

export interface SourceInfo {
  width: number;
  height: number;
  hasAlpha: boolean;
}

export type WorkerResponse =
  | { type: "ready"; version: string }
  | ({ type: "loaded"; jobId: number } & SourceInfo)
  | { type: "progress"; jobId: number; stage: PipelineStage }
  | { type: "result"; jobId: number; doc: VectorDocument; stats: TraceStats }
  | { type: "outline"; jobId: number; outline: OutlineShape | null }
  | { type: "error"; jobId: number | null; message: string };

const RESPONSE_TYPES = new Set(["ready", "loaded", "progress", "result", "outline", "error"]);

export function isWorkerResponse(value: unknown): value is WorkerResponse {
  if (typeof value !== "object" || value === null) return false;
  const type: unknown = Reflect.get(value, "type");
  return typeof type === "string" && RESPONSE_TYPES.has(type);
}
