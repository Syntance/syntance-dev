"use client";

import { useState } from "react";
import { Fingerprint, Palette } from "lucide-react";
import { cn } from "@/lib/utils";
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

const colorCols: JsonColumn[] = [
  { key: "value", label: "Kolor", type: "color" },
  { key: "name", label: "Nazwa", placeholder: "np. Brand Primary" },
  { key: "role", label: "Rola", placeholder: "np. akcent / tło" },
];
const typeCols: JsonColumn[] = [
  { key: "role", label: "Rola", placeholder: "np. Display" },
  { key: "family", label: "Krój", placeholder: "np. Clash Display" },
  { key: "weights", label: "Wagi", placeholder: "400, 600" },
  { key: "url", label: "URL" },
];
const logoCols: JsonColumn[] = [
  { key: "label", label: "Etykieta", placeholder: "np. Logo główne" },
  { key: "url", label: "URL" },
  { key: "kind", label: "Typ", placeholder: "svg / png" },
];

function asArray(v: unknown): Record<string, unknown>[] {
  return Array.isArray(v) ? (v as Record<string, unknown>[]) : [];
}

export function BrandEditor({ projectId, projectName }: Props) {
  const [tab, setTab] = useState<"identity" | "visual">("identity");
  const identity = useSingleton(projectId, "brand-identity");
  const visual = useSingleton(projectId, "brand-visual");

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <header>
        <p className="text-xs font-medium text-muted-foreground">{projectName}</p>
        <h1 className="text-xl font-semibold tracking-tight">Marka</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Tożsamość marki (misja, wizja, ton) oraz identyfikacja wizualna
          (kolory, typografia, loga).
        </p>
      </header>

      <nav
        className="flex gap-1 border-b border-border"
        aria-label="Sekcje marki"
      >
        {[
          { key: "identity" as const, label: "Tożsamość", icon: Fingerprint },
          { key: "visual" as const, label: "Identyfikacja wizualna", icon: Palette },
        ].map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            aria-current={tab === t.key ? "page" : undefined}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-t-md px-3 py-2 text-sm transition-colors -mb-px border-b-2",
              tab === t.key
                ? "border-brand text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <t.icon className="size-4" />
            {t.label}
          </button>
        ))}
      </nav>

      {tab === "identity" ? (
        <SectionCard
          title="Tożsamość marki"
          description="Fundament strategiczny marki."
          status={identity.status}
        >
          <AutosaveField
            label="Misja"
            hint="Po co istniejemy"
            value={identity.data.missionMd}
            onCommit={(v) => identity.patch({ missionMd: v })}
            multiline
          />
          <AutosaveField
            label="Wizja"
            hint="Dokąd zmierzamy"
            value={identity.data.visionMd}
            onCommit={(v) => identity.patch({ visionMd: v })}
            multiline
          />
          <AutosaveField
            label="Purpose"
            hint="Wyższy cel"
            value={identity.data.purposeMd}
            onCommit={(v) => identity.patch({ purposeMd: v })}
            multiline
          />
          <AutosaveField
            label="Filary marki"
            hint="Kluczowe wartości"
            value={identity.data.brandPillarsMd}
            onCommit={(v) => identity.patch({ brandPillarsMd: v })}
            multiline
          />
          <AutosaveField
            label="Tone of voice"
            hint="Jak mówimy"
            value={identity.data.toneOfVoiceMd}
            onCommit={(v) => identity.patch({ toneOfVoiceMd: v })}
            multiline
          />
          <AutosaveField
            label="Osobowość marki"
            hint="Archetyp / cechy"
            value={identity.data.brandPersonalityMd}
            onCommit={(v) => identity.patch({ brandPersonalityMd: v })}
            multiline
          />
        </SectionCard>
      ) : (
        <div className="space-y-5">
          <SectionCard
            title="Kolory"
            description="Paleta marki — próbnik + nazwa + rola."
            status={visual.status}
          >
            <JsonListEditor
              value={asArray(visual.data.colors)}
              columns={colorCols}
              onChange={(next) => visual.patch({ colors: next })}
              addLabel="Dodaj kolor"
              emptyHint="Brak kolorów."
            />
          </SectionCard>

          <SectionCard title="Typografia" status={visual.status}>
            <JsonListEditor
              value={asArray(visual.data.typography)}
              columns={typeCols}
              onChange={(next) => visual.patch({ typography: next })}
              addLabel="Dodaj krój"
              emptyHint="Brak krojów."
            />
          </SectionCard>

          <SectionCard title="Loga i pliki" status={visual.status}>
            <JsonListEditor
              value={asArray(visual.data.logoFiles)}
              columns={logoCols}
              onChange={(next) => visual.patch({ logoFiles: next })}
              addLabel="Dodaj plik"
              emptyHint="Brak plików."
            />
          </SectionCard>

          <SectionCard title="Wytyczne" status={visual.status}>
            <AutosaveField
              label="Brandbook URL"
              value={visual.data.brandbookUrl}
              onCommit={(v) => visual.patch({ brandbookUrl: v })}
              url
              placeholder="https://…"
            />
            <AutosaveField
              label="Zasady użycia"
              value={visual.data.usageGuidelinesMd}
              onCommit={(v) => visual.patch({ usageGuidelinesMd: v })}
              multiline
            />
          </SectionCard>
        </div>
      )}
    </div>
  );
}
