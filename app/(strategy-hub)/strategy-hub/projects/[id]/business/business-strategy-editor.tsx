"use client";

import { useState, useTransition, useRef, useCallback, useEffect } from "react";
import dynamic from "next/dynamic";
import { ListItemsEditor } from "@/components/strategy-hub/list-items-editor";
import {
  listItemsPreview,
  parseStrategyListItems,
} from "@/lib/strategy-hub/business-strategy-lists";
import {
  Target,
  Sparkles,
  Users,
  MessageSquare,
  ArrowUpToLine,
  FileDown,
  Loader2,
  Check,
  ChevronRight,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const TiptapEditor = dynamic(
  () =>
    import("@/components/strategy-hub/tiptap-editor").then((mod) => ({
      default: mod.TiptapEditor,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-[200px] items-center justify-center gap-2 border-t border-border text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Ładowanie edytora…
      </div>
    ),
  }
);

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

type SectionKey = keyof Strategy;

type SectionConfig = {
  key: SectionKey;
  label: string;
  icon: typeof Target;
  color: string;
  iconBg: string;
  activeBar: string;
  editor: "list" | "markdown";
  placeholder: string;
  emptyHint?: string;
  accent?: "violet" | "amber" | "rose";
};

const SECTIONS: SectionConfig[] = [
  {
    key: "goalsMd",
    label: "Cele biznesowe",
    icon: Target,
    color: "text-violet-400",
    iconBg: "bg-violet-500/10 border-violet-500/20",
    activeBar: "bg-violet-500",
    editor: "list",
    accent: "violet",
    placeholder: "np. zwiększyć sprzedaż online o 30% w 12 miesiącach",
    emptyHint: "Dodaj cele jako elementy — każdy z wagą i opcjonalną notatką.",
  },
  {
    key: "uvpMd",
    label: "UVP",
    icon: Sparkles,
    color: "text-amber-400",
    iconBg: "bg-amber-500/10 border-amber-500/20",
    activeBar: "bg-amber-500",
    editor: "list",
    accent: "amber",
    placeholder: "np. jedyny sklep z darmową personalizacją w 24h",
    emptyHint: "Dodaj argumenty UVP — każdy z wagą i notatką.",
  },
  {
    key: "competitorsMd",
    label: "Analiza konkurencji",
    icon: Users,
    color: "text-blue-400",
    iconBg: "bg-blue-500/10 border-blue-500/20",
    activeBar: "bg-blue-500",
    editor: "markdown",
    placeholder:
      "Kto jest konkurencją? Jakie mają mocne i słabe strony? Co możemy zrobić lepiej?",
  },
  {
    key: "objectionsMd",
    label: "Obiekcje klientów",
    icon: MessageSquare,
    color: "text-rose-400",
    iconBg: "bg-rose-500/10 border-rose-500/20",
    activeBar: "bg-rose-500",
    editor: "list",
    accent: "rose",
    placeholder: "np. za drogo w porównaniu do konkurencji",
    emptyHint:
      "Dodaj obiekcje — każda z wagą i opcjonalną notatką (np. jak ją zbijamy).",
  },
];

const NAV_MIN = 160;
const NAV_MAX = 400;
const NAV_DEFAULT = 224;
const CONTENT_MIN = 320;

function sectionIsFilled(section: SectionConfig, strategy: Strategy): boolean {
  const content = strategy[section.key];
  if (section.editor === "list") return parseStrategyListItems(content).length > 0;
  return (content?.length ?? 0) > 0;
}

function sectionPreview(section: SectionConfig, strategy: Strategy): string {
  const content = strategy[section.key];
  if (section.editor === "list") return listItemsPreview(content, 1);
  if (!content) return "";
  const stripped = content.replace(/#+\s/g, "").trim();
  return stripped.length > 55 ? `${stripped.substring(0, 55)}…` : stripped;
}

export function BusinessStrategyEditor({ projectId, projectName, strategy }: Props) {
  const [localStrategy, setLocalStrategy] = useState(strategy);
  const [activeKey, setActiveKey] = useState<SectionKey>(SECTIONS[0].key);
  const [pushState, setPushState] = useState<"idle" | "success" | "error">("idle");
  const [pushing, startPush] = useTransition();

  // ── Nav collapse + resize ─────────────────────────────────────────
  const [navOpen, setNavOpen] = useState(true);
  const [navWidth, setNavWidth] = useState(NAV_DEFAULT);
  const draggingNav = useRef(false);
  const dragStartX = useRef(0);
  const dragStartW = useRef(0);

  const onNavDragStart = useCallback((e: React.MouseEvent) => {
    draggingNav.current = true;
    dragStartX.current = e.clientX;
    dragStartW.current = navWidth;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, [navWidth]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!draggingNav.current) return;
      const delta = e.clientX - dragStartX.current;
      const next = Math.min(NAV_MAX, Math.max(NAV_MIN, dragStartW.current + delta));
      setNavWidth(next);
    };
    const onUp = () => {
      if (!draggingNav.current) return;
      draggingNav.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  const activeSection = SECTIONS.find((s) => s.key === activeKey)!;

  const handleSave = async (key: keyof Strategy, markdown: string) => {
    await fetch(`/api/strategy-hub/projects/${projectId}/business`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [key]: markdown }),
    });
    setLocalStrategy((prev) => ({ ...prev, [key]: markdown }));
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
        if (!res.ok) console.error("Push error", await res.json().catch(() => ({})));
        setTimeout(() => setPushState("idle"), 3000);
      } catch (err) {
        console.error(err);
        setPushState("error");
        setTimeout(() => setPushState("idle"), 3000);
      }
    });
  };

  const filledCount = SECTIONS.filter((s) => sectionIsFilled(s, localStrategy)).length;

  return (
    <div className="-m-6 h-[calc(100vh-3.5rem)] flex flex-col">
      {/* ── Top bar ──────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border shrink-0">
        {/* Nav toggle */}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8 shrink-0 text-muted-foreground hover:text-foreground"
          onClick={() => setNavOpen((v) => !v)}
          aria-label={navOpen ? "Schowaj menu" : "Pokaż menu"}
          title={navOpen ? "Schowaj menu" : "Pokaż menu"}
        >
          {navOpen ? (
            <PanelLeftClose className="size-4" />
          ) : (
            <PanelLeftOpen className="size-4" />
          )}
        </Button>

        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-semibold tracking-tight leading-tight">
            📄 Strategia biznesowa
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {projectName} ·{" "}
            <span className={filledCount === 4 ? "text-success" : "text-muted-foreground"}>
              {filledCount}/4 uzupełnione
            </span>
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button asChild size="sm" variant="outline" className="gap-1.5 h-8 text-xs">
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
              "gap-1.5 h-8 text-xs",
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
            {pushState === "success" ? "Wysłano" : pushState === "error" ? "Błąd" : "Wyślij do Notion"}
          </Button>
        </div>
      </div>

      {/* ── Split panel ──────────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">

        {/* ── Lewy nav ─────────────────────────────────── */}
        {navOpen && (
          <>
            <nav
              style={{ width: navWidth }}
              className="shrink-0 border-r border-border flex flex-col py-3 gap-0.5 overflow-y-auto overflow-x-hidden"
              aria-label="Sekcje strategii"
            >
              {SECTIONS.map((section) => {
                const isActive = activeKey === section.key;
                const isFilled = sectionIsFilled(section, localStrategy);
                const preview = sectionPreview(section, localStrategy);
                const Icon = section.icon;

                return (
                  <button
                    key={section.key}
                    type="button"
                    onClick={() => setActiveKey(section.key)}
                    aria-current={isActive ? "page" : undefined}
                    className={cn(
                      "relative group flex items-center gap-2.5 px-3 py-2.5 mx-2 rounded-lg text-left transition-colors",
                      isActive
                        ? "bg-muted text-foreground"
                        : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                    )}
                  >
                    {isActive && (
                      <span
                        className={cn(
                          "absolute left-0 top-2 bottom-2 w-0.5 rounded-full",
                          section.activeBar
                        )}
                      />
                    )}
                    <div
                      className={cn(
                        "size-7 rounded-md border flex items-center justify-center shrink-0",
                        isActive ? section.iconBg : "bg-muted/30 border-border/50"
                      )}
                    >
                      <Icon className={cn("size-3.5", isActive ? section.color : "text-muted-foreground")} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium leading-tight truncate">
                        {section.label}
                      </div>
                    </div>
                    <div className="shrink-0 flex items-center gap-0.5">
                      {isFilled && <span className="text-[10px] text-success font-bold">✓</span>}
                      <ChevronRight
                        className={cn(
                          "size-3 transition-opacity",
                          isActive ? "opacity-50" : "opacity-0 group-hover:opacity-30"
                        )}
                      />
                    </div>
                  </button>
                );
              })}
            </nav>

            {/* ── Drag handle ──────────────────────────── */}
            <div
              onMouseDown={onNavDragStart}
              className="w-1 shrink-0 relative cursor-col-resize group"
              role="separator"
              aria-label="Przeciągnij aby zmienić szerokość menu"
              title="Przeciągnij aby zmienić szerokość menu"
            >
              <div className="absolute inset-y-0 -left-0.5 -right-0.5 group-hover:bg-brand/30 group-active:bg-brand/50 transition-colors" />
            </div>
          </>
        )}

        {/* ── Prawy panel ──────────────────────────────── */}
        <div
          className="flex-1 min-w-0 overflow-y-auto flex flex-col"
          style={{ minWidth: CONTENT_MIN }}
        >
          {/* Sticky nagłówek sekcji */}
          <div className="flex items-center gap-3 px-6 py-3.5 border-b border-border sticky top-0 bg-background/95 backdrop-blur-sm z-10 shrink-0">
            <div className={cn("size-7 rounded-md border flex items-center justify-center shrink-0", activeSection.iconBg)}>
              <activeSection.icon className={cn("size-3.5", activeSection.color)} />
            </div>
            <h2 className="font-semibold text-sm">{activeSection.label}</h2>
          </div>

          {/* Edytor */}
          <div key={activeKey} className="flex-1">
            {activeSection.editor === "list" ? (
              <ListItemsEditor
                initialContent={localStrategy[activeKey]}
                placeholder={activeSection.placeholder}
                emptyHint={activeSection.emptyHint}
                accent={activeSection.accent}
                onSave={(md) => handleSave(activeKey, md)}
                className="rounded-none border-0 h-full"
              />
            ) : (
              <TiptapEditor
                initialContent={localStrategy[activeKey] ?? ""}
                placeholder={activeSection.placeholder}
                onSave={(md) => handleSave(activeKey, md)}
                className="rounded-none border-0"
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
