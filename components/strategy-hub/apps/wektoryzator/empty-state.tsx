"use client";

import { useState, type DragEvent } from "react";
import { ImageUp, Layers, PenTool, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEditor } from "@/lib/strategy-hub/wektoryzator/store";
import { cn } from "@/lib/utils";
import styles from "./wektoryzator.module.css";

const STEPS = [
  { icon: ImageUp, title: "Wgraj obraz", text: "PNG, JPEG, WebP — zdjęcie, logo, skan." },
  { icon: PenTool, title: "Dobierz wygląd", text: "Preset, liczba kolorów, gładkość krzywych." },
  { icon: Layers, title: "Warstwy same się ułożą", text: "Tło, rodziny kolorów i obiekty — gotowe do edycji." },
  { icon: Download, title: "Eksportuj", text: "SVG, PDF, EPS, DXF, PNG albo warstwy w ZIP." },
];

export function EmptyState({ onPick }: { onPick: () => void }) {
  const openFile = useEditor((s) => s.openFile);
  const error = useEditor((s) => s.error);
  const [active, setActive] = useState(false);

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setActive(false);
    const file = event.dataTransfer.files[0];
    if (file) void openFile(file);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div
        data-active={active}
        onDragOver={(event) => {
          event.preventDefault();
          event.dataTransfer.dropEffect = "copy";
          setActive(true);
        }}
        onDragLeave={() => setActive(false)}
        onDrop={onDrop}
        className={cn(
          "relative flex min-h-[340px] flex-1 flex-col items-center justify-center gap-5 overflow-hidden rounded-2xl border-2 border-dashed border-border bg-card/50 p-8 text-center transition-colors",
          styles.dropzone,
        )}
      >
        <svg
          aria-hidden
          viewBox="0 0 220 120"
          className="h-28 w-56 text-primary"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <path d="M14 96 h12 v-12 h12 v-12 h12 v-12 h12 v-12 h12" className="opacity-40" strokeDasharray="3 3" />
          <path d="M110 96 C 140 96, 150 30, 206 26" strokeLinecap="round" />
          <circle cx="110" cy="96" r="3.5" fill="currentColor" />
          <circle cx="206" cy="26" r="3.5" fill="currentColor" />
          <path d="M110 96 L 140 96" className="opacity-50" />
          <path d="M206 26 L 176 28" className="opacity-50" />
          <rect x="137" y="93" width="6" height="6" className="fill-card" />
          <rect x="173" y="25" width="6" height="6" className="fill-card" />
        </svg>
        <div className="space-y-1.5">
          <h2 className="text-xl font-semibold tracking-tight">Upuść zdjęcie lub grafikę</h2>
          <p className="max-w-md text-sm text-muted-foreground">
            PNG, JPEG, WebP, GIF, BMP lub AVIF do 80 MB. Możesz też wkleić obraz ze schowka (Ctrl+V).
          </p>
        </div>
        <Button size="lg" onClick={onPick}>
          <ImageUp className="size-4" /> Wybierz obraz
        </Button>
        <p className="text-xs text-muted-foreground">
          Przetwarzanie odbywa się w Twojej przeglądarce — plik nie trafia na serwer.
        </p>
        {error ? (
          <p role="alert" className="rounded-md bg-destructive/10 px-3 py-1.5 text-xs font-medium text-destructive">
            {error}
          </p>
        ) : null}
      </div>
      <ol className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {STEPS.map((step, index) => (
          <li key={step.title} className="flex gap-3 rounded-xl border border-border bg-card p-3">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <step.icon className="size-4" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-semibold">
                {index + 1}. {step.title}
              </p>
              <p className="text-[11px] leading-snug text-muted-foreground">{step.text}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
