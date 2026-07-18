"use client";

import { useCallback, useEffect, useState } from "react";
import {
  FileJson,
  FileText,
  FileType,
  Image as ImageIcon,
  Network,
  Loader2,
  Mail,
  Check,
  Download,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SectionCard } from "@/components/strategy-hub/entity-singleton";
import { apiFetch } from "@/lib/strategy-hub/api-fetch";
import { emitToast } from "@/lib/strategy-hub/toast";
import { cn } from "@/lib/utils";

interface Props {
  projectId: string;
}

type ExportType = "json" | "md" | "docx" | "png_map" | "svg_graph";

const TYPES: { key: ExportType; label: string; icon: typeof FileJson; hint: string }[] = [
  { key: "json", label: "JSON", icon: FileJson, hint: "Pełny zrzut danych strategii." },
  { key: "md", label: "Markdown", icon: FileText, hint: "Raport tekstowy, gotowy do wklejenia." },
  { key: "docx", label: "DOCX", icon: FileType, hint: "Raport strategii w formacie Word." },
];

interface ExportJob {
  id: string;
  type: string;
  status: string;
  createdAt: string;
}

/**
 * Panel eksportów strategii (Faza 14, M2): JSON/MD/DOCX generowane server-side
 * na żądanie + wysyłka mailem (Resend) z historią (`export_jobs`/`delivery_log`).
 * PNG/SVG mapy grafu relacji eksportowane po stronie klienta (patrz relation-graph.tsx).
 */
export function ExportPanel({ projectId }: Props) {
  const base = `/api/strategy-hub/projects/${projectId}/exports`;
  const [jobs, setJobs] = useState<ExportJob[]>([]);
  const [downloading, setDownloading] = useState<ExportType | null>(null);
  const [emailFor, setEmailFor] = useState<ExportType | null>(null);
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sentOk, setSentOk] = useState<ExportType | null>(null);

  const refreshJobs = useCallback(() => {
    void apiFetch<{ items?: ExportJob[] }>(base, { silent: true })
      .then((data) => setJobs(data.items ?? []))
      .catch(() => {}); // tło, niekrytyczne
  }, [base]);

  useEffect(() => {
    refreshJobs();
  }, [refreshJobs]);

  const download = async (type: ExportType) => {
    setDownloading(type);
    try {
      const res = await fetch(base, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type }),
      });
      if (!res.ok) throw new Error("export failed");
      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") ?? "";
      const match = /filename="([^"]+)"/.exec(disposition);
      const filename = match?.[1] ?? `eksport.${type}`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      refreshJobs();
    } catch {
      emitToast("Eksport nie powiódł się. Spróbuj ponownie.");
    } finally {
      setDownloading(null);
    }
  };

  const sendEmail = async (type: ExportType) => {
    if (!email.trim()) return;
    setSending(true);
    try {
      // Generowanie + wysyłka maila trwa — dłuższy timeout niż standardowe 8 s.
      await apiFetch(`${base}/deliver`, {
        method: "POST",
        json: { type, email: email.trim() },
        timeoutMs: 30_000,
      });
      setSentOk(type);
      setTimeout(() => setSentOk(null), 3000);
      setEmailFor(null);
      refreshJobs();
    } catch {
      // toast pokazuje apiFetch
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-4">
      <SectionCard
        title="Eksport raportu strategii"
        description="Wygeneruj i pobierz lub wyślij mailem aktualny raport strategii."
      >
        <div className="grid gap-3 sm:grid-cols-3">
          {TYPES.map((t) => (
            <div
              key={t.key}
              className="flex flex-col gap-2 rounded-xl border border-border bg-card/40 p-3"
            >
              <div className="flex items-center gap-2">
                <t.icon className="size-4 text-brand" />
                <span className="text-sm font-medium">{t.label}</span>
              </div>
              <p className="text-xs text-muted-foreground flex-1">{t.hint}</p>
              <div className="flex items-center gap-1.5">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void download(t.key)}
                  disabled={downloading === t.key}
                  className="h-7 flex-1 gap-1.5 text-xs"
                >
                  {downloading === t.key ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Download className="size-3.5" />
                  )}
                  Pobierz
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setEmailFor(emailFor === t.key ? null : t.key)}
                  className="h-7 shrink-0 px-2"
                  aria-label="Wyślij mailem"
                >
                  <Mail className="size-3.5" />
                </Button>
              </div>
              {emailFor === t.key && (
                <div className="flex items-center gap-1.5 pt-1">
                  <Input
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="adres@email.com"
                    className="h-7 flex-1 text-xs"
                  />
                  <Button
                    size="sm"
                    onClick={() => void sendEmail(t.key)}
                    disabled={sending || !email.trim()}
                    className="h-7 shrink-0 px-2 text-xs"
                  >
                    {sending ? <Loader2 className="size-3.5 animate-spin" /> : "Wyślij"}
                  </Button>
                </div>
              )}
              {sentOk === t.key && (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-success">
                  <Check className="size-3.5" /> Wysłano
                </span>
              )}
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard
        title="Mapa i graf relacji"
        description="Eksport PNG/SVG dostępny bezpośrednio z widoku mapy i grafu relacji projektu."
      >
        <div className="flex flex-wrap gap-2">
          <a
            href={`/strategy-hub/projects/${projectId}`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:border-brand/40"
          >
            <ImageIcon className="size-3.5" /> Otwórz Strategy Map
          </a>
          <a
            href={`/strategy-hub/projects/${projectId}/relations`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:border-brand/40"
          >
            <Network className="size-3.5" /> Otwórz Graf relacji
          </a>
        </div>
      </SectionCard>

      {jobs.length > 0 && (
        <SectionCard title="Historia eksportów">
          <ul className="divide-y divide-border/60 text-sm">
            {jobs.map((j) => (
              <li key={j.id} className="flex items-center justify-between gap-2 py-1.5">
                <span className="font-medium uppercase text-xs tracking-wide text-muted-foreground">
                  {j.type}
                </span>
                <span
                  className={cn(
                    "text-xs",
                    j.status === "done"
                      ? "text-success"
                      : j.status === "failed"
                      ? "text-destructive"
                      : "text-muted-foreground"
                  )}
                >
                  {j.status}
                </span>
                <span className="text-xs text-muted-foreground">
                  {new Date(j.createdAt).toLocaleString("pl-PL")}
                </span>
              </li>
            ))}
          </ul>
        </SectionCard>
      )}
    </div>
  );
}
