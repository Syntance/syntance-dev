"use client";

import { useEffect } from "react";

export interface HubHotkeyHandlers {
  onPalette?: () => void;
  onSidekick?: () => void;
  onReview?: () => void;
  onCompare?: () => void;
}

/** Globalne skróty Strategy Hub (⌘K, ⌘J, ⌘⇧R, ⌘⇧C). */
export function useHubHotkeys(handlers: HubHotkeyHandlers) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      const key = e.key.toLowerCase();
      const shift = e.shiftKey;

      if (!shift && key === "k") {
        e.preventDefault();
        handlers.onPalette?.();
      } else if (!shift && key === "j") {
        e.preventDefault();
        handlers.onSidekick?.();
      } else if (shift && key === "r") {
        e.preventDefault();
        handlers.onReview?.();
      } else if (shift && key === "c") {
        e.preventDefault();
        handlers.onCompare?.();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handlers]);
}
