"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const STEPS = [
  { title: "Dane projektu", body: "Nazwa, klient, domena — już wypełnione." },
  { title: "Fundament", body: "Dodaj 1 problem biznesowy i UVP (szablon ~40%)." },
  { title: "Segmenty", body: "Zdefiniuj 1–2 segmenty docelowe." },
  { title: "Lejek", body: "Minimum 1 etap zakupu + element lejka." },
  { title: "Kanały", body: "Wybierz 2 kanały i przypisz do segmentu." },
  { title: "Strona", body: "Primary site + 3 podstrony kluczowe." },
  { title: "KPI", body: "3 wskaźniki z celami liczbowymi." },
] as const;

interface Props {
  projectId: string;
  onDone?: () => void;
}

export function OnboardingWizard({ projectId, onDone }: Props) {
  const [step, setStep] = useState(0);
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  const current = STEPS[step];
  const progress = Math.round(((step + 1) / STEPS.length) * 100);

  return (
    <div
      className={cn(
        "rounded-2xl border border-brand/30 bg-brand/5 p-5 space-y-4",
        "motion-safe:animate-in motion-safe:fade-in"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-brand" />
          <div>
            <p className="text-sm font-semibold">Onboarding · krok {step + 1}/{STEPS.length}</p>
            <p className="text-xs text-muted-foreground">{progress}% szablonu strategii</p>
          </div>
        </div>
        <button
          type="button"
          className="text-xs text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded px-1"
          onClick={() => {
            setDismissed(true);
            onDone?.();
          }}
        >
          Pomiń
        </button>
      </div>

      <div>
        <h3 className="text-base font-medium">{current.title}</h3>
        <p className="text-sm text-muted-foreground mt-1">{current.body}</p>
      </div>

      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full bg-brand transition-[width] duration-300 motion-reduce:transition-none"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="flex items-center justify-between gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={step === 0}
          onClick={() => setStep((s) => s - 1)}
        >
          <ChevronLeft className="size-3.5" /> Wstecz
        </Button>
        {step < STEPS.length - 1 ? (
          <Button
            type="button"
            size="sm"
            className="bg-brand text-white hover:bg-brand/90"
            onClick={() => setStep((s) => s + 1)}
          >
            Dalej <ChevronRight className="size-3.5" />
          </Button>
        ) : (
          <Button type="button" size="sm" asChild className="bg-brand text-white">
            <Link href={`/strategy-hub/projects/${projectId}`} onClick={() => onDone?.()}>
              Otwórz mapę firmy
            </Link>
          </Button>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        <Link
          href="/strategy-hub/sync"
          className="text-brand hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
        >
          Zaimportuj z Notion
        </Link>{" "}
        — opcjonalnie uzupełnij discovery.
      </p>
    </div>
  );
}
