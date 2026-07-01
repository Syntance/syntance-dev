"use client";

import * as React from "react";
import { Undo2, Redo2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface UndoEntry {
  label: string;
  undo: () => Promise<void> | void;
  redo: () => Promise<void> | void;
}

interface StackEntry extends UndoEntry {
  id: number;
}

interface UndoRedoApi {
  push: (entry: UndoEntry) => void;
  undo: () => void;
  redo: () => void;
}

const UndoRedoContext = React.createContext<UndoRedoApi | null>(null);

/**
 * Undo/redo sesyjne (Faza 7, M3) — stos w pamięci (nie przetrwa przeładowania
 * strony). Komponenty z inline-edit/autosave wołają `push()` PO udanym
 * zapisie, przekazując funkcję cofającą do poprzedniej wartości.
 */
export function useUndoRedo(): UndoRedoApi {
  const ctx = React.useContext(UndoRedoContext);
  if (!ctx) return { push: () => {}, undo: () => {}, redo: () => {} };
  return ctx;
}

export function UndoRedoProvider({ children }: { children: React.ReactNode }) {
  const nextId = React.useRef(0);
  const past = React.useRef<StackEntry[]>([]);
  const future = React.useRef<StackEntry[]>([]);
  const [toast, setToast] = React.useState<{ label: string; kind: "undo" | "redo" } | null>(
    null
  );
  const toastTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = React.useCallback((label: string, kind: "undo" | "redo") => {
    setToast({ label, kind });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3000);
  }, []);

  const api = React.useMemo<UndoRedoApi>(
    () => ({
      push: (entry) => {
        past.current.push({ ...entry, id: nextId.current++ });
        future.current = [];
        if (past.current.length > 50) past.current.shift();
      },
      undo: () => {
        const entry = past.current.pop();
        if (!entry) return;
        future.current.push(entry);
        void Promise.resolve(entry.undo());
        showToast(entry.label, "undo");
      },
      redo: () => {
        const entry = future.current.pop();
        if (!entry) return;
        past.current.push(entry);
        void Promise.resolve(entry.redo());
        showToast(entry.label, "redo");
      },
    }),
    [showToast]
  );

  return (
    <UndoRedoContext.Provider value={api}>
      {children}
      {toast && (
        <div
          role="status"
          className={cn(
            "fixed bottom-4 left-4 z-[100] flex items-center gap-2 rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-lg",
            "animate-in fade-in slide-in-from-bottom-2"
          )}
        >
          {toast.kind === "undo" ? (
            <Undo2 className="size-3.5 text-brand" />
          ) : (
            <Redo2 className="size-3.5 text-brand" />
          )}
          <span>
            {toast.kind === "undo" ? "Cofnięto: " : "Ponowiono: "}
            <span className="font-medium">{toast.label}</span>
          </span>
        </div>
      )}
    </UndoRedoContext.Provider>
  );
}
