"use client";

import { useState, useTransition } from "react";
import { TiptapEditor } from "@/components/strategy-hub/tiptap-editor";
import {
  Target,
  Sparkles,
  Users,
  MessageSquare,
  ArrowUpToLine,
  FileDown,
  Loader2,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface Strategy {
  projectId: string;
  goalsMd: string | null;
  uvpMd: string | null;
  competitorsMd: string | null;
  objectionsMd: string | null;
}

interface Props {
  projectId: string;
  projectName: string;
  strategy: Strategy;
}

const SECTIONS = [
  {
    key: "goalsMd" as const,
    label: "Cele projektu",
    icon: Target,
    color: "text-violet-400",
    bg: "bg-violet-500/10 border-violet-500/20",
    placeholder:
      "Jaki jest główny cel projektu? Co klient chce osiągnąć? (np. zwiększyć sprzedaż online o 30% w 12 miesiącach)",
  },
  {
    key: "uvpMd" as const,
    label: "UVP — Unikalna propozycja wartości",
    icon: Sparkles,
    color: "text-amber-400",
    bg: "bg-amber-500/10 border-amber-500/20",
    placeholder:
      "Co wyróżnia ten biznes na tle konkurencji? Dlaczego klient powinien wybrać właśnie to?",
  },
  {
    key: "competitorsMd" as const,
    label: "Analiza konkurencji",
    icon: Users,
    color: "text-blue-400",
    bg: "bg-blue-500/10 border-blue-500/20",
    placeholder:
      "Kto jest konkurencją? Jakie mają mocne i słabe strony? Co możemy zrobić lepiej?",
  },
  {
    key: "objectionsMd" as const,
    label: "Obiekcje klientów",
    icon: MessageSquare,
    color: "text-rose-400",
    bg: "bg-rose-500/10 border-rose-500/20",
    placeholder:
      "Jakie główne obiekcje mają potencjalni klienci? Dlaczego nie kupują? Jak je zbijamy?",
  },
];

export function BusinessStrategyEditor({ projectId, projectName, strategy }: Props) {
  const [activeSection, setActiveSection] = useState<string | null>(
    SECTIONS[0].key
  );
  const [pushState, setPushState] = useState<"idle" | "success" | "error">(
    "idle"
  );
  const [pushing, startPush] = useTransition();

  const handleSave = async (key: keyof Strategy, markdown: string) => {
    await fetch(`/api/strategy-hub/projects/${projectId}/business`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [key]: markdown }),
    });
  };

  const handlePush = () => {
    startPush(async () => {
      try {
        const res = await fetch("/api/strategy-hub/notion/push", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ projectId }),
        });
        setPushState(res.ok ? "success" : "error");
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          console.error("Push error", data);
        }
        setTimeout(() => setPushState("idle"), 3000);
      } catch (err) {
        console.error(err);
        setPushState("error");
        setTimeout(() => setPushState("idle"), 3000);
      }
    });
  };

  const filledCount = SECTIONS.filter(
    (s) => (strategy[s.key]?.length ?? 0) > 0
  ).length;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            📄 Strategia biznesowa
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {projectName} ·{" "}
            <span className={filledCount === 4 ? "text-success" : "text-muted-foreground"}>
              {filledCount}/4 sekcji uzupełnionych
            </span>
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            asChild
            size="sm"
            variant="outline"
            className="gap-1.5"
          >
            <a
              href={`/api/strategy-hub/projects/${projectId}/business/pdf`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <FileDown className="size-3.5" />
              PDF
            </a>
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handlePush}
            disabled={pushing}
            className={cn(
              "gap-1.5",
              pushState === "success" && "border-success/40 text-success",
              pushState === "error" && "border-destructive/40 text-destructive"
            )}
          >
            {pushing ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : pushState === "success" ? (
              <Check className="size-3.5" />
            ) : (
              <ArrowUpToLine className="size-3.5" />
            )}
            {pushState === "success"
              ? "Wysłano"
              : pushState === "error"
                ? "Błąd"
                : "Wyślij do Notion"}
          </Button>
        </div>
      </div>

      {/* Sekcje */}
      <div className="space-y-4">
        {SECTIONS.map((section) => {
          const isOpen = activeSection === section.key;
          const isFilled = (strategy[section.key]?.length ?? 0) > 0;

          return (
            <div
              key={section.key}
              className="rounded-xl border border-border overflow-hidden"
            >
              <button
                type="button"
                onClick={() =>
                  setActiveSection(isOpen ? null : section.key)
                }
                className={cn(
                  "w-full flex items-center gap-3 px-5 py-4 text-left transition-colors",
                  "hover:bg-muted/30",
                  isOpen && "bg-muted/20"
                )}
              >
                <div
                  className={cn(
                    "size-8 rounded-lg border flex items-center justify-center shrink-0",
                    section.bg
                  )}
                >
                  <section.icon className={cn("size-4", section.color)} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm">{section.label}</div>
                  {!isOpen && isFilled && (
                    <div className="text-xs text-muted-foreground truncate mt-0.5">
                      {strategy[section.key]
                        ?.replace(/#+\s/g, "")
                        .substring(0, 80)}
                      …
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {isFilled && (
                    <span className="text-[10px] text-success font-medium">
                      ✓
                    </span>
                  )}
                  <span
                    className={cn(
                      "text-muted-foreground transition-transform duration-200",
                      isOpen && "rotate-180"
                    )}
                  >
                    ▾
                  </span>
                </div>
              </button>

              {isOpen && (
                <div className="border-t border-border">
                  <TiptapEditor
                    initialContent={strategy[section.key] ?? ""}
                    placeholder={section.placeholder}
                    onSave={(md) => handleSave(section.key, md)}
                    className="rounded-none border-0"
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
