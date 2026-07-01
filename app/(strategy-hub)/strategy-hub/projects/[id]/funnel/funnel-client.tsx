"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { Loader2, RefreshCw, Boxes, Check, PiggyBank, Repeat } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { SectionCard } from "@/components/strategy-hub/entity-singleton";
import { EntityCrud, type FieldDef } from "@/components/strategy-hub/entity-crud";
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

const STAGES = [
  { key: "TOFU", label: "TOFU", color: "#60a5fa" },
  { key: "MOFU", label: "MOFU", color: "#a78bfa" },
  { key: "BOFU", label: "BOFU", color: "#34d399" },
  { key: "retention", label: "Retencja", color: "#fbbf24" },
];

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

// ─── Channel Heatmap 3D: kanał × segment × etap ──────────────────────────────
// „3D" = trzy osie danych (nie WebGL): segment jako przełącznik warstwy nad
// macierzą kanał×etap — czytelniejsze niż literalna scena 3D, bez kosztu
// dodatkowego bundla (Faza 5.3, spec: kanał × segment × etap).

interface SegmentRef {
  id: string;
  name: string;
}

type Metric = "weeklyCount" | "monthlyBudget";

const METRIC_LABEL: Record<Metric, string> = {
  weeklyCount: "Publikacje / tydz.",
  monthlyBudget: "Budżet / mc (zł)",
};

