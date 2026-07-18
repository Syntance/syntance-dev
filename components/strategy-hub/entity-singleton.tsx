"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Loader2, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch } from "@/lib/strategy-hub/api-fetch";

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
    apiFetch<{ item?: Data | null }>(base, { signal: ctrl.signal })
      .then((j) => setData(j.item ?? {}))
      .catch(() => {}) // toast pokazuje apiFetch
      .finally(() => setLoaded(true));
    return () => ctrl.abort();
  }, [base]);

  const flush = useCallback(async () => {
    const patch = pendingRef.current;
    pendingRef.current = {};
    if (Object.keys(patch).length === 0) return;
    setStatus("saving");
    try {
      await apiFetch(base, { method: "PATCH", json: patch });
      setStatus("saved");
      setTimeout(() => setStatus("idle"), 1500);
    } catch {
      // toast pokazuje apiFetch; status wraca do idle bez fałszywego "saved"
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
  label?: string;
  hint?: string;
  value: unknown;
  /** Wołane przy każdej zmianie — `useSingleton.patch` aktualizuje stan i debounce'uje zapis. */
  onCommit: (v: string) => void;
  multiline?: boolean;
  url?: boolean;
  placeholder?: string;
  rows?: number;
  /** Bez obramowania — do użycia wewnątrz `CalloutField`. */
  bare?: boolean;
  readOnly?: boolean;
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
  bare = false,
  readOnly = false,
}: TextFieldProps) {
  const str = value == null ? "" : String(value);
  const bareInputClass =
    "border-0 bg-transparent shadow-none focus-visible:ring-0 px-0 min-h-0";

  if (readOnly) {
    return (
      <div className={cn(!bare && "space-y-1.5")}>
        {label && (
          <label className="text-sm font-medium text-muted-foreground">{label}</label>
        )}
        <p className="text-sm text-foreground/90 whitespace-pre-wrap">
          {str || "—"}
        </p>
      </div>
    );
  }

  return (
    <div className={cn(!bare && "space-y-1.5")}>
      {!bare && (label || hint) && (
        <div className="flex items-baseline justify-between gap-2">
          {label ? (
            <label className="text-sm font-medium">{label}</label>
          ) : (
            <span />
          )}
          {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
        </div>
      )}
      {multiline ? (
        <Textarea
          value={str}
          onChange={(e) => onCommit(e.target.value)}
          placeholder={placeholder}
          rows={rows}
          className={cn("text-sm resize-y", bare && bareInputClass)}
        />
      ) : (
        <Input
          type={url ? "url" : "text"}
          value={str}
          onChange={(e) => onCommit(e.target.value)}
          placeholder={placeholder}
          className={cn("h-9 text-sm", bare && bareInputClass)}
        />
      )}
    </div>
  );
}

// ─── Tytuł nad calloutem (tylko treść w ramce) ───────────────────────────────

export function CalloutField({
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
    <section className="space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">{title}</h2>
          {description ? (
            <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
          ) : null}
        </div>
        {status ? <SaveIndicator status={status} /> : null}
      </div>
      <div className="rounded-xl border border-border bg-card/40 p-4">{children}</div>
    </section>
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
