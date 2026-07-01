"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Loader2, Check, PiggyBank, Repeat, Boxes } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { ActivityRow, ChannelRow } from "@/components/strategy-hub/funnel-flow";

export const HEATMAP_STAGES = [
  { key: "TOFU", label: "TOFU", color: "#60a5fa" },
  { key: "MOFU", label: "MOFU", color: "#a78bfa" },
  { key: "BOFU", label: "BOFU", color: "#34d399" },
  { key: "retention", label: "Retencja", color: "#fbbf24" },
] as const;

interface SegmentRef {
  id: string;
  name: string;
}

type Metric = "weeklyCount" | "monthlyBudget";

const METRIC_LABEL: Record<Metric, string> = {
  weeklyCount: "Publikacje / tydz.",
  monthlyBudget: "Budżet / mc (zł)",
};

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
  stage: (typeof HEATMAP_STAGES)[number];
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
          {channel.icon ?? "📣"} {channel.name} ·{" "}
          <span style={{ color: stage.color }}>{stage.label}</span>
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
          <Button
            size="sm"
            className="w-full h-8 text-xs gap-1.5"
            onClick={() => void save()}
            disabled={saving}
          >
            {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
            Zapisz
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export interface ChannelHeatmapProps {
  projectId: string;
  channels: ChannelRow[];
  activities: ActivityRow[];
  segments: SegmentRef[];
  onSaved?: () => void;
  mode?: "editor" | "client";
}

export function ChannelHeatmap({
  projectId,
  channels,
  activities,
  segments,
  onSaved = () => {},
  mode = "editor",
}: ChannelHeatmapProps) {
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
    ...used.flatMap((c) => HEATMAP_STAGES.map((s) => cellValue(c.id, s.key)))
  );

  const columnSum = (stage: string) =>
    used.reduce((sum, c) => sum + cellValue(c.id, stage), 0);
  const rowSum = (channelId: string) =>
    HEATMAP_STAGES.reduce((sum, s) => sum + cellValue(channelId, s.key), 0);
  const grandTotal = used.reduce((sum, c) => sum + rowSum(c.id), 0);

  const canEdit = mode === "editor" && segmentId !== "__all__";

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

      {mode === "editor" && !canEdit && (
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
                {HEATMAP_STAGES.map((s) => (
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
                  {HEATMAP_STAGES.map((s) => {
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
                {HEATMAP_STAGES.map((s) => (
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

/** Self-fetching wrapper for client portal pages. */
export function ChannelHeatmapLoader({
  projectId,
  mode = "client",
}: {
  projectId: string;
  mode?: "editor" | "client";
}) {
  const [channels, setChannels] = useState<ChannelRow[]>([]);
  const [activities, setActivities] = useState<ActivityRow[]>([]);
  const [segments, setSegments] = useState<SegmentRef[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const base = `/api/strategy-hub/projects/${projectId}`;
    const ctrl = new AbortController();
    Promise.all([
      fetch(`${base}/channels`, { signal: ctrl.signal }).then((r) =>
        r.ok ? r.json() : { items: [] }
      ),
      fetch(`${base}/channel-activity-plan`, { signal: ctrl.signal }).then((r) =>
        r.ok ? r.json() : { items: [] }
      ),
      fetch(`${base}/segments`, { signal: ctrl.signal }).then((r) =>
        r.ok ? r.json() : { items: [] }
      ),
    ])
      .then(([ch, ac, sg]) => {
        setChannels(ch.items ?? []);
        setActivities(ac.items ?? []);
        setSegments(sg.items ?? []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
    return () => ctrl.abort();
  }, [projectId]);

  if (loading) {
    return (
      <p className="text-sm text-muted-foreground py-6 text-center flex items-center justify-center gap-2">
        <Loader2 className="size-4 animate-spin" />
        Ładowanie heatmapy…
      </p>
    );
  }

  return (
    <ChannelHeatmap
      projectId={projectId}
      channels={channels}
      activities={activities}
      segments={segments}
      mode={mode}
    />
  );
}