/** Popover edycji pojedynczej komórki macierzy (channelId × segmentId × stage). */
function HeatmapCellEditor({
  projectId,
  channel,
  stage,
  segmentId,
  existing,
  onSaved,
  children,
}: {
  projectId: string;
  channel: ChannelRow;
  stage: (typeof STAGES)[number];
  segmentId: string;
  existing: ActivityRow | null;
  onSaved: () => void;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [cadence, setCadence] = useState(existing?.cadence ?? "");
  const [weeklyCount, setWeeklyCount] = useState(existing?.weeklyCount?.toString() ?? "");
  const [monthlyBudget, setMonthlyBudget] = useState(existing?.monthlyBudget?.toString() ?? "");
  const [whatToPublishMd, setWhatToPublishMd] = useState(existing?.whatToPublishMd ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setCadence(existing?.cadence ?? "");
    setWeeklyCount(existing?.weeklyCount?.toString() ?? "");
    setMonthlyBudget(existing?.monthlyBudget?.toString() ?? "");
    setWhatToPublishMd(existing?.whatToPublishMd ?? "");
  }, [open, existing]);

  async function save() {
    setSaving(true);
    try {
      const payload = {
        channelId: channel.id,
        segmentId,
        stage: stage.key,
        cadence: cadence || null,
        weeklyCount: weeklyCount ? Number(weeklyCount) : null,
        monthlyBudget: monthlyBudget ? Number(monthlyBudget) : null,
        whatToPublishMd: whatToPublishMd || null,
      };
      const base = `/api/strategy-hub/projects/${projectId}/channel-activity-plan`;
      const res = existing
        ? await fetch(`${base}/${existing.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await fetch(base, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
      if (res.ok) {
        // Kolejność ma znaczenie: zamknij popover PRZED odświeżeniem rodzica.
        // `onSaved()` wywołuje refetch w rodzicu, co tworzy nowy obiekt `existing`
        // i re-renderuje tego triggera — jeśli `setOpen(false)` wywołane po tym,
        // Radix Popover potrafi zignorować zamknięcie (trigger zmienia tożsamość
        // w trakcie commitu). Zweryfikowane w izolowanym teście UI.
        setOpen(false);
        onSaved();
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-72 p-3" align="center">
        <div className="mb-2 text-xs font-medium text-muted-foreground">
          {channel.icon ?? "📣"} {channel.name} · <span style={{ color: stage.color }}>{stage.label}</span>
        </div>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Repeat className="size-3.5 text-muted-foreground shrink-0" />
            <Input
              value={cadence}
              onChange={(e) => setCadence(e.target.value)}
              placeholder="Kadencja, np. 3×/tydz."
              className="h-8 text-xs"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Input
              type="number"
              value={weeklyCount}
              onChange={(e) => setWeeklyCount(e.target.value)}
              placeholder="Ile / tydz."
              className="h-8 text-xs"
            />
            <div className="flex items-center gap-1">
              <PiggyBank className="size-3.5 text-muted-foreground shrink-0" />
              <Input
                type="number"
                value={monthlyBudget}
                onChange={(e) => setMonthlyBudget(e.target.value)}
                placeholder="Budżet zł/mc"
                className="h-8 text-xs"
              />
            </div>
          </div>
          <Textarea
            value={whatToPublishMd}
            onChange={(e) => setWhatToPublishMd(e.target.value)}
            placeholder="Co publikować…"
            className="min-h-16 text-xs"
          />
          <Button size="sm" className="w-full h-8 text-xs gap-1.5" onClick={() => void save()} disabled={saving}>
            {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
            Zapisz
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function PivotHeatmap({
  projectId,
  channels,
  activities,
  segments,
  onSaved,
}: {
  projectId: string;
  channels: ChannelRow[];
  activities: ActivityRow[];
  segments: SegmentRef[];
  onSaved: () => void;
}) {
  const [segmentId, setSegmentId] = useState<string>("__all__");
  const [metric, setMetric] = useState<Metric>("weeklyCount");

  const usedSegmentIds = useMemo(
    () => new Set(activities.map((a) => a.segmentId).filter((v): v is string => !!v)),
    [activities]
  );
  const availableSegments = segments.filter((s) => usedSegmentIds.has(s.id));

  const scoped = activities.filter(
    (a) => segmentId === "__all__" || a.segmentId === segmentId
  );
  const used = channels.filter((c) => scoped.some((a) => a.channelId === c.id));

  const cellValue = (channelId: string, stage: string) =>
    scoped
      .filter((a) => a.channelId === channelId && a.stage === stage)
      .reduce((sum, a) => sum + (a[metric] ?? 0), 0);

  const cellActivity = (channelId: string, stage: string): ActivityRow | null =>
    scoped.find((a) => a.channelId === channelId && a.stage === stage) ?? null;

  const max = Math.max(
    1,
    ...used.flatMap((c) => STAGES.map((s) => cellValue(c.id, s.key)))
  );

  const columnSum = (stage: string) =>
    used.reduce((sum, c) => sum + cellValue(c.id, stage), 0);
  const rowSum = (channelId: string) =>
    STAGES.reduce((sum, s) => sum + cellValue(channelId, s.key), 0);
  const grandTotal = used.reduce((sum, c) => sum + rowSum(c.id), 0);

  const canEdit = segmentId !== "__all__";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {availableSegments.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <Boxes className="size-3.5 text-muted-foreground" />
            <button
              type="button"
              onClick={() => setSegmentId("__all__")}
              className={cn(
                "rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
                segmentId === "__all__"
                  ? "border-brand/40 bg-brand/10 text-brand"
                  : "border-border text-muted-foreground hover:text-foreground"
              )}
            >
              Wszystkie segmenty
            </button>
            {availableSegments.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setSegmentId(s.id)}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
                  segmentId === s.id
                    ? "border-brand/40 bg-brand/10 text-brand"
                    : "border-border text-muted-foreground hover:text-foreground"
                )}
              >
                {s.name}
              </button>
            ))}
          </div>
        )}
        <div className="flex items-center gap-1 rounded-full border border-border p-0.5">
          {(["weeklyCount", "monthlyBudget"] as Metric[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMetric(m)}
              className={cn(
                "rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors",
                metric === m
                  ? "bg-brand/10 text-brand"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {METRIC_LABEL[m]}
            </button>
          ))}
        </div>
      </div>

      {!canEdit && (
        <p className="text-[11px] text-muted-foreground">
          Wybierz konkretny segment, aby edytować komórki (klik).
        </p>
      )}

      {used.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4">
          Brak danych do macierzy — dodaj aktywności kanałów{" "}
          {segmentId !== "__all__" ? "dla tego segmentu" : ""}.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-separate border-spacing-1 text-sm">
            <thead>
              <tr>
                <th className="text-left text-xs font-medium text-muted-foreground p-2">
                  Kanał \ Etap
                </th>
                {STAGES.map((s) => (
                  <th
                    key={s.key}
                    className="text-xs font-medium p-2 text-center"
                    style={{ color: s.color }}
                  >
                    {s.label}
                  </th>
                ))}
                <th className="text-xs font-medium p-2 text-center text-muted-foreground">
                  Suma
                </th>
              </tr>
            </thead>
            <tbody>
              {used.map((c) => (
                <tr key={c.id}>
                  <td className="text-sm p-2 whitespace-nowrap">
                    {c.icon ?? "📣"} {c.name}
                  </td>
                  {STAGES.map((s) => {
                    const v = cellValue(c.id, s.key);
                    const intensity = v / max;
                    const activity = cellActivity(c.id, s.key);
                    const cellNode = (
                      <div
                        className={cn(
                          "h-10 rounded-md flex items-center justify-center text-xs font-medium border border-border/40",
                          v === 0 && "text-muted-foreground/40",
                          canEdit && "cursor-pointer hover:border-brand/50 transition-colors"
                        )}
                        style={{
                          background:
                            v === 0
                              ? "transparent"
                              : `color-mix(in oklab, ${s.color} ${Math.round(
                                  20 + intensity * 60
                                )}%, transparent)`,
                        }}
                        title={`${c.name} · ${s.label}: ${v}${metric === "monthlyBudget" ? " zł/mc" : "/tydz."}`}
                      >
                        {v > 0 ? v : "·"}
                      </div>
                    );
                    return (
                      <td key={s.key} className="p-0.5">
                        {canEdit ? (
                          <HeatmapCellEditor
                            projectId={projectId}
                            channel={c}
                            stage={s}
                            segmentId={segmentId}
                            existing={activity}
                            onSaved={onSaved}
                          >
                            {cellNode}
                          </HeatmapCellEditor>
                        ) : (
                          cellNode
                        )}
                      </td>
                    );
                  })}
                  <td className="p-0.5">
                    <div className="h-10 rounded-md flex items-center justify-center text-xs font-semibold text-muted-foreground">
                      {rowSum(c.id)}
                    </div>
                  </td>
                </tr>
              ))}
              <tr>
                <td className="text-xs font-medium text-muted-foreground p-2">Suma</td>
                {STAGES.map((s) => (
                  <td key={s.key} className="p-0.5">
                    <div className="h-8 rounded-md flex items-center justify-center text-xs font-semibold text-muted-foreground">
                      {columnSum(s.key)}
                    </div>
                  </td>
                ))}
                <td className="p-0.5">
                  <div className="h-8 rounded-md flex items-center justify-center text-xs font-bold text-brand">
                    {grandTotal}
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function FunnelClient({ projectId, projectName }: Props) {
  const channelsBase = `/api/strategy-hub/projects/${projectId}/channels`;
  const activitiesBase = `/api/strategy-hub/projects/${projectId}/channel-activity-plan`;
  const segmentsBase = `/api/strategy-hub/projects/${projectId}/segments`;
  const [channels, setChannels] = useState<ChannelRow[]>([]);
  const [activities, setActivities] = useState<ActivityRow[]>([]);
  const [segments, setSegments] = useState<SegmentRef[]>([]);
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
        <PivotHeatmap
          projectId={projectId}
          channels={channels}
          activities={activities}
          segments={segments}
          onSaved={refreshViz}
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
