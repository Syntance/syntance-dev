"use client";

import * as React from "react";
import { X, Clock, Sparkles, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { RelationPicker, RelationOption } from "./relation-picker";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface FunnelElementData {
  id?: string;
  name: string;
  format: string;
  status: string;
  contentMd: string;
  ctaText: string;
  ctaUrl: string;
  position: number;
  // relations
  stageId: string | null;
  segmentId: string | null;
  channelIds: string[];
  kpiIds: string[];
  campaignIds: string[];
  geoAssetIds: string[];
}

interface FunnelElementEditorProps {
  open: boolean;
  onClose: () => void;
  projectId: string;
  initial?: Partial<FunnelElementData>;
  onSave: (data: FunnelElementData) => Promise<void>;
  /** Pre-set and lock segment/stage (e.g. from funnel board context) */
  lockedSegmentId?: string;
  lockedStageId?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const FORMAT_OPTIONS = [
  "Reels", "Post", "Story", "Karuzela", "Live", "Newsletter",
  "Blog post", "Quiz", "Webinar", "Lead magnet", "Reklama", "Inne",
];

const STATUS_OPTIONS = [
  { value: "draft", label: "Szkic" },
  { value: "active", label: "Aktywny" },
  { value: "paused", label: "Wstrzymany" },
  { value: "archived", label: "Archiwum" },
];

function statusColor(s: string) {
  return {
    active: "bg-emerald-500",
    draft: "bg-zinc-400",
    paused: "bg-amber-400",
    archived: "bg-zinc-300",
  }[s] ?? "bg-zinc-400";
}

// ── Main editor component ─────────────────────────────────────────────────────

export function FunnelElementEditor({
  open,
  onClose,
  projectId,
  initial,
  onSave,
  lockedSegmentId,
  lockedStageId,
}: FunnelElementEditorProps) {
  const [saving, setSaving] = React.useState(false);
  const [data, setData] = React.useState<FunnelElementData>(() => ({
    name: "",
    format: "Post",
    status: "draft",
    contentMd: "",
    ctaText: "",
    ctaUrl: "",
    position: 0,
    stageId: lockedStageId ?? null,
    segmentId: lockedSegmentId ?? null,
    channelIds: [],
    kpiIds: [],
    campaignIds: [],
    geoAssetIds: [],
    ...initial,
  }));

  // Reset when initial changes (open new element)
  React.useEffect(() => {
    setData({
      name: "",
      format: "Post",
      status: "draft",
      contentMd: "",
      ctaText: "",
      ctaUrl: "",
      position: 0,
      stageId: lockedStageId ?? null,
      segmentId: lockedSegmentId ?? null,
      channelIds: [],
      kpiIds: [],
      campaignIds: [],
      geoAssetIds: [],
      ...initial,
    });
  }, [initial?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  function patch<K extends keyof FunnelElementData>(key: K, val: FunnelElementData[K]) {
    setData((prev) => ({ ...prev, [key]: val }));
  }

  const canSave = data.name.trim().length > 0 && data.stageId;

  async function handleSave() {
    if (!canSave) return;
    setSaving(true);
    try {
      await onSave(data);
      onClose();
    } finally {
      setSaving(false);
    }
  }

  // When stage changes, auto-fill segmentId if stage picker returns meta with segmentId
  // (handled in RelationPicker via onCreateNew / external segment flow)

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-[520px] overflow-y-auto flex flex-col gap-0 p-0"
      >
        {/* Header */}
        <SheetHeader className="flex flex-row items-center justify-between px-5 pt-5 pb-3 border-b shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-base font-semibold truncate">
              {data.id ? "Edytuj element lejka" : "Nowy element lejka"}
            </span>
            <div className={cn("h-2 w-2 rounded-full shrink-0", statusColor(data.status))} />
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-md hover:bg-muted"
              title="Historia zmian"
            >
              <Clock className="h-4 w-4" />
            </button>
            <button
              type="button"
              className="text-amber-500 hover:text-amber-600 transition-colors p-1 rounded-md hover:bg-amber-50"
              title="AI w kontekście"
            >
              <Sparkles className="h-4 w-4" />
            </button>
            <SheetTitle className="sr-only">Edytor elementu lejka</SheetTitle>
          </div>
        </SheetHeader>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {/* ── Podstawowe pola ─────────────────────────────────────────── */}
          <Section title="Podstawowe pola">
            <Field label="Nazwa" required>
              <Input
                value={data.name}
                onChange={(e) => patch("name", e.target.value)}
                placeholder="np. Reels z metamorfozą pokoju"
                className="h-8 text-sm"
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Format">
                <SelectInline
                  options={FORMAT_OPTIONS}
                  value={data.format}
                  onChange={(v) => patch("format", v)}
                />
              </Field>
              <Field label="Status">
                <SelectInline
                  options={STATUS_OPTIONS.map((o) => o.value)}
                  labels={STATUS_OPTIONS.reduce(
                    (acc, o) => ({ ...acc, [o.value]: o.label }),
                    {} as Record<string, string>
                  )}
                  value={data.status}
                  onChange={(v) => patch("status", v)}
                />
              </Field>
            </div>

            <Field label="Treść / opis">
              <Textarea
                value={data.contentMd}
                onChange={(e) => patch("contentMd", e.target.value)}
                placeholder="Krótki opis formatu, hooka, przekazu…"
                className="text-sm min-h-[80px] resize-none"
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="CTA tekst">
                <Input
                  value={data.ctaText}
                  onChange={(e) => patch("ctaText", e.target.value)}
                  placeholder="np. Zobacz inspiracje"
                  className="h-8 text-sm"
                />
              </Field>
              <Field label="CTA URL">
                <Input
                  value={data.ctaUrl}
                  onChange={(e) => patch("ctaUrl", e.target.value)}
                  placeholder="/inspiracje"
                  className="h-8 text-sm"
                />
              </Field>
            </div>
          </Section>

          <Separator />

          {/* ── Powiązania wychodzące ────────────────────────────────────── */}
          <Section title="Powiązania" icon={<ChevronRight className="h-3.5 w-3.5" />}>
            <RelationPicker
              projectId={projectId}
              entityType="purchase_stage"
              cardinality="single"
              value={data.stageId}
              onChange={(v) => {
                patch("stageId", v as string | null);
                // Stage carries implicit segment - could auto-fill via API if needed
              }}
              filterSegmentId={data.segmentId ?? undefined}
              label="Etap zakupu"
              placeholder="Wybierz etap zakupu…"
              required
              className="w-full"
            />

            <RelationPicker
              projectId={projectId}
              entityType="segment"
              cardinality="single"
              value={data.segmentId}
              onChange={(v) => {
                patch("segmentId", v as string | null);
                // Clear stageId if segment changes (to avoid cross-segment inconsistency)
                if (v !== data.segmentId) patch("stageId", null);
              }}
              label="Segment"
              placeholder="Segment (auto z etapu)"
              className="w-full"
            />

            <RelationPicker
              projectId={projectId}
              entityType="channel"
              cardinality="multi"
              value={data.channelIds}
              onChange={(v) => patch("channelIds", (v as string[]) ?? [])}
              label="Kanały (multi)"
              placeholder="+ Dodaj kanał"
              allowCreate
              onCreateNew={async (name) => {
                const res = await fetch(
                  `/api/strategy-hub/projects/${projectId}/channels`,
                  {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ name }),
                  }
                );
                if (!res.ok) return null;
                const { channel } = await res.json();
                return { id: channel.id, label: channel.name } as RelationOption;
              }}
              className="w-full"
            />

            <RelationPicker
              projectId={projectId}
              entityType="kpi"
              cardinality="multi"
              value={data.kpiIds}
              onChange={(v) => patch("kpiIds", (v as string[]) ?? [])}
              filterSegmentId={data.segmentId ?? undefined}
              label="KPI powiązane (multi)"
              placeholder="+ Powiąż KPI"
              className="w-full"
            />

            <RelationPicker
              projectId={projectId}
              entityType="campaign"
              cardinality="multi"
              value={data.campaignIds}
              onChange={(v) => patch("campaignIds", (v as string[]) ?? [])}
              label="Kampanie — „promowany przez” (multi)"
              placeholder="+ Powiąż kampanię"
              className="w-full"
            />

            <RelationPicker
              projectId={projectId}
              entityType="geo"
              cardinality="multi"
              value={data.geoAssetIds}
              onChange={(v) => patch("geoAssetIds", (v as string[]) ?? [])}
              label="GEO/AEO — „cytowalny w AI przez” (multi)"
              placeholder="+ Powiąż asset GEO"
              className="w-full"
            />
          </Section>

          {/* ── Powiązania wsteczne (read-only) ─────────────────────────── */}
          {data.id && (
            <>
              <Separator />
              <BackRelations elementId={data.id} projectId={projectId} />
            </>
          )}
        </div>

        {/* Footer */}
        <div className="border-t px-5 py-3 flex items-center justify-between gap-3 shrink-0 bg-background">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Anuluj
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={!canSave || saving}
          >
            {saving ? "Zapisuję…" : data.id ? "Zapisz zmiany" : "Utwórz element"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ── Back-relations panel ──────────────────────────────────────────────────────

function BackRelations({ elementId, projectId }: { elementId: string; projectId: string }) {
  const [data, setData] = React.useState<{
    userFlows: { id: string; name: string }[];
    pages: { id: string; name: string }[];
  } | null>(null);

  React.useEffect(() => {
    // Lightweight fetch of back-relations
    fetch(`/api/strategy-hub/projects/${projectId}/funnel-elements/${elementId}/back-relations`)
      .then((r) => r.json())
      .then(setData)
      .catch(() => {});
  }, [elementId, projectId]);

  if (!data) return null;
  if (data.userFlows.length === 0 && data.pages.length === 0) return null;

  return (
    <Section title="Powiązania wsteczne" muted>
      {data.userFlows.length > 0 && (
        <div className="space-y-1">
          <span className="text-xs text-muted-foreground">User flows używające tego elementu:</span>
          <div className="flex flex-wrap gap-1">
            {data.userFlows.map((f) => (
              <Badge key={f.id} variant="outline" className="text-xs">
                {f.name}
              </Badge>
            ))}
          </div>
        </div>
      )}
      {data.pages.length > 0 && (
        <div className="space-y-1 mt-1">
          <span className="text-xs text-muted-foreground">Podstrony używające:</span>
          <div className="flex flex-wrap gap-1">
            {data.pages.map((p) => (
              <Badge key={p.id} variant="outline" className="text-xs">
                {p.name}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </Section>
  );
}

// ── Small reusable sub-components ─────────────────────────────────────────────

function Section({
  title,
  children,
  icon,
  muted,
}: {
  title: string;
  children: React.ReactNode;
  icon?: React.ReactNode;
  muted?: boolean;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1.5">
        {icon}
        <span
          className={cn(
            "text-xs font-semibold uppercase tracking-wide",
            muted ? "text-muted-foreground" : "text-foreground"
          )}
        >
          {title}
        </span>
      </div>
      {children}
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">
        {label}
        {required && <span className="ml-0.5 text-destructive">*</span>}
      </Label>
      {children}
    </div>
  );
}

function SelectInline({
  options,
  labels,
  value,
  onChange,
}: {
  options: string[];
  labels?: Record<string, string>;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <select
      className="h-8 w-full rounded-md border border-input bg-background px-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      {options.map((o) => (
        <option key={o} value={o}>
          {labels?.[o] ?? o}
        </option>
      ))}
    </select>
  );
}
