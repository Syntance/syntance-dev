"use client";

import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";
import { SectionCard } from "@/components/strategy-hub/entity-singleton";
import { EntityCrud, type FieldDef } from "@/components/strategy-hub/entity-crud";
import { ChannelHeatmap } from "@/components/strategy-hub/channel-heatmap";
import { apiFetch } from "@/lib/strategy-hub/api-fetch";
import type {
  ActivityRow,
  ChannelRow,
} from "@/components/strategy-hub/funnel-flow";

/**
 * Zakładka „Kanały i plan" warsztatu lejka: CRUD kanałów, plan aktywności
 * (kadencje per kanał × etap × segment), heatmapa i diagram zasilania.
 * Wydzielone z dawnego FunnelClient — edytor lejka ma własny pełny ekran.
 */

const FunnelFlow = dynamic(
  () => import("@/components/strategy-hub/funnel-flow"),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[420px] items-center justify-center gap-2 rounded-xl border border-border text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Ładowanie diagramu…
      </div>
    ),
  }
);

const channelFields: FieldDef[] = [
  { key: "name", label: "Kanał", type: "text", primary: true },
  { key: "icon", label: "Ikona (emoji)", type: "text" },
  { key: "type", label: "Typ", type: "text", placeholder: "np. social, SEO, ADS" },
  { key: "costMonthly", label: "Koszt / mc (zł)", type: "number" },
  { key: "description", label: "Opis", type: "textarea" },
  {
    key: "status",
    label: "Status",
    type: "select",
    badge: true,
    options: [
      { value: "active", label: "Aktywny", tone: "success" },
      { value: "planned", label: "Planowany", tone: "info" },
      { value: "paused", label: "Wstrzymany", tone: "warning" },
    ],
  },
];

export function FunnelChannelsPanel({ projectId }: { projectId: string }) {
  const channelsBase = `/api/strategy-hub/projects/${projectId}/channels`;
  const activitiesBase = `/api/strategy-hub/projects/${projectId}/channel-activity-plan`;
  const segmentsBase = `/api/strategy-hub/projects/${projectId}/segments`;
  const [channels, setChannels] = useState<ChannelRow[]>([]);
  const [activities, setActivities] = useState<ActivityRow[]>([]);
  const [segments, setSegments] = useState<{ id: string; name: string }[]>([]);
  const [vizKey, setVizKey] = useState(0);

  const refreshViz = useCallback(async () => {
    try {
      const [ch, ac] = await Promise.all([
        apiFetch<{ items?: ChannelRow[] }>(channelsBase),
        apiFetch<{ items?: ActivityRow[] }>(activitiesBase),
      ]);
      setChannels(ch.items ?? []);
      setActivities(ac.items ?? []);
      setVizKey((k) => k + 1);
    } catch {
      // toast pokazuje apiFetch
    }
  }, [channelsBase, activitiesBase]);

  useEffect(() => {
    const ctrl = new AbortController();
    Promise.all([
      fetch(channelsBase, { signal: ctrl.signal }).then((r) =>
        r.ok ? r.json() : { items: [] }
      ),
      fetch(activitiesBase, { signal: ctrl.signal }).then((r) =>
        r.ok ? r.json() : { items: [] }
      ),
      fetch(segmentsBase, { signal: ctrl.signal }).then((r) =>
        r.ok ? r.json() : { items: [] }
      ),
    ])
      .then(([ch, ac, sg]) => {
        setChannels(ch.items ?? []);
        setActivities(ac.items ?? []);
        setSegments(sg.items ?? []);
        setVizKey((k) => k + 1);
      })
      .catch(() => {});
    return () => ctrl.abort();
  }, [channelsBase, activitiesBase, segmentsBase]);

  const channelOptions = channels.map((c) => ({ value: c.id, label: c.name }));
  const segmentOptions = segments.map((s) => ({ value: s.id, label: s.name }));

  const activityFields: FieldDef[] = [
    {
      key: "channelId",
      label: "Kanał",
      type: "relation",
      primary: true,
      options: channelOptions,
    },
    {
      key: "stage",
      label: "Etap lejka",
      type: "select",
      badge: true,
      options: [
        { value: "TOFU", label: "TOFU", tone: "info" },
        { value: "MOFU", label: "MOFU", tone: "info" },
        { value: "BOFU", label: "BOFU", tone: "success" },
        { value: "retention", label: "Retencja", tone: "warning" },
      ],
    },
    {
      key: "segmentId",
      label: "Segment",
      type: "relation",
      options: segmentOptions,
    },
    { key: "whatToPublishMd", label: "Co publikować", type: "textarea" },
    { key: "cadence", label: "Kadencja", type: "text", placeholder: "np. 3×/tydz." },
    { key: "weeklyCount", label: "Liczba / tydz.", type: "number" },
    { key: "monthlyBudget", label: "Budżet / mc (zł)", type: "number" },
  ];

  return (
    <div className="w-full min-w-0 space-y-6">
      <SectionCard title="Kanały">
        <EntityCrud
          projectId={projectId}
          entity="channels"
          fields={channelFields}
          addLabel="Dodaj kanał"
          emptyHint="Brak kanałów."
          onMutate={refreshViz}
        />
      </SectionCard>

      <SectionCard title="Plan aktywności">
        {channelOptions.length === 0 ? (
          <p className="py-2 text-sm text-muted-foreground">
            Najpierw dodaj kanał, aby zaplanować aktywności.
          </p>
        ) : (
          <EntityCrud
            projectId={projectId}
            entity="channel-activity-plan"
            fields={activityFields}
            addLabel="Dodaj aktywność"
            emptyHint="Brak zaplanowanych aktywności."
            onMutate={refreshViz}
            dense
          />
        )}
      </SectionCard>

      <SectionCard
        title="Channel Heatmap — kanał × segment × etap"
        description="Intensywność aktywności (liczba publikacji / tydz.); segment jako 3. wymiar przełączany chipami."
      >
        <ChannelHeatmap
          projectId={projectId}
          channels={channels}
          activities={activities}
          segments={segments}
          onSaved={refreshViz}
          mode="editor"
        />
      </SectionCard>

      <SectionCard
        title="Funnel Flow — kanały"
        description="Kanały zasilające kolejne etapy lejka."
      >
        <FunnelFlow key={vizKey} channels={channels} activities={activities} />
      </SectionCard>
    </div>
  );
}
