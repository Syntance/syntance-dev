"use client";

import * as React from "react";
import { Users, Target, GitBranch, Layers, Radio, Plus, Pencil, Trash2 } from "lucide-react";
import { ResourceList } from "@/components/strategy-hub/resource-list";
import { FunnelElementEditor, FunnelElementData } from "@/components/strategy-hub/entity-editor";
import { RelationPicker } from "@/components/strategy-hub/relation-picker";
import { EVENT_REGISTRY } from "@/packages/analytics-events/src";
import {
  upsertSegment,
  deleteSegment,
  upsertKpi,
  deleteKpi,
  upsertUserFlow,
  deleteUserFlow,
  upsertFunnelElement,
  deleteFunnelElement,
} from "@/lib/strategy-hub/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Segment {
  id: string;
  projectId: string;
  name: string;
  persona: string | null;
  jtbd: string | null;
  problem: string | null;
  uvpText: string | null;
  priority: number | null;
}
interface Kpi {
  id: string;
  projectId: string;
  segmentId: string | null;
  name: string;
  target: string | null;
  actual: string | null;
  unit: string | null;
  category: string | null;
  eventKey?: string | null;
}
interface UserFlow {
  id: string;
  projectId: string;
  segmentId: string | null;
  name: string;
  stepsMd: string | null;
  conversionGoal: string | null;
  type: string | null;
  status: string | null;
}
interface FunnelElementRow {
  id: string;
  stageId: string;
  segmentId: string | null;
  name: string;
  format: string;
  status: string;
  contentMd: string;
  ctaText: string;
  ctaUrl: string;
  position: number | null;
  stageName: string | null;
  stagePhase: string | null;
  channelIds: string[];
  kpiIds: string[];
  campaignIds?: string[];
  geoAssetIds?: string[];
  eventKeys?: string[];
}
interface Channel {
  id: string;
  projectId: string;
  name: string;
  type: string | null;
  icon: string | null;
  status: string | null;
}

interface Props {
  projectId: string;
  projectName: string;
  segments: Segment[];
  kpis: Kpi[];
  userFlows: UserFlow[];
  funnelElements: FunnelElementRow[];
  channels: Channel[];
}

// ── Phase badge ───────────────────────────────────────────────────────────────

const PHASE_COLORS: Record<string, string> = {
  TOFU: "bg-sky-100 text-sky-700",
  MOFU: "bg-amber-100 text-amber-700",
  BOFU: "bg-emerald-100 text-emerald-700",
  retention: "bg-purple-100 text-purple-700",
};

