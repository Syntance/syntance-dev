"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * String w localStorage jako zewnętrzne źródło czytane przez `useSyncExternalStore` —
 * bez ustawiania stanu w efekcie (React 19: `set-state-in-effect`) i bez rozjazdu
 * hydratacji (serwerowy snapshot = ""). `storage` łapie zmiany między kartami,
 * `emit` — zapisy w tej samej karcie.
 */
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function subscribe(callback: () => void) {
  listeners.add(callback);
  window.addEventListener("storage", callback);
  return () => {
    listeners.delete(callback);
    window.removeEventListener("storage", callback);
  };
}

export function useLocalStorageString(
  key: string
): [string, (value: string) => void] {
  const value = useSyncExternalStore(
    subscribe,
    () => localStorage.getItem(key) ?? "",
    () => ""
  );
  const setValue = useCallback(
    (next: string) => {
      localStorage.setItem(key, next);
      emit();
    },
    [key]
  );
  return [value, setValue];
}
