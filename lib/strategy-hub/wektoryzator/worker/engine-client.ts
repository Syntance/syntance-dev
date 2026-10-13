"use client";

/**
 * Klient Web Workera: kolejkuje zadania, przekazuje postęp i pozwala anulować długie śledzenie
 * (VTracer jest synchroniczny, więc anulowanie = zakończenie workera i start nowego).
 */
import type { TraceStats, VectorDocument } from "../engine/document";
import type { OutlineShape } from "../engine/outline";
import type { PipelineStage } from "../engine/pipeline";
import type { TraceSettings } from "../engine/settings";
import { VTRACER_WASM_SHA256, VTRACER_WASM_URL } from "../vendor/vtracer/version";
import { isWorkerResponse, type SourceInfo, type WorkerRequest, type WorkerResponse } from "./protocol";

export class CancelledError extends Error {
  constructor() {
    super("Anulowano");
    this.name = "CancelledError";
  }
}

interface Job {
  resolve: (response: WorkerResponse) => void;
  reject: (error: Error) => void;
  onProgress?: (stage: PipelineStage) => void;
}

interface Readiness {
  promise: Promise<string>;
  resolve: (version: string) => void;
  reject: (error: Error) => void;
}

function createReadiness(): Readiness {
  let resolve: (version: string) => void = () => {};
  let reject: (error: Error) => void = () => {};
  const promise = new Promise<string>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  // Odrzucenie obsłużone przez czekających; bez tego nieużyty silnik generowałby unhandled rejection.
  promise.catch(() => {});
  return { promise, resolve, reject };
}

export interface TraceOutput {
  doc: VectorDocument;
  stats: TraceStats;
}

export class VectorizerEngine {
  private worker: Worker | null = null;
  private readiness: Readiness | null = null;
  private readonly jobs = new Map<number, Job>();
  private nextJobId = 1;
  private sourceBytes: ArrayBuffer | null = null;
  private sourceLoaded = false;

  private spawn(): Readiness {
    if (this.worker && this.readiness) return this.readiness;
    const worker = new Worker(new URL("./trace.worker.ts", import.meta.url), { type: "module", name: "wektoryzator" });
    const readiness = createReadiness();
    worker.addEventListener("message", (event: MessageEvent<unknown>) => this.handle(event.data));
    worker.addEventListener("error", (event) => {
      this.crash(new Error(event.message || "Silnik wektoryzacji przestał odpowiadać."));
    });
    this.worker = worker;
    this.readiness = readiness;
    this.send({ type: "init", wasmUrl: VTRACER_WASM_URL, sha256: VTRACER_WASM_SHA256 });
    return readiness;
  }

  private send(request: WorkerRequest, transfer: Transferable[] = []): void {
    this.worker?.postMessage(request, transfer);
  }

  private handle(data: unknown): void {
    if (!isWorkerResponse(data)) return;
    if (data.type === "ready") {
      this.readiness?.resolve(data.version);
      return;
    }
    if (data.type === "error" && data.jobId === null) {
      this.readiness?.reject(new Error(data.message));
      return;
    }
    const job = data.jobId === null ? undefined : this.jobs.get(data.jobId);
    if (!job) return;
    if (data.type === "progress") {
      job.onProgress?.(data.stage);
      return;
    }
    this.jobs.delete(data.jobId ?? -1);
    if (data.type === "error") job.reject(new Error(data.message));
    else job.resolve(data);
  }

  private crash(error: Error): void {
    this.readiness?.reject(error);
    for (const job of this.jobs.values()) job.reject(error);
    this.jobs.clear();
    this.worker?.terminate();
    this.worker = null;
    this.readiness = null;
    this.sourceLoaded = false;
  }

  private request(
    build: (jobId: number) => WorkerRequest,
    transfer: Transferable[] = [],
    onProgress?: (stage: PipelineStage) => void,
  ): Promise<WorkerResponse> {
    const jobId = this.nextJobId++;
    return new Promise<WorkerResponse>((resolve, reject) => {
      this.jobs.set(jobId, { resolve, reject, onProgress });
      this.send(build(jobId), transfer);
    });
  }

  /** Uruchamia worker i silnik (pobranie + weryfikacja + kompilacja WASM). */
  ready(): Promise<string> {
    return this.spawn().promise;
  }

  private async pushSource(): Promise<SourceInfo> {
    if (!this.sourceBytes) throw new Error("Brak obrazu.");
    await this.ready();
    const copy = this.sourceBytes.slice(0);
    const response = await this.request((jobId) => ({ type: "load", jobId, bytes: copy }), [copy]);
    if (response.type !== "loaded") throw new Error("Nieoczekiwana odpowiedź silnika.");
    this.sourceLoaded = true;
    return { width: response.width, height: response.height, hasAlpha: response.hasAlpha };
  }

  async load(bytes: ArrayBuffer): Promise<SourceInfo> {
    this.sourceBytes = bytes.slice(0);
    this.sourceLoaded = false;
    return this.pushSource();
  }

  async trace(settings: TraceSettings, onProgress?: (stage: PipelineStage) => void): Promise<TraceOutput> {
    await this.ready();
    if (!this.sourceLoaded) await this.pushSource();
    const response = await this.request((jobId) => ({ type: "trace", jobId, settings }), [], onProgress);
    if (response.type !== "result") throw new Error("Nieoczekiwana odpowiedź silnika.");
    return { doc: response.doc, stats: response.stats };
  }

  /** Sam obrys całości z ostatniej wektoryzacji (szybkie — bez ponownego śledzenia). */
  async outline(settings: TraceSettings): Promise<OutlineShape | null> {
    await this.ready();
    const response = await this.request((jobId) => ({ type: "outline", jobId, settings }));
    if (response.type !== "outline") throw new Error("Nieoczekiwana odpowiedź silnika.");
    return response.outline;
  }

  /** Przerywa bieżące zadanie (zabija worker). Obraz zostaje — kolejne śledzenie wczyta go ponownie. */
  cancel(): void {
    const error = new CancelledError();
    this.readiness?.reject(error);
    for (const job of this.jobs.values()) job.reject(error);
    this.jobs.clear();
    this.worker?.terminate();
    this.worker = null;
    this.readiness = null;
    this.sourceLoaded = false;
  }

  dispose(): void {
    this.cancel();
    this.sourceBytes = null;
  }
}
