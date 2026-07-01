"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import {
  Compass,
  Gem,
  FileText,
  Users,
  Filter,
  Megaphone,
  BarChart3,
  Globe,
  Gauge,
  Server,
  MessageSquareText,
  LayoutGrid,
  Settings,
  RefreshCw,
  Sparkles,
  LayoutDashboard,
  Clock,
  Stethoscope,
  MessageSquare,
  Network,
  FileDown,
  FileType,
  type LucideIcon,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useProject,
  useProjectIdFromPath,
} from "@/components/strategy-hub/project-context";
import { useHubHotkeys } from "@/components/strategy-hub/use-hotkeys";
import { useUndoRedo } from "@/components/strategy-hub/undo-redo";
import { CompareView } from "@/components/strategy-hub/compare-view";
import {
  ContextualSuggestions,
  StrategyAnalyses,
} from "@/components/strategy-hub/ai-contextual-suggestions";
import { cn } from "@/lib/utils";

const ChatPanel = dynamic(
  () =>
    import("@/components/strategy-hub/chat/chat-panel").then((m) => ({
      default: m.ChatPanel,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="flex flex-col h-full p-4 gap-3">
        <Skeleton className="h-4 w-32" />
        <div className="flex-1" />
        <Skeleton className="h-11 w-full rounded-lg" />
      </div>
    ),
  }
);

interface OverlayApi {
  openPalette: () => void;
  /** Otwiera AI Sidekick; opcjonalny `prompt` zostaje wysłany do czatu. */
  openSidekick: (prompt?: string) => void;
}

const OverlayContext = React.createContext<OverlayApi | null>(null);

export function useHubOverlays(): OverlayApi {
  const ctx = React.useContext(OverlayContext);
  if (!ctx)
    return {
      openPalette: () => {},
      openSidekick: () => {},
    };
  return ctx;
}

interface ModuleLink {
  label: string;
  segment: string;
  icon: LucideIcon;
}

const MODULES: ModuleLink[] = [
  { label: "Strategy Canvas", segment: "canvas", icon: LayoutDashboard },
  { label: "Discovery", segment: "discovery", icon: Compass },
  { label: "Marka", segment: "brand", icon: Gem },
  { label: "Strategia biznesowa", segment: "business", icon: FileText },
  { label: "Segmenty", segment: "segments", icon: Users },
  { label: "Lejek i kanały", segment: "funnel", icon: Filter },
  { label: "Sprzedaż i copy", segment: "sales", icon: Megaphone },
  { label: "Strategia marketingowa", segment: "marketing", icon: BarChart3 },
  { label: "Strona", segment: "website", icon: Globe },
  { label: "KPI", segment: "kpi", icon: Gauge },
  { label: "Infrastruktura", segment: "admin", icon: Server },
  { label: "AI Chat", segment: "chat", icon: MessageSquareText },
];

interface ProjectRow {
  id: string;
  name: string;
  icon: string | null;
  slug: string;
}

function CommandPalette({
  open,
  onOpenChange,
  onOpenSidekick,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onOpenSidekick: () => void;
}) {
  const router = useRouter();
  const project = useProject();
  const projectIdFromPath = useProjectIdFromPath();
  const projectId = project?.id ?? projectIdFromPath;

  const [projects, setProjects] = React.useState<ProjectRow[]>([]);

  React.useEffect(() => {
    if (!open) return;
    const ctrl = new AbortController();
    fetch("/api/strategy-hub/projects", { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { projects?: ProjectRow[] } | null) =>
        setProjects(d?.projects ?? [])
      )
      .catch(() => {});
    return () => ctrl.abort();
  }, [open]);

  const go = (href: string) => {
    onOpenChange(false);
    router.push(href);
  };

  const quickExport = async (type: "docx" | "md" | "pdf_full") => {
    if (!projectId) return;
    onOpenChange(false);
    try {
      const res = await fetch(`/api/strategy-hub/projects/${projectId}/exports`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type }),
      });
      if (!res.ok) return;
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
    } catch {
      // best-effort — pełny panel z historią jest na /measurement/exports
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="max-w-xl p-0 overflow-hidden gap-0 top-[15%] translate-y-0"
      >
        <DialogTitle className="sr-only">Paleta komend</DialogTitle>
        <DialogDescription className="sr-only">
          Szybka nawigacja i akcje w Strategy Hub
        </DialogDescription>
        <Command loop>
          <CommandInput placeholder="Szukaj modułów, projektów, akcji…" />
          <CommandList>
            <CommandEmpty>Brak wyników.</CommandEmpty>

            {projectId && (
              <CommandGroup heading="Moduły projektu">
                {MODULES.map((m) => (
                  <CommandItem
                    key={m.segment}
                    value={`modul ${m.label}`}
                    onSelect={() =>
                      go(`/strategy-hub/projects/${projectId}/${m.segment}`)
                    }
                  >
                    <m.icon />
                    <span>{m.label}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {projectId && (
              <>
                <CommandSeparator />
                <CommandGroup heading="Akcje">
                  <CommandItem
                    value="ai sidekick asystent czat"
                    onSelect={() => {
                      onOpenChange(false);
                      onOpenSidekick();
                    }}
                  >
                    <Sparkles />
                    <span>Otwórz AI Sidekick</span>
                    <kbd className="ml-auto text-[10px] text-muted-foreground">
                      ⌘J
                    </kbd>
                  </CommandItem>
                  <CommandItem
                    value="graf relacji projektu network"
                    onSelect={() => go(`/strategy-hub/projects/${projectId}/relations`)}
                  >
                    <Network />
                    <span>Graf relacji projektu</span>
                  </CommandItem>
                  <CommandItem
                    value="eksportuj strategie pdf"
                    onSelect={() => void quickExport("pdf_full")}
                  >
                    <FileType />
                    <span>Eksportuj strategię jako PDF</span>
                  </CommandItem>
                  <CommandItem
                    value="eksportuj strategie docx word"
                    onSelect={() => void quickExport("docx")}
                  >
                    <FileType />
                    <span>Eksportuj strategię jako DOCX</span>
                  </CommandItem>
                  <CommandItem
                    value="eksportuj strategie markdown md"
                    onSelect={() => void quickExport("md")}
                  >
                    <FileDown />
                    <span>Eksportuj strategię jako Markdown</span>
                  </CommandItem>
                </CommandGroup>
              </>
            )}

            <CommandSeparator />
            <CommandGroup heading="Custom Apps">
              <CommandItem
                value="liczenie godzin time tracking"
                onSelect={() => go("/strategy-hub/apps/time-tracking")}
              >
                <Clock />
                <span>Liczenie godzin</span>
              </CommandItem>
            </CommandGroup>

            <CommandSeparator />
            <CommandGroup heading="Przejdź do">
              <CommandItem
                value="projekty lista"
                onSelect={() => go("/strategy-hub")}
              >
                <LayoutGrid />
                <span>Wszystkie projekty</span>
              </CommandItem>
              <CommandItem
                value="sync notion"
                onSelect={() => go("/strategy-hub/sync")}
              >
                <RefreshCw />
                <span>Sync z Notion</span>
              </CommandItem>
              <CommandItem
                value="ustawienia"
                onSelect={() => go("/strategy-hub/settings")}
              >
                <Settings />
                <span>Ustawienia</span>
                <kbd className="ml-auto text-[10px] text-muted-foreground">⌘,</kbd>
              </CommandItem>
            </CommandGroup>

            {projects.length > 0 && (
              <>
                <CommandSeparator />
                <CommandGroup heading="Projekty">
                  {projects.map((p) => (
                    <CommandItem
                      key={p.id}
                      value={`projekt ${p.name}`}
                      onSelect={() => go(`/strategy-hub/projects/${p.id}`)}
                    >
                      <span className="text-base leading-none">
                        {p.icon ?? "🏢"}
                      </span>
                      <span>{p.name}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
}

function AiSidekick({
  open,
  onOpenChange,
  externalSeed,
  forceTab,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  externalSeed?: { text: string; nonce: number };
  forceTab?: { tab: "suggestions" | "chat" | "analyses"; nonce: number };
}) {
  const project = useProject();
  const projectIdFromPath = useProjectIdFromPath();
  const projectId = project?.id ?? projectIdFromPath;
  const projectName = project?.name ?? "Projekt";

  const [tab, setTab] = React.useState<"suggestions" | "chat" | "analyses">(
    "suggestions"
  );
  const [seed, setSeed] = React.useState<{
    text: string;
    send: boolean;
    nonce: number;
  }>({ text: "", send: false, nonce: 0 });

  const runPrompt = React.useCallback((prompt: string) => {
    setSeed((prev) => ({ text: prompt, send: true, nonce: prev.nonce + 1 }));
    setTab("chat");
  }, []);

  // Prompt przekazany z zewnątrz (np. przycisk „Zaproponuj dowód").
  const lastExternalNonce = React.useRef(0);
  React.useEffect(() => {
    if (!externalSeed || externalSeed.nonce === 0) return;
    if (externalSeed.nonce === lastExternalNonce.current) return;
    lastExternalNonce.current = externalSeed.nonce;
    runPrompt(externalSeed.text);
  }, [externalSeed, runPrompt]);

  // Wymuszona zakładka (np. ⌘/ → zawsze "Sugestie", w odróżnieniu od ⌘J).
  const lastForceTabNonce = React.useRef(0);
  React.useEffect(() => {
    if (!forceTab || forceTab.nonce === 0) return;
    if (forceTab.nonce === lastForceTabNonce.current) return;
    lastForceTabNonce.current = forceTab.nonce;
    setTab(forceTab.tab);
  }, [forceTab]);

  const TABS: { id: typeof tab; label: string; icon: LucideIcon }[] = [
    { id: "suggestions", label: "Sugestie", icon: Sparkles },
    { id: "chat", label: "Chat", icon: MessageSquare },
    { id: "analyses", label: "Analizy", icon: Stethoscope },
  ];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-md p-0 gap-0"
        showCloseButton
      >
        <SheetHeader className="sr-only">
          <SheetTitle>AI Sidekick</SheetTitle>
          <SheetDescription>Asystent AI projektu</SheetDescription>
        </SheetHeader>
        {projectId ? (
          <div className="flex h-full flex-col">
            {/* Pasek zakładek */}
            <div className="flex shrink-0 items-center gap-1 border-b border-border/60 px-2 py-1.5">
              {TABS.map((t) => {
                const Icon = t.icon;
                const active = tab === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTab(t.id)}
                    className={cn(
                      "flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition-colors",
                      active
                        ? "bg-brand/10 text-brand"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                    aria-pressed={active}
                  >
                    <Icon className="size-3.5" />
                    {t.label}
                  </button>
                );
              })}
            </div>

            {/* Treść zakładek — ChatPanel zawsze zamontowany (trzyma stan rozmowy) */}
            <div className="relative min-h-0 flex-1">
              <div
                className={cn(
                  "absolute inset-0 overflow-y-auto",
                  tab === "suggestions" ? "block" : "hidden"
                )}
              >
                <ContextualSuggestions onRun={runPrompt} />
              </div>
              <div
                className={cn(
                  "absolute inset-0 overflow-y-auto",
                  tab === "analyses" ? "block" : "hidden"
                )}
              >
                <StrategyAnalyses onRun={runPrompt} />
              </div>
              <div
                className={cn(
                  "absolute inset-0",
                  tab === "chat" ? "block" : "hidden"
                )}
              >
                <ChatPanel
                  projectId={projectId}
                  projectName={projectName}
                  seed={seed}
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 p-8 text-center">
            <Sparkles className="size-6 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">
              Otwórz projekt, aby skorzystać z asystenta AI.
            </p>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

export function HubOverlays({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const projectIdFromPath = useProjectIdFromPath();
  const undoRedo = useUndoRedo();
  const [paletteOpen, setPaletteOpen] = React.useState(false);
  const [sidekickOpen, setSidekickOpen] = React.useState(false);
  const [compareOpen, setCompareOpen] = React.useState(false);
  const [sidekickSeed, setSidekickSeed] = React.useState<{
    text: string;
    nonce: number;
  }>({ text: "", nonce: 0 });
  const [sidekickForceTab, setSidekickForceTab] = React.useState<{
    tab: "suggestions" | "chat" | "analyses";
    nonce: number;
  }>({ tab: "suggestions", nonce: 0 });

  const goModule = React.useCallback(
    (segment: string) => {
      if (!projectIdFromPath) return;
      router.push(`/strategy-hub/projects/${projectIdFromPath}/${segment}`);
    },
    [projectIdFromPath, router]
  );

  useHubHotkeys(
    React.useMemo(
      () => ({
        onPalette: () => setPaletteOpen((v) => !v),
        onSidekick: () => setSidekickOpen((v) => !v),
        onReview: () => {
          if (projectIdFromPath) {
            router.push(
              `/strategy-hub/projects/${projectIdFromPath}/measurement/review`
            );
          }
        },
        onCompare: () => setCompareOpen((v) => !v),
        onSettings: () => router.push("/strategy-hub/settings"),
        onQuickAi: () => {
          setSidekickForceTab((s) => ({ tab: "suggestions", nonce: s.nonce + 1 }));
          setSidekickOpen(true);
        },
        onUndo: () => undoRedo.undo(),
        onRedo: () => undoRedo.redo(),
        onGoSegments: () => goModule("segments"),
        onGoLejek: () => goModule("funnel"),
        onGoWebsite: () => goModule("website"),
        onGoChannels: () => goModule("funnel"),
      }),
      [projectIdFromPath, router, undoRedo, goModule]
    )
  );

  const api = React.useMemo<OverlayApi>(
    () => ({
      openPalette: () => setPaletteOpen(true),
      openSidekick: (prompt?: string) => {
        if (prompt) {
          setSidekickSeed((s) => ({ text: prompt, nonce: s.nonce + 1 }));
        }
        setSidekickOpen(true);
      },
    }),
    []
  );

  return (
    <OverlayContext.Provider value={api}>
      {children}
      <CommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        onOpenSidekick={() => setSidekickOpen(true)}
      />
      <AiSidekick
        open={sidekickOpen}
        onOpenChange={setSidekickOpen}
        externalSeed={sidekickSeed}
        forceTab={sidekickForceTab}
      />
      <CompareView
        open={compareOpen}
        onClose={() => setCompareOpen(false)}
        leftLabel="Stan bieżący"
        rightLabel="Wersja referencyjna"
        left={
          <p className="text-sm text-muted-foreground">
            Wybierz encję w module (segment, KPI, decyzja), aby porównać wersje z timeline.
          </p>
        }
        right={
          <p className="text-sm text-muted-foreground">
            Druga kolumna — snapshot z changeHistory (przywracanie w VersionTimeline).
          </p>
        }
      />
    </OverlayContext.Provider>
  );
}