function PhaseBadge({ phase }: { phase: string | null }) {
  if (!phase) return null;
  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase ${PHASE_COLORS[phase] ?? "bg-muted text-muted-foreground"}`}
    >
      {phase}
    </span>
  );
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

export function MarketingDashboard({
  projectId,
  projectName,
  segments,
  kpis,
  userFlows,
  funnelElements: initialElements,
  channels: initialChannels,
}: Props) {
  const router = useRouter();

  // Funnel element editor state
  const [editorOpen, setEditorOpen] = React.useState(false);
  const [editingElement, setEditingElement] = React.useState<Partial<FunnelElementData> | undefined>();
  const [elements, setElements] = React.useState<FunnelElementRow[]>(initialElements);
  const [channels, setChannels] = React.useState<Channel[]>(initialChannels);

  function openCreate() {
    setEditingElement(undefined);
    setEditorOpen(true);
  }

  async function openEdit(el: FunnelElementRow) {
    setEditingElement({
      id: el.id,
      name: el.name,
      format: el.format,
      status: el.status,
      contentMd: el.contentMd,
      ctaText: el.ctaText,
      ctaUrl: el.ctaUrl,
      position: el.position ?? 0,
      stageId: el.stageId,
      segmentId: el.segmentId,
      channelIds: el.channelIds,
      kpiIds: el.kpiIds,
      campaignIds: el.campaignIds ?? [],
      geoAssetIds: el.geoAssetIds ?? [],
      eventKeys: el.eventKeys ?? [],
    });
    setEditorOpen(true);

    // Hydrate wszystkie relacje (w tym kampanie/GEO/zdarzenia) ze świeżego stanu serwera.
    try {
      const res = await fetch(
        `/api/strategy-hub/projects/${projectId}/funnel-elements/${el.id}/relations`
      );
      if (res.ok) {
        const rel = (await res.json()) as {
          channelIds: string[];
          kpiIds: string[];
          campaignIds: string[];
          geoAssetIds: string[];
          eventKeys: string[];
        };
        setEditingElement((prev) =>
          prev && prev.id === el.id ? { ...prev, ...rel } : prev
        );
      }
    } catch {
      // zostają wartości z props
    }
  }

  async function handleSaveFunnelElement(data: FunnelElementData) {
    await upsertFunnelElement({
      id: data.id,
      projectId,
      name: data.name,
      stageId: data.stageId!,
      segmentId: data.segmentId ?? undefined,
      format: data.format,
      status: data.status,
      contentMd: data.contentMd,
      cta: data.ctaText,
      ctaUrl: data.ctaUrl,
      position: data.position,
    });

    // Save relations
    if (data.id) {
      await fetch(
        `/api/strategy-hub/projects/${projectId}/funnel-elements/${data.id}/relations`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            channelIds: data.channelIds,
            kpiIds: data.kpiIds,
            campaignIds: data.campaignIds,
            geoAssetIds: data.geoAssetIds,
            eventKeys: data.eventKeys,
          }),
        }
      );
    }

    router.refresh();
  }

  async function handleDeleteElement(id: string) {
    await deleteFunnelElement(id, projectId);
    setElements((prev) => prev.filter((e) => e.id !== id));
  }

  async function handleInlineChannels(elementId: string, channelIds: string[]) {
    setElements((prev) =>
      prev.map((e) => (e.id === elementId ? { ...e, channelIds } : e))
    );
    try {
      await fetch(
        `/api/strategy-hub/projects/${projectId}/funnel-elements/${elementId}/relations`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ channelIds }),
        }
      );
    } catch {
      /* best-effort — modal edytora ma pełną synchronizację */
    }
  }

  return (
    <>
      <div className="w-full min-w-0 space-y-6">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            📊 Strategia marketingowa
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {projectName} · {segments.length} segmentów · {kpis.length} KPI ·{" "}
            {userFlows.length} flows · {elements.length} elementów lejka
          </p>
        </div>

        {/* Segmenty */}
        <ResourceList
          title="Segmenty"
          icon={<Users className="size-4 text-brand" />}
          items={segments}
          emptyHint="Dodaj pierwszy segment docelowy — kto, jaki problem, jakie JTBD."
          newButtonLabel="Nowy segment"
          fields={[
            { name: "projectId", label: "projectId", type: "hidden", defaultValue: projectId },
            { name: "name", label: "Nazwa segmentu", required: true, placeholder: "np. Założyciele B2B SaaS" },
            { name: "priority", label: "Priorytet", type: "number", placeholder: "0" },
            { name: "persona", label: "Persona", type: "textarea", placeholder: "Krótki opis osoby — wiek, rola, motywacje" },
            { name: "jtbd", label: "Jobs To Be Done", type: "textarea", placeholder: "Co próbują osiągnąć?" },
            { name: "problem", label: "Problem", type: "textarea" },
            { name: "uvpText", label: "UVP dla tego segmentu", type: "textarea" },
          ]}
          renderRow={(s) => (
            <div className="min-w-0">
              <div className="font-medium text-sm">{s.name}</div>
              {s.jtbd && (
                <div className="text-xs text-muted-foreground truncate mt-0.5">
                  JTBD: {s.jtbd}
                </div>
              )}
            </div>
          )}
          onSave={async (data) => {
            await upsertSegment({
              ...data,
              projectId: data.projectId as string,
              name: data.name as string,
              id: data.id as string | undefined,
            });
          }}
          onDelete={(id) => deleteSegment(id, projectId)}
        />

        {/* Kanały */}
        <ResourceList
          title="Kanały"
          icon={<Radio className="size-4 text-brand" />}
          items={channels}
          emptyHint="Dodaj kanały marketingowe — Instagram, newsletter, blog, etc."
          newButtonLabel="Nowy kanał"
          fields={[
            { name: "name", label: "Nazwa kanału", required: true, placeholder: "np. Instagram" },
            { name: "icon", label: "Emoji/ikona", placeholder: "📷" },
            { name: "type", label: "Typ", placeholder: "social / email / paid / organic" },
            { name: "costMonthly", label: "Koszt miesięczny (PLN)", type: "number" },
            { name: "description", label: "Opis", type: "textarea" },
          ]}
          renderRow={(ch) => (
            <div className="min-w-0 flex items-center gap-2">
              {ch.icon && <span>{ch.icon}</span>}
              <div>
                <div className="font-medium text-sm">{ch.name}</div>
                {ch.type && <div className="text-xs text-muted-foreground">{ch.type}</div>}
              </div>
            </div>
          )}
          onSave={async (data) => {
            const res = await fetch(`/api/strategy-hub/projects/${projectId}/channels`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(data.id ? data : { ...data, id: undefined }),
            });
            if (res.ok) {
              const { channel } = await res.json();
              setChannels((prev) => {
                const existing = prev.findIndex((c) => c.id === channel.id);
                if (existing >= 0) {
                  const next = [...prev];
                  next[existing] = channel;
                  return next;
                }
                return [...prev, channel];
              });
            }
          }}
          onDelete={async (id) => {
            await fetch(`/api/strategy-hub/projects/${projectId}/channels?channelId=${id}`, {
              method: "DELETE",
            });
            setChannels((prev) => prev.filter((c) => c.id !== id));
          }}
        />

        {/* Elementy lejka — z relacyjnym edytorem */}
        <section className="border rounded-lg overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
            <div className="flex items-center gap-2">
              <Layers className="size-4 text-brand" />
              <span className="text-sm font-semibold">Elementy lejka</span>
              <span className="text-xs text-muted-foreground ml-1">
                {elements.length} elementów
              </span>
            </div>
            <Button size="sm" variant="outline" onClick={openCreate} className="h-7 text-xs gap-1">
              <Plus className="size-3.5" />
              Nowy element
            </Button>
          </div>

          {elements.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              Brak elementów lejka.{" "}
              <button
                type="button"
                className="underline underline-offset-2 hover:text-foreground transition-colors"
                onClick={openCreate}
              >
                Dodaj pierwszy
              </button>{" "}
              — krok po kroku od TOFU do konwersji.
            </div>
          ) : (
            <div className="divide-y">
              {elements.map((el) => (
                <div
                  key={el.id}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-muted/20 transition-colors group"
                >
                  {/* Phase badge */}
                  <PhaseBadge phase={el.stagePhase} />

                  {/* Main info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate">{el.name}</span>
                      {el.format && (
                        <Badge variant="secondary" className="text-[10px] h-4 px-1.5 shrink-0">
                          {el.format}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      {el.stageName && (
                        <span className="text-xs text-muted-foreground shrink-0">
                          {el.stageName}
                        </span>
                      )}
                      <RelationPicker
                        projectId={projectId}
                        entityType="channel"
                        cardinality="multi"
                        value={el.channelIds}
                        onChange={(v) => void handleInlineChannels(el.id, (v as string[]) ?? [])}
                        placeholder="+ kanał"
                        className="w-auto min-w-0 max-w-[280px]"
                      />
                    </div>
                  </div>

                  {/* Status */}
                  <div className="shrink-0">
                    <span
                      className={`inline-flex h-1.5 w-1.5 rounded-full ${
                        el.status === "active"
                          ? "bg-emerald-500"
                          : el.status === "paused"
                          ? "bg-amber-400"
                          : "bg-zinc-400"
                      }`}
                    />
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    <button
                      type="button"
                      onClick={() => openEdit(el)}
                      className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                      title="Edytuj element (z relacjami)"
                    >
                      <Pencil className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteElement(el.id)}
                      className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                      title="Usuń"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* KPI */}
        <ResourceList
          title="KPI"
          icon={<Target className="size-4 text-brand" />}
          items={kpis}
          emptyHint="Zdefiniuj kluczowe wskaźniki — target + jednostka + kategoria."
          newButtonLabel="Nowy KPI"
          fields={[
            { name: "projectId", label: "projectId", type: "hidden", defaultValue: projectId },
            { name: "name", label: "Nazwa KPI", required: true, placeholder: "np. Conversion rate" },
            { name: "category", label: "Kategoria", placeholder: "np. acquisition / retention" },
            { name: "target", label: "Target", placeholder: "np. 3%" },
            { name: "actual", label: "Aktualna wartość" },
            { name: "unit", label: "Jednostka", placeholder: "np. %, PLN, sztuk" },
            { name: "segmentId", label: "Segment (id)", placeholder: "opcjonalnie", full: true },
            {
              name: "eventKey",
              label: "Zdarzenie analityczne (mierzalność KPI)",
              type: "select",
              full: true,
              options: [
                { value: "", label: "— brak (KPI nie-analityczny) —" },
                ...EVENT_REGISTRY.map((e) => ({ value: e.key, label: e.label })),
              ],
            },
          ]}
          renderRow={(k) => (
            <div className="flex items-center gap-3 min-w-0">
              <div className="min-w-0 flex-1">
                <div className="font-medium text-sm">{k.name}</div>
                {k.category && <div className="text-xs text-muted-foreground">{k.category}</div>}
              </div>
              <div className="text-right shrink-0">
                <div className="text-sm font-mono">
                  {k.actual ?? "—"}
                  <span className="text-muted-foreground"> / {k.target ?? "—"}</span>
                  {k.unit && <span className="text-muted-foreground"> {k.unit}</span>}
                </div>
              </div>
            </div>
          )}
          onSave={async (data) => {
            await upsertKpi({
              ...data,
              projectId: data.projectId as string,
              name: data.name as string,
              id: data.id as string | undefined,
            });
          }}
          onDelete={(id) => deleteKpi(id, projectId)}
        />

        {/* User Flows */}
        <ResourceList
          title="User flows"
          icon={<GitBranch className="size-4 text-brand" />}
          items={userFlows}
          emptyHint="Zaprojektuj ścieżki użytkownika do konwersji — kroki w markdown."
          newButtonLabel="Nowy flow"
          fields={[
            { name: "projectId", label: "projectId", type: "hidden", defaultValue: projectId },
            { name: "name", label: "Nazwa flow", required: true, placeholder: "np. Demo request" },
            {
              name: "type",
              label: "Typ",
              type: "select",
              options: [
                { value: "acquisition", label: "Acquisition" },
                { value: "activation", label: "Activation" },
                { value: "retention", label: "Retention" },
                { value: "revenue", label: "Revenue" },
                { value: "referral", label: "Referral" },
              ],
            },
            { name: "conversionGoal", label: "Cel konwersji", placeholder: "np. Demo booked" },
            {
              name: "status",
              label: "Status",
              type: "select",
              options: [
                { value: "draft", label: "Draft" },
                { value: "live", label: "Live" },
                { value: "paused", label: "Wstrzymany" },
              ],
            },
            {
              name: "stepsMd",
              label: "Kroki (markdown)",
              type: "textarea",
              placeholder: "1. Landing → CTA\n2. Form\n3. Email confirm\n4. Sales call",
            },
          ]}
          renderRow={(f) => (
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm">{f.name}</span>
                {f.type && (
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                    {f.type}
                  </span>
                )}
              </div>
              {f.conversionGoal && (
                <div className="text-xs text-muted-foreground truncate mt-0.5">
                  → {f.conversionGoal}
                </div>
              )}
            </div>
          )}
          onSave={async (data) => {
            await upsertUserFlow({
              ...data,
              projectId: data.projectId as string,
              name: data.name as string,
              id: data.id as string | undefined,
            });
          }}
          onDelete={(id) => deleteUserFlow(id, projectId)}
        />
      </div>

      {/* Relational editor panel */}
      <FunnelElementEditor
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        projectId={projectId}
        initial={editingElement}
        onSave={handleSaveFunnelElement}
      />
    </>
  );
}
