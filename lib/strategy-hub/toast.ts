"use client";

/**
 * Lekki bus toastów aplikacyjnych (błędy zapisu/ładowania z `apiFetch`).
 * Osobny kanał od alertów strategii (SSE, `use-project-alerts`) — te są
 * domenowe, ten jest techniczny. Renderuje `AppToaster`.
 */

export interface AppToast {
  id: string;
  message: string;
  severity: "error" | "info";
}

const EVENT_NAME = "strategy-hub:toast";

export function emitToast(message: string, severity: AppToast["severity"] = "error"): void {
  if (typeof window === "undefined") return;
  const detail: AppToast = { id: crypto.randomUUID(), message, severity };
  window.dispatchEvent(new CustomEvent<AppToast>(EVENT_NAME, { detail }));
}

export function subscribeToasts(onToast: (toast: AppToast) => void): () => void {
  const handler = (e: Event) => onToast((e as CustomEvent<AppToast>).detail);
  window.addEventListener(EVENT_NAME, handler);
  return () => window.removeEventListener(EVENT_NAME, handler);
}
