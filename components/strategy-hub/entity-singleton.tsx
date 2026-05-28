"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Loader2, Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type SaveStatus = "idle" | "saving" | "saved";
type Data = Record<string, unknown>;

/**
 * Hook do edycji encji singletonowej (jeden wiersz per projekt) z autosave.
 * PATCH debounce'owany (600 ms), optimistic merge do lokalnego stanu.
 */
export function useSingleton(projectId: string, entity: string) {
  const base = `/api/strategy-hub/projects/${projectId}/${entity}`;
  const [data, setData] = useState<Data>({});
  const [loaded, setLoaded] = useState(false);
  const [status, setStatus] = useState<SaveStatus>("idle");

  const pendingRef = useRef<Data>({});
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    fetch(base, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : { item: null }))
      .then((j) => setData(j.item ?? {}))
      .catch(() => {})
      .finally(() => setLoaded(true));
    return () => ctrl.abort();
  }, [base]);

  const flush = useCallback(async () => {
    const patch = pendingRef.current;
    pendingRef.current = {};
    if (Object.keys(patch).length === 0) return;
    setStatus("saving");
    try {
      await fetch(base, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
        signal: AbortSignal.timeout(8000),
      });
      setStatus("saved");
      setTimeout(() => setStatus("idle"), 1500);
    } catch (err) {
      console.error("singleton save failed", err);
      setStatus("idle");
    }
  }, [base]);

  const patch = useCallback(
    (partial: Data) => {
      setData((d) => ({ ...d, ...partial }));
      pendingRef.current = { ...pendingRef.current, ...partial };
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => void flush(), 600);
    },
    [flush]
  );

  return { data, loaded, status, patch };
}

// ─── Wskaźnik zapisu ─────────────────────────────────────────────────────────

export function SaveIndicator({ status }: { status: SaveStatus }) {
  if (status === "saving")
    return (
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        <Loader2 className="size-3 animate-spin" />
        Zapisywanie…
      </span>
    );
  if (status === "saved")
    return (
      <span className="inline-flex items-center gap-1 text-xs text-success">
        <Check className="size-3" />
        Zapisano
      </span>
    );
  return null;
}

// ─── Pole markdown / tekst z autosave ────────────────────────────────────────

interface TextFieldProps {
  label: string;
  hint?: string;
  value: unknown;
  /** Wołane przy każdej zmianie — `useSingleton.patch` aktualizuje stan i debounce'uje zapis. */
  onCommit: (v: string) => void;
  multiline?: boolean;
  url?: boolean;
  placeholder?: string;
  rows?: number;
}

export function AutosaveField({
  label,
  hint,
  value,
  onCommit,
  multiline,
  url,
  placeholder,
  rows = 4,
}: TextFieldProps) {
  const str = value == null ? "" : String(value);

  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <label className="text-sm font-medium">{label}</label>
        {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      </div>
      {multiline ? (
        <Textarea
          value={str}
          onChange={(e) => onCommit(e.target.value)}
          placeholder={placeholder}
          rows={rows}
          className="text-sm resize-y"
        />
      ) : (
        <Input
          type={url ? "url" : "text"}
          value={str}
          onChange={(e) => onCommit(e.target.value)}
          placeholder={placeholder}
          className="h-9 text-sm"
        />
      )}
    </div>
  );
}

// ─── Sekcja (karta) ──────────────────────────────────────────────────────────

export function SectionCard({
  title,
  description,
  status,
  children,
}: {
  title: string;
  description?: string;
  status?: SaveStatus;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-border bg-card/40 overflow-hidden">
      <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-3">
        <div>
          <h2 className="text-sm font-semibold">{title}</h2>
          {description && (
            <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
          )}
        </div>
        {status && <SaveIndicator status={status} />}
      </div>
      <div className="p-5 space-y-4">{children}</div>
    </section>
  );
}
