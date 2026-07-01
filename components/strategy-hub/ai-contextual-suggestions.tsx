"use client";

import { usePathname } from "next/navigation";
import {
  Sparkles,
  Users,
  Filter,
  Target,
  ShieldQuestion,
  Crosshair,
  Globe,
  Megaphone,
  Stethoscope,
  GitCompareArrows,
  ListChecks,
  TrendingUp,
} from "lucide-react";

interface PromptAction {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  prompt: string;
}

/** Zwraca kontekstowe sugestie zależne od aktualnej ścieżki w Hubie. */
function contextualFor(pathname: string): {
  context: string;
  actions: PromptAction[];
} {
  if (pathname.includes("/market/segments") || pathname.includes("/segments")) {
    return {
      context: "Segmenty",
      actions: [
        { icon: ShieldQuestion, label: "Zaproponuj 5 obiekcji", prompt: "Dla aktualnych segmentów zaproponuj po 5 typowych obiekcji wraz z odpowiedzią i dowodem." },
        { icon: Users, label: "Zaproponuj nowe segmenty", prompt: "Użyj suggest_segments i zaproponuj 1–3 nowe segmenty klientów dla tego projektu." },
        { icon: Filter, label: "Wygeneruj lejek dla segmentu", prompt: "Użyj suggest_funnel i zaproponuj elementy lejka dla moich segmentów." },
      ],
    };
  }
  if (pathname.includes("/execution/funnel") || pathname.includes("/funnel")) {
    return {
      context: "Lejek",
      actions: [
        { icon: Filter, label: "Czego brakuje w lejku?", prompt: "Użyj suggest_funnel — sprawdź których faz (TOFU/MOFU/BOFU/retencja) brakuje i co dodać." },
        { icon: ListChecks, label: "Audyt pokrycia lejka", prompt: "Czy lejek pokrywa wszystkie etapy buyer journey dla każdego segmentu? Wskaż luki." },
      ],
    };
  }
  if (pathname.includes("/foundation/business") || pathname.includes("/business")) {
    return {
      context: "Strategia biznesowa",
      actions: [
        { icon: GitCompareArrows, label: "Porównaj z konkurencją", prompt: "Użyj compare_competitors i porównaj naszą pozycję z konkurentami na quadrancie." },
        { icon: Crosshair, label: "Sprawdź spójność UVP", prompt: "Czy nasze UVP jest spójne z problemami biznesowymi i pozycjonowaniem? Wskaż rozbieżności." },
      ],
    };
  }
  if (pathname.includes("/execution/sites") || pathname.includes("/website")) {
    return {
      context: "Strona",
      actions: [
        { icon: Globe, label: "Zaproponuj sekcję hero", prompt: "Wygeneruj sekcję hero z nagłówkiem i CTA dopasowanym do głównego segmentu." },
        { icon: Target, label: "Sprawdź zgodność z UVP", prompt: "Sprawdź czy treść stron jest zgodna z naszym UVP i pozycjonowaniem." },
      ],
    };
  }
  if (pathname.includes("/execution/campaigns") || pathname.includes("/campaigns")) {
    return {
      context: "Kampanie",
      actions: [
        { icon: Megaphone, label: "Zaproponuj kampanię", prompt: "Zaproponuj kampanię dla wybranego segmentu i fazy lejka: cel, kanały, kreacje, KPI." },
      ],
    };
  }
  return {
    context: "Ogólne",
    actions: [
      { icon: Stethoscope, label: "Audyt spójności strategii", prompt: "Użyj analyze_strategy i wskaż luki, sprzeczności oraz 3 rekomendacje." },
      { icon: Users, label: "Zaproponuj segmenty", prompt: "Użyj suggest_segments i zaproponuj 1–3 segmenty klientów." },
      { icon: Filter, label: "Zaproponuj lejek", prompt: "Użyj suggest_funnel i zaproponuj brakujące elementy lejka." },
    ],
  };
}

const ANALYSES: PromptAction[] = [
  { icon: Stethoscope, label: "Czy strategia jest spójna?", prompt: "Użyj analyze_strategy i przeanalizuj spójność: luki, sprzeczności, brakujące elementy. Podaj 3 rekomendacje." },
  { icon: GitCompareArrows, label: "Porównaj nas z konkurencją", prompt: "Użyj compare_competitors i porównaj naszą pozycję z konkurentami. Wskaż lukę rynkową." },
  { icon: Filter, label: "Audyt pokrycia lejka", prompt: "Sprawdź czy lejek pokrywa wszystkie etapy buyer journey dla każdego segmentu. Wskaż czego brakuje." },
  { icon: TrendingUp, label: "Plan na wyższy Health Score", prompt: "Użyj analyze_strategy i zaproponuj konkretny plan działań, który najszybciej podniesie Health Score." },
];

function ActionButton({
  action,
  onRun,
}: {
  action: PromptAction;
  onRun: (prompt: string) => void;
}) {
  const Icon = action.icon;
  return (
    <button
      type="button"
      onClick={() => onRun(action.prompt)}
      className="flex w-full items-center gap-2.5 rounded-lg border border-border/60 bg-card/50 px-3 py-2.5 text-left text-sm transition-colors hover:border-brand/40 hover:bg-card"
    >
      <Icon className="size-4 shrink-0 text-brand" />
      <span className="min-w-0 flex-1 truncate text-foreground">{action.label}</span>
    </button>
  );
}

/** Zakładka „Sugestie kontekstowe" — akcje zależne od bieżącego ekranu. */
export function ContextualSuggestions({ onRun }: { onRun: (prompt: string) => void }) {
  const pathname = usePathname();
  const { context, actions } = contextualFor(pathname);

  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="flex items-center gap-2">
        <Sparkles className="size-4 text-brand" />
        <p className="text-xs text-muted-foreground">
          Kontekst: <span className="text-foreground">{context}</span>
        </p>
      </div>
      <div className="flex flex-col gap-2">
        {actions.map((a) => (
          <ActionButton key={a.label} action={a} onRun={onRun} />
        ))}
      </div>
      <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground/70">
        Klik wysyła prompt do czatu AI z kontekstem projektu.
      </p>
    </div>
  );
}

/** Zakładka „Analizy" — gotowe audyty strategii. */
export function StrategyAnalyses({ onRun }: { onRun: (prompt: string) => void }) {
  return (
    <div className="flex flex-col gap-2 p-4">
      {ANALYSES.map((a) => (
        <ActionButton key={a.label} action={a} onRun={onRun} />
      ))}
    </div>
  );
}
