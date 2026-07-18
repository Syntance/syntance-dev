"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Sparkles, ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Ścieżka onboardingu = kolejność budowy strategii wg Negacza (spec 12 §3):
 * fundament → segment (ICP) → PODRÓŻ ZAKUPOWA (kręgosłup) → lejek →
 * sprzedaż → przekaz → strona → pomiar. Każdy krok linkuje do edytora.
 */
const STEPS: {
  title: string;
  body: string;
  /** Ścieżka względem /strategy-hub/projects/[id] — null = bez linku. */
  path: string | null;
  cta: string | null;
}[] = [
  {
    title: "Dane projektu",
    body: "Nazwa, klient, domena — już wypełnione.",
    path: null,
    cta: null,
  },
  {
    title: "Fundament",
    body: "Problem biznesowy, UVP i pozycjonowanie: „jesteśmy X dla Y, w przeciwieństwie do W”. Bez specjalizacji nie ma strategii.",
    path: "/foundation/business",
    cta: "Otwórz fundament",
  },
  {
    title: "Segment (ICP)",
    body: "1–2 segmenty z kartą ICP: kto, jaki problem, jaki trigger zakupu. Scoring podpowie, na kim się skupić.",
    path: "/market/segments",
    cta: "Dodaj segment",
  },
  {
    title: "Podróż zakupowa",
    body: "Kręgosłup strategii: etapy, przez które przechodzi klient TEGO segmentu. Z nich wynikną kolumny lejka, sprzedaży i blueprintu.",
    path: "/market/journey",
    cta: "Zaprojektuj podróż",
  },
  {
    title: "Lejek — odpowiedzi marketingu",
    body: "Do każdego etapu: treść odpowiadająca na pytania klienta + kanał dystrybucji + dokąd prowadzi dalej.",
    path: "/execution/funnel",
    cta: "Otwórz lejek",
  },
  {
    title: "Proces sprzedaży",
    body: "Lustro podróży: co robi handlowiec na etapach sprzedażowych. Granica MQL→SQL wynika z pola „Prowadzi” na etapach.",
    path: "/execution/sales",
    cta: "Zaplanuj sprzedaż",
  },
  {
    title: "Przekaz i strona",
    body: "Macierz przekazu (segment × etap) i podstrony, na których klient spotyka strategię.",
    path: "/execution/copy",
    cta: "Otwórz przekaz",
  },
  {
    title: "Pomiar (KPI)",
    body: "KPI mierzące etapy podróży — zdrowie maszyny to pokrycie etapów, nie liczba rekordów.",
    path: "/measurement/kpi",
    cta: "Dodaj KPI",
  },
];

interface Props {
  projectId: string;
  onDone?: () => void;
}

export function OnboardingWizard({ projectId, onDone }: Props) {
  const [step, setStep] = useState(0);
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  const current = STEPS[step]!;
  const progress = Math.round(((step + 1) / STEPS.length) * 100);
  const base = `/strategy-hub/projects/${projectId}`;

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
            <p className="text-sm font-semibold">
              Ścieżka strategii · krok {step + 1}/{STEPS.length}
            </p>
            <p className="text-xs text-muted-foreground">
              fundament → segment → podróż → lejek → sprzedaż → pomiar
            </p>
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
        {current.path && current.cta && (
          <Button
            asChild
            size="sm"
            variant="outline"
            className="mt-2 border-brand/40 text-brand hover:bg-brand/10"
          >
            <Link href={`${base}${current.path}`}>
              {current.cta} <ArrowUpRight className="size-3.5" />
            </Link>
          </Button>
        )}
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
            <Link href={base} onClick={() => onDone?.()}>
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
        — opcjonalnie uzupełnij discovery. Kolejność kroków to rekomendacja, nie
        blokada — każdy moduł można edytować w dowolnym momencie.
      </p>
    </div>
  );
}
