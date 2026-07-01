"use client";

import { useEffect, useRef } from "react";

export interface HubHotkeyHandlers {
  onPalette?: () => void;
  onSidekick?: () => void;
  onReview?: () => void;
  onCompare?: () => void;
  /** Cmd+, — ustawienia projektu. */
  onSettings?: () => void;
  /** Cmd+/ — szybkie akcje AI (Sidekick, zakładka Sugestie). */
  onQuickAi?: () => void;
  /** Cmd+Z — cofnij ostatnią akcję sesji (inline edit). */
  onUndo?: () => void;
  /** Cmd+Shift+Z — ponów cofniętą akcję. */
  onRedo?: () => void;
  /** G S — przejdź do Segmentów. */
  onGoSegments?: () => void;
  /** G L — przejdź do Lejka. */
  onGoLejek?: () => void;
  /** G W — przejdź do Strony (website). */
  onGoWebsite?: () => void;
  /** G C — przejdź do Kanałów. */
  onGoChannels?: () => void;
}

function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    el.isContentEditable
  );
}

const VIM_TIMEOUT_MS = 800;

/**
 * Globalne skróty Strategy Hub (Faza 7+9, M3): ⌘K/⌘J/⌘⇧R/⌘⇧C/⌘,/⌘//⌘Z/⌘⇧Z
 * + sekwencje vim-style „G + litera" (G S / G L / G W / G C) do szybkiej nawigacji.
 */
export function useHubHotkeys(handlers: HubHotkeyHandlers) {
  const pendingG = useRef(false);
  const gTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const clearPendingG = () => {
      pendingG.current = false;
      if (gTimeout.current) clearTimeout(gTimeout.current);
      gTimeout.current = null;
    };

    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      const key = e.key.toLowerCase();
      const shift = e.shiftKey;

      if (mod) {
        clearPendingG();
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
        } else if (!shift && key === ",") {
          e.preventDefault();
          handlers.onSettings?.();
        } else if (!shift && key === "/") {
          e.preventDefault();
          handlers.onQuickAi?.();
        } else if (!shift && key === "z") {
          e.preventDefault();
          handlers.onUndo?.();
        } else if (shift && key === "z") {
          e.preventDefault();
          handlers.onRedo?.();
        }
        return;
      }

      // Sekwencje vim-style — ignorowane gdy user pisze w polu tekstowym.
      if (isTypingTarget(e.target)) return;

      if (pendingG.current) {
        clearPendingG();
        if (key === "s") {
          e.preventDefault();
          handlers.onGoSegments?.();
        } else if (key === "l") {
          e.preventDefault();
          handlers.onGoLejek?.();
        } else if (key === "w") {
          e.preventDefault();
          handlers.onGoWebsite?.();
        } else if (key === "c") {
          e.preventDefault();
          handlers.onGoChannels?.();
        }
        return;
      }

      if (key === "g") {
        pendingG.current = true;
        gTimeout.current = setTimeout(clearPendingG, VIM_TIMEOUT_MS);
      }
    };

    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      clearPendingG();
    };
  }, [handlers]);
}
