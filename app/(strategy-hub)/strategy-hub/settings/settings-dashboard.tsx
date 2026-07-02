"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Sun, Moon, Leaf, Monitor, Save, CheckCircle2, Sparkles, Brain, Users, Palette } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useTheme, type Theme } from "@/components/strategy-hub/theme-provider";
import { useLocalStorageString } from "@/hooks/use-local-storage-string";

const AI_RULES_KEY = "strategy-hub-ai-rules";

// ─── Theme picker ─────────────────────────────────────────────────────────────

const THEMES: {
  id: Theme;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  preview: { bg: string; card: string; brand: string; text: string };
}[] = [
  {
    id: "dark",
    label: "Ciemny",
    description: "Ciemne tło, fioletowy akcent — domyślny motyw Syntance",
    icon: Moon,
    preview: { bg: "#09090b", card: "#18181b", brand: "#8b5cf6", text: "#fafafa" },
  },
  {
    id: "light",
    label: "Jasny",
    description: "Jasne tło, czysty i czytelny — dobry w mocnym oświetleniu",
    icon: Sun,
    preview: { bg: "#fafaf9", card: "#ffffff", brand: "#7c3aed", text: "#1c1917" },
  },
  {
    id: "earth",
    label: "Ziemny",
    description: "Ciepłe brązy i ambra — przytulny, mniej kontrastowy",
    icon: Leaf,
    preview: { bg: "#1a1610", card: "#252018", brand: "#d97706", text: "#f0ebe0" },
  },
  {
    id: "auto",
    label: "Automatyczny",
    description: "Śledzi ustawienie jasny/ciemny systemu operacyjnego",
    icon: Monitor,
    preview: { bg: "linear-gradient(135deg, #fafaf9 50%, #09090b 50%)", card: "#9c9c9c", brand: "#7c3aed", text: "#555" },
  },
];

function ThemeCard({
  theme: t,
  active,
  onClick,
}: {
  theme: (typeof THEMES)[number];
  active: boolean;
  onClick: () => void;
}) {
  const Icon = t.icon;
  const isAuto = t.id === "auto";

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "relative flex flex-col gap-3 rounded-xl border-2 p-4 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        active
          ? "border-brand bg-brand/5 shadow-[0_0_0_1px_var(--brand)]"
          : "border-border/60 hover:border-border bg-card/40 hover:bg-card/70"
      )}
    >
      {/* Mini preview */}
      <div
        className="h-16 w-full rounded-lg overflow-hidden relative border border-black/10"
        style={{ background: isAuto ? "linear-gradient(135deg, #fafaf9 50%, #09090b 50%)" : t.preview.bg }}
      >
        {!isAuto && (
          <>
            <div
              className="absolute top-2 left-2 right-2 h-3 rounded-sm"
              style={{ background: t.preview.card }}
            />
            <div
              className="absolute top-7 left-2 w-8 h-2 rounded-sm"
              style={{ background: t.preview.brand }}
            />
            <div
              className="absolute top-11 left-2 right-4 h-1.5 rounded-sm opacity-50"
              style={{ background: t.preview.text }}
            />
            <div
              className="absolute top-14 left-2 right-8 h-1.5 rounded-sm opacity-30"
              style={{ background: t.preview.text }}
            />
          </>
        )}
        {isAuto && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Monitor className="size-5 text-muted-foreground/60" />
          </div>
        )}
      </div>

      {/* Label */}
      <div className="flex items-center gap-2">
        <Icon
          className={cn("size-4", active ? "text-brand" : "text-muted-foreground")}
        />
        <span
          className={cn(
            "text-sm font-semibold",
            active ? "text-foreground" : "text-muted-foreground"
          )}
        >
          {t.label}
        </span>
        {active && (
          <CheckCircle2 className="size-3.5 text-brand ml-auto shrink-0" />
        )}
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed">{t.description}</p>
    </button>
  );
}

// ─── Settings dashboard ───────────────────────────────────────────────────────

