import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

/**
 * Wspólne klocki widoków analitycznych (rynek, konkurencja).
 *
 * Te ekrany są do CZYTANIA, nie do edycji — stąd inne zasady niż w edytorach:
 * węższa kolumna tekstu, większa interlinia, nagłówki niosące hierarchię
 * zamiast ramek. Wszystko renderuje się po stronie serwera (brak `"use client"`),
 * bo nie ma tu interakcji poza zwykłymi linkami.
 */

/** Szerokość kolumny tekstu ~65 znaków — próg czytelności dłuższych akapitów. */
export function AnalysisProse({
  children,
  className,
}: {
  children: string | null | undefined;
  className?: string;
}) {
  if (!children?.trim()) return null;
  return (
    <div
      className={cn(
        "max-w-[65ch] text-sm leading-relaxed text-foreground/90",
        "[&_a]:text-brand [&_a]:underline [&_a]:underline-offset-2",
        "[&_p]:mt-0 [&_p]:mb-3 [&_p:last-child]:mb-0",
        "[&_ul]:mb-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:mb-3 [&_ol]:list-decimal [&_ol]:pl-5",
        "[&_li]:mb-1 [&_strong]:font-semibold [&_code]:text-xs",
        "[&_h1]:text-base [&_h1]:font-semibold [&_h2]:text-sm [&_h2]:font-semibold",
        "[&_h3]:text-sm [&_h3]:font-medium",
        className
      )}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{children}</ReactMarkdown>
    </div>
  );
}

/** Etykieta pola z treścią — pomija się w całości, gdy treści brak. */
export function AnalysisField({
  label,
  value,
  className,
}: {
  label: string;
  value: string | null | undefined;
  className?: string;
}) {
  if (!value?.trim()) return null;
  return (
    <div className={className}>
      <h4 className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </h4>
      <AnalysisProse>{value}</AnalysisProse>
    </div>
  );
}

export function AnalysisSection({
  title,
  hint,
  children,
  action,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section className="space-y-4">
      <div className="flex items-end justify-between gap-4 border-b border-border pb-2">
        <div className="min-w-0">
          <h2 className="text-base font-semibold tracking-tight">{title}</h2>
          {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function AnalysisStat({
  label,
  value,
  hint,
  alarm,
}: {
  label: string;
  value: string | number;
  hint?: string;
  alarm?: boolean;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1.5 text-2xl font-semibold tabular-nums">{value}</p>
      {hint && (
        <p
          className={cn(
            "mt-0.5 text-[11px]",
            alarm ? "text-destructive" : "text-muted-foreground"
          )}
        >
          {hint}
        </p>
      )}
    </div>
  );
}

/**
 * Lista braków w danych. Pokazujemy je przy encji, a nie w osobnym raporcie —
 * luka widziana w kontekście jest zaproszeniem do uzupełnienia, luka w raporcie
 * jest tylko wyrzutem sumienia.
 */
export function GapList({ gaps }: { gaps: string[] }) {
  if (gaps.length === 0) return null;
  return (
    <p className="text-[11px] text-muted-foreground">
      Brakuje:{" "}
      {gaps.map((g, i) => (
        <span key={g}>
          <span className="text-destructive/80">{g}</span>
          {i < gaps.length - 1 ? ", " : ""}
        </span>
      ))}
    </p>
  );
}

/** Pasek oceny 0–10 — czytelniejszy niż goła liczba przy porównywaniu segmentów. */
export function ScoreBar({
  label,
  score,
  max = 10,
}: {
  label: string;
  score: number | null;
  max?: number;
}) {
  const pct = score === null ? 0 : Math.max(0, Math.min(100, (score / max) * 100));
  return (
    <div className="flex items-center gap-2">
      <span className="w-14 shrink-0 text-[11px] text-muted-foreground">{label}</span>
      <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
        <span
          className="block h-full rounded-full bg-brand transition-[width]"
          style={{ width: `${pct}%` }}
        />
      </span>
      <span className="w-8 shrink-0 text-right text-[11px] tabular-nums">
        {score === null ? "—" : score}
      </span>
    </div>
  );
}

export function EmptyAnalysis({
  title,
  description,
  href,
  linkLabel,
}: {
  title: string;
  description: string;
  href: string;
  linkLabel: string;
}) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-card/40 py-14 text-center">
      <h3 className="text-sm font-medium">{title}</h3>
      <p className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">
        {description}
      </p>
      <a
        href={href}
        className="mt-4 inline-block text-xs text-brand underline underline-offset-2"
      >
        {linkLabel}
      </a>
    </div>
  );
}
