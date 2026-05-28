"use client";

import { useEffect, useState } from "react";
import { Megaphone, MessageSquareText, Magnet, PencilRuler } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  EntityCrud,
  type FieldDef,
} from "@/components/strategy-hub/entity-crud";
import {
  useSingleton,
  AutosaveField,
  SectionCard,
} from "@/components/strategy-hub/entity-singleton";
import {
  JsonListEditor,
  type JsonColumn,
} from "@/components/strategy-hub/json-list-editor";

interface Props {
  projectId: string;
  projectName: string;
}

type TabKey = "pitches" | "scripts" | "lead-magnets" | "copy-guidelines";

const STATUS_OPTIONS: FieldDef["options"] = [
  { value: "draft", label: "Szkic", tone: "neutral" },
  { value: "review", label: "Do przeglądu", tone: "warning" },
  { value: "approved", label: "Zatwierdzone", tone: "success" },
  { value: "archived", label: "Archiwum", tone: "neutral" },
];

const LEAD_STATUS_OPTIONS: FieldDef["options"] = [
  { value: "draft", label: "Szkic", tone: "neutral" },
  { value: "live", label: "Aktywny", tone: "success" },
  { value: "paused", label: "Wstrzymany", tone: "warning" },
  { value: "archived", label: "Archiwum", tone: "neutral" },
];

const templateCols: JsonColumn[] = [
  { key: "name", label: "Nazwa", placeholder: "np. Post LinkedIn" },
  { key: "body", label: "Szablon", placeholder: "Treść z placeholderami…" },
];
const hashtagCols: JsonColumn[] = [
  { key: "tag", label: "Hashtag", placeholder: "#syntance" },
  { key: "context", label: "Kontekst", placeholder: "np. brandowy / kampania" },
];
const exampleCols: JsonColumn[] = [
  { key: "label", label: "Etykieta", placeholder: "np. Dobry nagłówek" },
  { key: "body", label: "Przykład", placeholder: "Treść przykładu…" },
];

function asArray(v: unknown): Record<string, unknown>[] {
  return Array.isArray(v) ? (v as Record<string, unknown>[]) : [];
}

const TABS: { key: TabKey; label: string; icon: typeof Megaphone }[] = [
  { key: "pitches", label: "Pitche", icon: Megaphone },
  { key: "scripts", label: "Skrypty", icon: MessageSquareText },
  { key: "lead-magnets", label: "Lead magnety", icon: Magnet },
  { key: "copy-guidelines", label: "Wytyczne copy", icon: PencilRuler },
];