export function SettingsDashboard() {
  const { theme, setTheme } = useTheme();
  const [storedRules, setStoredRules] = useLocalStorageString(AI_RULES_KEY);
  const [aiRules, setAiRules] = useState(storedRules);
  const [saved, setSaved] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Bufor edycji synchronizowany ze źródłem w localStorage bez efektu (wzorzec „poprzedni prop").
  const [prevStored, setPrevStored] = useState(storedRules);
  if (storedRules !== prevStored) {
    setPrevStored(storedRules);
    setAiRules(storedRules);
  }

  function saveAiRules() {
    setStoredRules(aiRules);
    setSaved(true);
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => setSaved(false), 2500);
  }

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  return (
    <div className="max-w-2xl mx-auto space-y-10">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-foreground">Ustawienia</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Personalizuj wygląd i zachowanie Strategy Hub.
        </p>
      </div>

      {/* ── Motyw ── */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <div className="size-7 rounded-lg bg-brand/10 border border-brand/20 flex items-center justify-center">
            <Sun className="size-3.5 text-brand" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-foreground">Motyw interfejsu</h2>
            <p className="text-xs text-muted-foreground">Wybierz schemat kolorów</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {THEMES.map((t) => (
            <ThemeCard
              key={t.id}
              theme={t}
              active={theme === t.id}
              onClick={() => setTheme(t.id)}
            />
          ))}
        </div>
      </section>

      {/* ── Reguły strategii ── */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <div className="size-7 rounded-lg bg-brand/10 border border-brand/20 flex items-center justify-center">
            <Sparkles className="size-3.5 text-brand" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-foreground">Reguły strategii</h2>
            <p className="text-xs text-muted-foreground">
              Silnik reguł — moduły, mapa, graf wpływu, alerty
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link href="/strategy-hub/settings/rules">Edytuj reguły (5 zakładek)</Link>
        </Button>
      </section>

      {/* ── Zespół ── */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <div className="size-7 rounded-lg bg-brand/10 border border-brand/20 flex items-center justify-center">
            <Users className="size-3.5 text-brand" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-foreground">Zespół</h2>
            <p className="text-xs text-muted-foreground">
              Zaproś współpracowników do wspólnego workspace
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link href="/strategy-hub/settings/team">Zarządzaj zespołem</Link>
        </Button>
      </section>

      {/* ── White-label ── */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <div className="size-7 rounded-lg bg-brand/10 border border-brand/20 flex items-center justify-center">
            <Palette className="size-3.5 text-brand" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-foreground">White-label</h2>
            <p className="text-xs text-muted-foreground">
              Branding portalu klienta — logo, kolory, domena
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link href="/strategy-hub/settings/branding">Ustawienia brandingu</Link>
        </Button>
      </section>

      {/* ── Zasady AI ── */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <div className="size-7 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
            <Brain className="size-3.5 text-violet-400" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-foreground">Zasady dla AI</h2>
            <p className="text-xs text-muted-foreground">
              Instrukcje dodawane do każdej rozmowy w AI Chat
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-border/60 bg-card/40 p-4 space-y-3">
          <div className="flex items-start gap-2.5 p-3 rounded-lg bg-violet-500/5 border border-violet-500/15">
            <Sparkles className="size-3.5 text-violet-400 shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground leading-relaxed">
              Napisz tutaj dodatkowe instrukcje, kontekst lub styl odpowiedzi.
              Przykłady: <em>&bdquo;Zawsze odpowiadaj po polsku&rdquo;</em>,{" "}
              <em>&bdquo;Jestem agencją digital — skupiaj się na ROI&rdquo;</em>,{" "}
              <em>&bdquo;Unikaj słowa &apos;innowacyjny&apos;&rdquo;</em>.
            </p>
          </div>

          <Textarea
            value={aiRules}
            onChange={(e) => {
              setAiRules(e.target.value);
              setSaved(false);
            }}
            placeholder="Np. Zawsze proponuj konkretne liczby i metryki. Piszę do klientów z branży e-commerce..."
            className="min-h-[7rem] resize-y text-sm leading-relaxed"
            maxLength={2000}
            aria-label="Zasady dla AI"
          />

          <div className="flex items-center justify-between gap-3">
            <span className="text-xs text-muted-foreground tabular-nums">
              {aiRules.length} / 2000 znaków
            </span>
            <Button
              type="button"
              size="sm"
              onClick={saveAiRules}
              className={cn(
                "gap-1.5 text-xs transition-colors",
                saved
                  ? "bg-success/20 text-success border-success/30 hover:bg-success/25"
                  : "bg-brand hover:bg-brand/90 text-white"
              )}
            >
              {saved ? (
                <>
                  <CheckCircle2 className="size-3.5" />
                  Zapisano
                </>
              ) : (
                <>
                  <Save className="size-3.5" />
                  Zapisz zasady
                </>
              )}
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
