"use client";

import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/strategy-hub/entity-singleton";
import { EntityCrud, type FieldDef } from "@/components/strategy-hub/entity-crud";
import { ChannelHeatmap } from "@/components/strategy-hub/channel-heatmap";
import type {
  ActivityRow,
  ChannelRow,
} from "@/components/strategy-hub/funnel-flow";

const FunnelFlow = dynamic(
  () => import("@/components/strategy-hub/funnel-flow"),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[420px] items-center justify-center rounded-xl border border-border text-sm text-muted-foreground gap-2">
        <Loader2 className="size-4 animate-spin" />
        Ładowanie diagramu…
      </div>
    ),
  }
);

const FunnelBoard = dynamic(
  () => import("@/components/strategy-hub/funnel-board").then((m) => m.FunnelBoard),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[520px] items-center justify-center rounded-xl border border-border text-sm text-muted-foreground gap-2">
        <Loader2 className="size-4 animate-spin" />
        Ładowanie planszy lejka…
      </div>
    ),
  }
);

interface Props {
  projectId: string;
  projectName: string;
}

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

export function FunnelClient({ projectId, projectName }: Props) {
  const channelsBase = `/api/strategy-hub/projects/${projectId}/channels`;
  const activitiesBase = `/api/strategy-hub/projects/${projectId}/channel-activity-plan`;
  const segmentsBase = `/api/strategy-hub/projects/${projectId}/segments`;
  const [channels, setChannels] = useState<ChannelRow[]>([]);
  const [activities, setActivities] = useState<ActivityRow[]>([]);
  const [segments, setSegments] = useState<{ id: string; name: string }[]>([]);
  const [vizKey, setVizKey] = useState(0);

  const refreshViz = useCallback(async () => {
    try {
      const [chRes, acRes] = await Promise.all([
        fetch(channelsBase, { signal: AbortSignal.timeout(8000) }),
        fetch(activitiesBase, { signal: AbortSignal.timeout(8000) }),
      ]);
      if (chRes.ok) setChannels((await chRes.json()).items ?? []);
      if (acRes.ok) setActivities((await acRes.json()).items ?? []);
      setVizKey((k) => k + 1);
    } catch (err) {
      console.error("viz refresh failed", err);
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

  const channelOptions = channels.map((c) => ({
    value: c.id,
    label: c.name,
  }));
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
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-muted-foreground">{projectName}</p>
          <h1 className="text-xl font-semibold tracking-tight">Lejek i kanały</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Przepływ konwersji, plan aktywności kanałów i macierz kanał × etap.
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => void refreshViz()}
          className="h-8 text-xs gap-1.5 shrink-0"
        >
          <RefreshCw className="size-3.5" />
          Odśwież podgląd
        </Button>
      </header>

      <SectionCard
        title="Funnel Flow Builder"
        description="Elementy lejka per segment i faza (TOFU/MOFU/BOFU/Retencja). Przeciągnij element między kolumnami, aby zmienić etap; połącz z kanałem przeciągając z portu. ⌘L — auto-layout."
      >
        <FunnelBoard projectId={projectId} />
      </SectionCard>

      <SectionCard
        title="Funnel Flow — kanały"
        description="Kanały zasilające kolejne etapy lejka."
      >
        <FunnelFlow key={vizKey} channels={channels} activities={activities} />
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
          <p className="text-sm text-muted-foreground py-2">
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
    </div>
  );
}