export function SalesClient({ projectId, projectName }: Props) {
  const [tab, setTab] = useState<TabKey>("pitches");
  const [segments, setSegments] = useState<{ value: string; label: string }[]>(
    []
  );
  const guidelines = useSingleton(projectId, "copy-guidelines");

  useEffect(() => {
    const ctrl = new AbortController();
    fetch(`/api/strategy-hub/projects/${projectId}/segments`, {
      signal: ctrl.signal,
    })
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((data) => {
        const items: { id: string; name: string }[] = data.items ?? [];
        setSegments(items.map((s) => ({ value: s.id, label: s.name })));
      })
      .catch(() => {});
    return () => ctrl.abort();
  }, [projectId]);

  const pitchFields: FieldDef[] = [
    { key: "title", label: "Tytuł", type: "text", primary: true },
    {
      key: "segmentId",
      label: "Segment",
      type: "relation",
      options: segments,
      placeholder: "Bez segmentu",
    },
    {
      key: "context",
      label: "Kontekst",
      type: "text",
      placeholder: "np. cold outreach, demo",
    },
    { key: "pitchMd", label: "Treść pitcha", type: "textarea" },
    { key: "version", label: "Wersja", type: "number" },
    { key: "status", label: "Status", type: "select", badge: true, options: STATUS_OPTIONS },
  ];

  const scriptFields: FieldDef[] = [
    { key: "name", label: "Nazwa", type: "text", primary: true },
    {
      key: "context",
      label: "Kontekst",
      type: "text",
      placeholder: "np. rozmowa telefoniczna, follow-up",
    },
    { key: "scriptMd", label: "Skrypt", type: "textarea" },
    { key: "version", label: "Wersja", type: "number" },
    { key: "status", label: "Status", type: "select", badge: true, options: STATUS_OPTIONS },
  ];

  const leadMagnetFields: FieldDef[] = [
    { key: "name", label: "Nazwa", type: "text", primary: true },
    {
      key: "segmentId",
      label: "Segment",
      type: "relation",
      options: segments,
      placeholder: "Bez segmentu",
    },
    {
      key: "format",
      label: "Format",
      type: "text",
      placeholder: "np. e-book, checklista, webinar",
    },
    { key: "descriptionMd", label: "Opis", type: "textarea" },
    { key: "url", label: "URL", type: "url" },
    {
      key: "conversionTarget",
      label: "Cel konwersji",
      type: "text",
      placeholder: "np. zapis na newsletter",
    },
    { key: "status", label: "Status", type: "select", badge: true, options: LEAD_STATUS_OPTIONS },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <header>
        <p className="text-xs font-medium text-muted-foreground">{projectName}</p>
        <h1 className="text-xl font-semibold tracking-tight">Sprzedaż i copy</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Pitche sprzedażowe, skrypty rozmów, lead magnety i wspólne wytyczne
          dla copy.
        </p>
      </header>

      <nav
        className="flex flex-wrap gap-1 border-b border-border pb-px"
        aria-label="Sekcje sprzedaży"
      >
        {TABS.map((t) => {
          const isActive = t.key === tab;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
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

      {tab === "pitches" && (
        <EntityCrud
          projectId={projectId}
          entity="sales-pitches"
          fields={pitchFields}
          addLabel="Nowy pitch"
          emptyHint="Brak pitchy — dodaj pierwszy wariant."
          defaults={{ status: "draft", version: 1 }}
        />
      )}

      {tab === "scripts" && (
        <EntityCrud
          projectId={projectId}
          entity="sales-scripts"
          fields={scriptFields}
          addLabel="Nowy skrypt"
          emptyHint="Brak skryptów rozmów."
          defaults={{ status: "draft", version: 1 }}
        />
      )}

      {tab === "lead-magnets" && (
        <EntityCrud
          projectId={projectId}
          entity="lead-magnets"
          fields={leadMagnetFields}
          addLabel="Nowy lead magnet"
          emptyHint="Brak lead magnetów."
          defaults={{ status: "draft" }}
        />
      )}

      {tab === "copy-guidelines" && (
        <div className="space-y-5">
          <SectionCard
            title="Zasady"
            description="Fundament tonu i stylu komunikacji."
            status={guidelines.status}
          >
            <AutosaveField
              label="Zasady ogólne"
              hint="Jak piszemy"
              value={guidelines.data.principlesMd}
              onCommit={(v) => guidelines.patch({ principlesMd: v })}
              multiline
            />
            <AutosaveField
              label="Rób ✓"
              value={guidelines.data.doMd}
              onCommit={(v) => guidelines.patch({ doMd: v })}
              multiline
            />
            <AutosaveField
              label="Nie rób ✗"
              value={guidelines.data.dontMd}
              onCommit={(v) => guidelines.patch({ dontMd: v })}
              multiline
            />
          </SectionCard>

          <SectionCard
            title="Szablony"
            description="Gotowe wzorce treści do ponownego użycia."
            status={guidelines.status}
          >
            <JsonListEditor
              value={asArray(guidelines.data.templates)}
              columns={templateCols}
              onChange={(next) => guidelines.patch({ templates: next })}
              addLabel="Dodaj szablon"
              emptyHint="Brak szablonów."
            />
          </SectionCard>

          <SectionCard title="Hashtagi" status={guidelines.status}>
            <JsonListEditor
              value={asArray(guidelines.data.hashtags)}
              columns={hashtagCols}
              onChange={(next) => guidelines.patch({ hashtags: next })}
              addLabel="Dodaj hashtag"
              emptyHint="Brak hashtagów."
            />
          </SectionCard>

          <SectionCard title="Przykłady" status={guidelines.status}>
            <JsonListEditor
              value={asArray(guidelines.data.examples)}
              columns={exampleCols}
              onChange={(next) => guidelines.patch({ examples: next })}
              addLabel="Dodaj przykład"
              emptyHint="Brak przykładów."
            />
          </SectionCard>
        </div>
      )}
    </div>
  );
}
