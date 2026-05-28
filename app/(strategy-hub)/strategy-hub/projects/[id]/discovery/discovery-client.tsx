"use client";

import { useState } from "react";
import {
  HelpCircle,
  BookText,
  KeyRound,
  Paperclip,
  StickyNote,
  ListChecks,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  EntityCrud,
  type FieldDef,
} from "@/components/strategy-hub/entity-crud";

interface Props {
  projectId: string;
  projectName: string;
}

interface TabDef {
  key: string;
  entity: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  fields: FieldDef[];
  addLabel: string;
  emptyHint: string;
}

const TABS: TabDef[] = [
  {
    key: "questions",
    entity: "questions",
    label: "Pytania",
    icon: HelpCircle,
    addLabel: "Nowe pytanie",
    emptyHint: "Brak pytań do klienta — dodaj pierwsze.",
    fields: [
      { key: "question", label: "Pytanie", type: "textarea", primary: true, placeholder: "Co chcemy ustalić?" },
      { key: "answerMd", label: "Odpowiedź klienta", type: "textarea" },
      { key: "ourAnalysisMd", label: "Nasza analiza", type: "textarea" },
      { key: "category", label: "Kategoria", type: "text", placeholder: "np. biznes, technologia" },
      {
        key: "status",
        label: "Status",
        type: "select",
        badge: true,
        options: [
          { value: "open", label: "Otwarte", tone: "warning" },
          { value: "answered", label: "Odpowiedziane", tone: "success" },
          { value: "blocked", label: "Zablokowane", tone: "danger" },
        ],
      },
    ],
  },
  {
    key: "glossary",
    entity: "glossary",
    label: "Słownik",
    icon: BookText,
    addLabel: "Nowe pojęcie",
    emptyHint: "Brak pojęć — zbuduj wspólny język z klientem.",
    fields: [
      { key: "term", label: "Pojęcie", type: "text", primary: true, placeholder: "np. MQL" },
      { key: "definitionMd", label: "Definicja", type: "textarea" },
    ],
  },
  {
    key: "credentials",
    entity: "credentials",
    label: "Dostępy",
    icon: KeyRound,
    addLabel: "Nowy dostęp",
    emptyHint: "Brak zapisanych dostępów (sekrety są szyfrowane).",
    fields: [
      { key: "serviceName", label: "Usługa", type: "text", primary: true, placeholder: "np. Google Analytics" },
      { key: "url", label: "URL", type: "url" },
      { key: "login", label: "Login", type: "text" },
      { key: "secret", label: "Hasło / token (szyfrowane)", type: "text" },
      { key: "category", label: "Kategoria", type: "text" },
      { key: "notes", label: "Notatki", type: "textarea" },
    ],
  },
  {
    key: "materials",
    entity: "materials",
    label: "Materiały",
    icon: Paperclip,
    addLabel: "Nowy materiał",
    emptyHint: "Brak materiałów (brief, logo, dokumenty…).",
    fields: [
      { key: "title", label: "Tytuł", type: "text", primary: true },
      {
        key: "type",
        label: "Typ",
        type: "select",
        badge: true,
        options: [
          { value: "doc", label: "Dokument", tone: "info" },
          { value: "link", label: "Link", tone: "neutral" },
          { value: "file", label: "Plik", tone: "neutral" },
          { value: "video", label: "Wideo", tone: "warning" },
          { value: "other", label: "Inne", tone: "neutral" },
        ],
      },
      { key: "url", label: "URL", type: "url" },
      { key: "source", label: "Źródło", type: "text" },
      { key: "notesMd", label: "Notatki", type: "textarea" },
    ],
  },
  {
    key: "notes",
    entity: "notes",
    label: "Notatki",
    icon: StickyNote,
    addLabel: "Nowa notatka",
    emptyHint: "Brak notatek z rozmów / spotkań.",
    fields: [
      { key: "contentMd", label: "Treść", type: "textarea", primary: true },
      {
        key: "authorType",
        label: "Autor",
        type: "select",
        badge: true,
        options: [
          { value: "team", label: "Zespół", tone: "info" },
          { value: "client", label: "Klient", tone: "success" },
          { value: "ai", label: "AI", tone: "warning" },
        ],
      },
    ],
  },
  {
    key: "tasks",
    entity: "tasks",
    label: "Zadania",
    icon: ListChecks,
    addLabel: "Nowe zadanie",
    emptyHint: "Brak zadań w discovery.",
    fields: [
      { key: "title", label: "Zadanie", type: "text", primary: true },
      { key: "descriptionMd", label: "Opis", type: "textarea" },
      {
        key: "status",
        label: "Status",
        type: "select",
        badge: true,
        options: [
          { value: "todo", label: "Do zrobienia", tone: "neutral" },
          { value: "in_progress", label: "W toku", tone: "info" },
          { value: "done", label: "Gotowe", tone: "success" },
          { value: "blocked", label: "Zablokowane", tone: "danger" },
        ],
      },
      { key: "owner", label: "Właściciel", type: "text" },
      { key: "dueDate", label: "Termin", type: "date" },
      {
        key: "priority",
        label: "Priorytet",
        type: "select",
        options: [
          { value: "1", label: "Niski" },
          { value: "2", label: "Średni" },
          { value: "3", label: "Wysoki" },
        ],
      },
    ],
  },
];

export function DiscoveryClient({ projectId, projectName }: Props) {
  const [active, setActive] = useState(TABS[0].key);
  const tab = TABS.find((t) => t.key === active) ?? TABS[0];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <header>
        <p className="text-xs font-medium text-muted-foreground">{projectName}</p>
        <h1 className="text-xl font-semibold tracking-tight">Discovery</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Pytania, słownik, dostępy, materiały, notatki i zadania zebrane na
          starcie projektu.
        </p>
      </header>

      <nav
        className="flex flex-wrap gap-1 border-b border-border pb-px"
        aria-label="Sekcje discovery"
      >
        {TABS.map((t) => {
          const isActive = t.key === active;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setActive(t.key)}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-t-md px-3 py-2 text-sm transition-colors -mb-px border-b-2",
                isActive
                  ? "border-brand text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              <t.icon className="size-4" />
              {t.label}
            </button>
          );
        })}
      </nav>

      <EntityCrud
        key={tab.key}
        projectId={projectId}
        entity={tab.entity}
        fields={tab.fields}
        addLabel={tab.addLabel}
        emptyHint={tab.emptyHint}
      />
    </div>
  );
}
