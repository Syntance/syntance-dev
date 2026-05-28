"use client";

import { useState, useTransition, useRef, useCallback, useEffect } from "react";
import dynamic from "next/dynamic";
import { ListItemsEditor } from "@/components/strategy-hub/list-items-editor";
import {
  EntityCalloutList,
  type CalloutItem,
} from "@/components/strategy-hub/entity-callout-list";
import {
  listItemsPreview,
  parseStrategyListItems,
  type StrategyListWeight,
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

interface ProblemRow {
  id: string;
  problemMd: string;
  ambitionMd: string | null;
  ourSolutionMd: string | null;
  priority: number;
  orderIdx: number | null;
}

interface ObjectionRow {
  id: string;
  objectionMd: string;
  responseMd: string | null;
  proofMd: string | null;
  priority: number;
  orderIdx: number | null;
  stage: string | null;
  status: string | null;
}

interface Props {
  projectId: string;
  projectName: string;
  strategy: Strategy;
  problems: ProblemRow[];
  objections: ObjectionRow[];
}

/** UI section identifiers — niezależne od nazw kolumn DB. */
type SectionKey = "problems" | "uvpMd" | "competitorsMd" | "objections";

type SectionConfig = {
  key: SectionKey;
  label: string;
  icon: typeof Target;
  color: string;
  iconBg: string;
  activeBar: string;
  editor: "list" | "markdown" | "entity-callouts";
  /** Klucz w `strategy` dla edytorów markdown/list — opcjonalny dla entity-callouts. */
  legacyKey?: keyof Strategy;
  placeholder: string;
  emptyHint?: string;
  accent?: "violet" | "amber" | "rose";
};

const SECTIONS: SectionConfig[] = [
  {
    key: "problems",
    label: "Cele biznesowe",
    icon: Target,
    color: "text-violet-400",
    iconBg: "bg-violet-500/10 border-violet-500/20",
    activeBar: "bg-violet-500",
    editor: "entity-callouts",
    accent: "violet",
    placeholder: "np. zwiększyć sprzedaż online o 30% w 12 miesiącach",
    emptyHint: "Dodaj cele jako elementy — każdy z wagą.",
  },
  {
    key: "uvpMd",
    label: "UVP",
    icon: Sparkles,
    color: "text-amber-400",
    iconBg: "bg-amber-500/10 border-amber-500/20",
    activeBar: "bg-amber-500",
    editor: "list",
    legacyKey: "uvpMd",
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
    legacyKey: "competitorsMd",
    placeholder:
      "Kto jest konkurencją? Jakie mają mocne i słabe strony? Co możemy zrobić lepiej?",
  },
  {
    key: "objections",
    label: "Obiekcje klientów",
    icon: MessageSquare,
    color: "text-rose-400",
    iconBg: "bg-rose-500/10 border-rose-500/20",
    activeBar: "bg-rose-500",
    editor: "entity-callouts",
    accent: "rose",
    placeholder: "np. za drogo w porównaniu do konkurencji",
    emptyHint: "Dodaj obiekcje — każda z wagą.",
  },
];

const NAV_MIN = 160;
const NAV_MAX = 400;
const NAV_DEFAULT = 224;
const CONTENT_MIN = 320;

function clampWeight(p: number): StrategyListWeight {
  if (p <= 1) return 1;
  if (p >= 3) return 3;
  return 2;
}

function problemToCallout(p: ProblemRow): CalloutItem {
  return {
    id: p.id,
    text: p.problemMd,
    note: p.ambitionMd ?? "",
    weight: clampWeight(p.priority),
  };
}

function objectionToCallout(o: ObjectionRow): CalloutItem {
  return {
    id: o.id,
    text: o.objectionMd,
    note: o.responseMd ?? "",
    weight: clampWeight(o.priority),
  };
}

interface SectionState {
  problems: CalloutItem[];
  objections: CalloutItem[];
}

function sectionIsFilled(
  section: SectionConfig,
  strategy: Strategy,
  state: SectionState
): boolean {
  if (section.editor === "entity-callouts") {
    return section.key === "problems"
      ? state.problems.length > 0
      : state.objections.length > 0;
  }
  const content = section.legacyKey ? strategy[section.legacyKey] : null;
  if (section.editor === "list") return parseStrategyListItems(content).length > 0;
  return (content?.length ?? 0) > 0;
}

function sectionPreview(
  section: SectionConfig,
  strategy: Strategy,
  state: SectionState
): string {
  if (section.editor === "entity-callouts") {
    const items = section.key === "problems" ? state.problems : state.objections;
    return items[0]?.text.slice(0, 55) ?? "";
  }
  const content = section.legacyKey ? strategy[section.legacyKey] : null;
  if (section.editor === "list") return listItemsPreview(content, 1);
  if (!content) return "";
  const stripped = content.replace(/#+\s/g, "").trim();
  return stripped.length > 55 ? `${stripped.substring(0, 55)}…` : stripped;
}

export function BusinessStrategyEditor({
  projectId,
  projectName,
  strategy,
  problems,
  objections,
}: Props) {
  const [localStrategy, setLocalStrategy] = useState(strategy);
  const [problemItems, setProblemItems] = useState<CalloutItem[]>(
    problems.map(problemToCallout)
  );
  const [objectionItems, setObjectionItems] = useState<CalloutItem[]>(
    objections.map(objectionToCallout)
  );
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

  // ── DB-backed CRUD: problems ─────────────────────────────────────
  const problemsApi = `/api/strategy-hub/projects/${projectId}/problems`;

  const addProblem = useCallback(
    async (text: string): Promise<CalloutItem> => {
      const res = await fetch(problemsApi, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ problemMd: text, priority: 2 }),
      });
      if (!res.ok) throw new Error("Failed to create problem");
      const { item } = (await res.json()) as { item: ProblemRow };
      const callout = problemToCallout(item);
      setProblemItems((prev) => [...prev, callout]);
      return callout;
    },
    [problemsApi]
  );

  const updateProblem = useCallback(
    async (
      id: string,
      patch: Partial<Pick<CalloutItem, "text" | "note" | "weight">>
    ) => {
      const dbPatch: Record<string, unknown> = {};
      if (patch.text !== undefined) dbPatch.problemMd = patch.text;
      if (patch.note !== undefined) dbPatch.ambitionMd = patch.note || null;
      if (patch.weight !== undefined) dbPatch.priority = patch.weight;

      setProblemItems((prev) =>
        prev.map((p) => (p.id === id ? { ...p, ...patch } : p))
      );
      const res = await fetch(`${problemsApi}/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dbPatch),
      });
      if (!res.ok) throw new Error("Failed to update problem");
    },
    [problemsApi]
  );

  const removeProblem = useCallback(
    async (id: string) => {
      setProblemItems((prev) => prev.filter((p) => p.id !== id));
      const res = await fetch(`${problemsApi}/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete problem");
    },
    [problemsApi]
  );

  // ── DB-backed CRUD: objections ────────────────────────────────────
  const objectionsApi = `/api/strategy-hub/projects/${projectId}/objections`;

  const addObjection = useCallback(
    async (text: string): Promise<CalloutItem> => {
      const res = await fetch(objectionsApi, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ objectionMd: text, priority: 2 }),
      });
      if (!res.ok) throw new Error("Failed to create objection");
      const { item } = (await res.json()) as { item: ObjectionRow };
      const callout = objectionToCallout(item);
      setObjectionItems((prev) => [...prev, callout]);
      return callout;
    },
    [objectionsApi]
  );

  const updateObjection = useCallback(
    async (
      id: string,
      patch: Partial<Pick<CalloutItem, "text" | "note" | "weight">>
    ) => {
      const dbPatch: Record<string, unknown> = {};
      if (patch.text !== undefined) dbPatch.objectionMd = patch.text;
      if (patch.note !== undefined) dbPatch.responseMd = patch.note || null;
      if (patch.weight !== undefined) dbPatch.priority = patch.weight;

      setObjectionItems((prev) =>
        prev.map((o) => (o.id === id ? { ...o, ...patch } : o))
      );
      const res = await fetch(`${objectionsApi}/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dbPatch),
      });
      if (!res.ok) throw new Error("Failed to update objection");
    },
    [objectionsApi]
  );

  const removeObjection = useCallback(
    async (id: string) => {
      setObjectionItems((prev) => prev.filter((o) => o.id !== id));
      const res = await fetch(`${objectionsApi}/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete objection");
    },
    [objectionsApi]
  );

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

  const sectionState: SectionState = {
    problems: problemItems,
    objections: objectionItems,
  };
  const filledCount = SECTIONS.filter((s) =>
    sectionIsFilled(s, localStrategy, sectionState)
  ).length;

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
                const isFilled = sectionIsFilled(section, localStrategy, sectionState);
                const preview = sectionPreview(section, localStrategy, sectionState);
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
            {activeSection.editor === "entity-callouts" ? (
              activeKey === "problems" ? (
                <EntityCalloutList
                  items={problemItems}
                  onAdd={addProblem}
                  onUpdate={updateProblem}
                  onRemove={removeProblem}
                  placeholder={activeSection.placeholder}
                  emptyHint={activeSection.emptyHint}
                />
              ) : (
                <EntityCalloutList
                  items={objectionItems}
                  onAdd={addObjection}
                  onUpdate={updateObjection}
                  onRemove={removeObjection}
                  placeholder={activeSection.placeholder}
                  emptyHint={activeSection.emptyHint}
                />
              )
            ) : activeSection.editor === "list" && activeSection.legacyKey ? (
              <ListItemsEditor
                initialContent={localStrategy[activeSection.legacyKey]}
                placeholder={activeSection.placeholder}
                emptyHint={activeSection.emptyHint}
                accent={activeSection.accent}
                onSave={(md) =>
                  activeSection.legacyKey
                    ? handleSave(activeSection.legacyKey, md)
                    : Promise.resolve()
                }
                className="rounded-none border-0 h-full"
              />
            ) : activeSection.editor === "markdown" && activeSection.legacyKey ? (
              <TiptapEditor
                initialContent={localStrategy[activeSection.legacyKey] ?? ""}
                placeholder={activeSection.placeholder}
                onSave={(md) =>
                  activeSection.legacyKey
                    ? handleSave(activeSection.legacyKey, md)
                    : Promise.resolve()
                }
                className="rounded-none border-0"
              />
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
