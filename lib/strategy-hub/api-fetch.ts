"use client";

import { emitToast } from "@/lib/strategy-hub/toast";

/**
 * Jeden klient fetch dla komponentów Strategy Hub zamiast kopiowanego
 * boilerplate'u (timeout + JSON + obsługa błędów). Kontrakt:
 * - non-2xx i błąd sieci RZUCAJĄ `ApiError` — nigdy cicho nie przechodzą,
 * - błąd domyślnie ląduje jako toast (wyłączalne `silent` dla odświeżeń w tle),
 * - wołający łapie wyjątek tylko po to, żeby zdecydować o rollbacku UI.
 */

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = "ApiError";
  }
}

const DEFAULT_TIMEOUT_MS = 8000;
const NETWORK_ERROR_MESSAGE =
  "Brak połączenia z serwerem. Spróbuj ponownie.";

export interface ApiFetchOptions extends Omit<RequestInit, "body"> {
  /** Body JSON — serializacja + nagłówek Content-Type automatycznie. */
  json?: unknown;
  timeoutMs?: number;
  /** Bez toasta błędu — dla cichych odświeżeń w tle. */
  silent?: boolean;
}

export async function apiFetch<T = unknown>(
  url: string,
  options: ApiFetchOptions = {}
): Promise<T> {
  const {
    json,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    silent = false,
    headers,
    signal,
    ...init
  } = options;

  const timeout = AbortSignal.timeout(timeoutMs);
  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      headers:
        json !== undefined
          ? { "Content-Type": "application/json", ...headers }
          : headers,
      body: json !== undefined ? JSON.stringify(json) : undefined,
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    });
  } catch (err) {
    // Abort wołającego (np. odmontowanie) to nie błąd — bez toasta.
    const aborted = err instanceof DOMException && err.name === "AbortError";
    const timedOut = err instanceof DOMException && err.name === "TimeoutError";
    const message = timedOut
      ? "Przekroczono czas oczekiwania na serwer. Spróbuj ponownie."
      : NETWORK_ERROR_MESSAGE;
    if (!silent && !aborted) emitToast(message);
    throw new ApiError(message, 0, { cause: err });
  }

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as {
      error?: string;
    } | null;
    const message = body?.error ?? `Błąd serwera (${res.status})`;
    if (!silent) emitToast(message);
    throw new ApiError(message, res.status);
  }

  // Toleruje puste body (204, DELETE bez treści) — nie każdy handler zwraca JSON.
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}
