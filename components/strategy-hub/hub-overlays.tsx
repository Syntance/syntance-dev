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
import { CompareView } from "@/components/strategy-hub/compare-view";

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
  openSidekick: () => void;
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
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const project = useProject();
  const projectIdFromPath = useProjectIdFromPath();
  const projectId = project?.id ?? projectIdFromPath;
  const projectName = project?.name ?? "Projekt";

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
        <div className="h-full flex flex-col">
          {projectId ? (
            <ChatPanel projectId={projectId} projectName={projectName} />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center gap-2 p-8 text-center">
              <Sparkles className="size-6 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">
                Otwórz projekt, aby skorzystać z asystenta AI.
              </p>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function HubOverlays({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const projectIdFromPath = useProjectIdFromPath();
  const [paletteOpen, setPaletteOpen] = React.useState(false);
  const [sidekickOpen, setSidekickOpen] = React.useState(false);
  const [compareOpen, setCompareOpen] = React.useState(false);

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
      }),
      [projectIdFromPath, router]
    )
  );

  const api = React.useMemo<OverlayApi>(
    () => ({
      openPalette: () => setPaletteOpen(true),
      openSidekick: () => setSidekickOpen(true),
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
      <AiSidekick open={sidekickOpen} onOpenChange={setSidekickOpen} />
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
