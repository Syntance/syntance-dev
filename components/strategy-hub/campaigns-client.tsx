"use client";

import * as React from "react";
import { Plus, Trash2, Loader2, Megaphone, Link2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RelationPicker } from "@/components/strategy-hub/relation-picker";
import { EntityMetaPanel } from "@/components/strategy-hub/entity-meta-panel";

interface Creative {
  label?: string;
  url?: string;
  type?: string;
}
interface Utm {
  source?: string;
  medium?: string;
  campaign?: string;
  term?: string;
  content?: string;
}
interface ChannelRef {
  channelId: string;
}

interface Campaign {
  id: string;
  name: string;
  goal: string | null;
  segmentId: string | null;
  landingPageId: string | null;
  stage: string | null;
  status: string | null;
  channels: ChannelRef[] | null;
  creatives: Creative[] | null;
  utm: Utm | null;
  budgetPlan: number | null;
  budgetSpent: number | null;
  periodStart: string | null;
  periodEnd: string | null;
}

const STAGES = [
  { value: "TOFU", label: "TOFU" },
  { value: "MOFU", label: "MOFU" },
  { value: "BOFU", label: "BOFU" },
  { value: "retention", label: "Retencja" },
];
const STATUSES = [
  { value: "planned", label: "Planowana" },
  { value: "active", label: "Aktywna" },
  { value: "paused", label: "Wstrzymana" },
  { value: "done", label: "Zakończona" },
];

function toDateInput(v: string | null): string {
  if (!v) return "";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
}

export function CampaignsClient({ projectId }: { projectId: string }) {
  const base = `/api/strategy-hub/projects/${projectId}/campaigns`;
  const [items, setItems] = React.useState<Campaign[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [creating, setCreating] = React.useState(false);
  const timers = React.useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  React.useEffect(() => {
    let cancelled = false;
    fetch(base, { signal: AbortSignal.timeout(8000) })
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((j: { items?: Campaign[] }) => {
        if (cancelled) return;
        setItems(j.items ?? []);
        setSelectedId((cur) => cur ?? j.items?.[0]?.id ?? null);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [base]);

  const selected = items.find((c) => c.id === selectedId) ?? null;

  const persist = React.useCallback(
    (id: string, patch: Partial<Campaign>, debounce: number) => {
      const key = `${id}:${Object.keys(patch).join(",")}`;
      const ex = timers.current.get(key);
      if (ex) clearTimeout(ex);
      const t = setTimeout(() => {
        void fetch(`${base}/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        });
      }, debounce);
      timers.current.set(key, t);
    },
    [base]
  );

  const update = React.useCallback(
    (id: string, patch: Partial<Campaign>, debounce = 0) => {
      setItems((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
      persist(id, patch, debounce);
    },
    [persist]
  );

  const add = React.useCallback(async () => {
    setCreating(true);
    try {
      const res = await fetch(base, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Nowa kampania", status: "planned" }),
      });
      if (!res.ok) return;
      const { item } = (await res.json()) as { item: Campaign };
      setItems((prev) => [...prev, item]);
      setSelectedId(item.id);
    } finally {
      setCreating(false);
    }
  }, [base]);

  const remove = React.useCallback(
    async (id: string) => {
      setItems((prev) => {
        const next = prev.filter((c) => c.id !== id);
        if (selectedId === id) setSelectedId(next[0]?.id ?? null);
        return next;
      });
      await fetch(`${base}/${id}`, { method: "DELETE" });
    },
    [base, selectedId]
  );

  if (loading) {
    return <Loader2 className="size-4 animate-spin text-muted-foreground" />;
  }

  const budgetPct =
    selected && selected.budgetPlan
      ? Math.min(100, Math.round(((selected.budgetSpent ?? 0) / selected.budgetPlan) * 100))
      : 0;

  return (
    <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
      {/* Lista */}
      <div className="space-y-2">
        <Button type="button" size="sm" className="w-full" onClick={() => void add()} disabled={creating}>
          {creating ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
          Dodaj kampanię
        </Button>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Brak kampanii.</p>
        ) : (
          <ul className="space-y-1">
            {items.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(c.id)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-lg border px-2.5 py-2 text-left transition-colors",
                    selectedId === c.id
                      ? "border-brand/40 bg-brand/5"
                      : "border-transparent hover:bg-muted/50"
                  )}
                >
                  <Megaphone className="size-3.5 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate text-xs font-medium">{c.name}</span>
                  {c.stage && (
                    <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                      {c.stage}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Edytor */}
      {!selected ? (
        <div className="flex items-center justify-center rounded-xl border border-dashed border-border p-8 text-sm text-muted-foreground">
          Wybierz lub dodaj kampanię.
        </div>
      ) : (
        <div className="space-y-5 rounded-xl border border-border bg-card/40 p-5">
          <div className="flex items-start gap-3">
            <Input
              value={selected.name}
              onChange={(e) => update(selected.id, { name: e.target.value }, 600)}
              className="text-base font-medium"
              placeholder="Nazwa kampanii"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-9 shrink-0 text-muted-foreground hover:text-destructive"
              onClick={() => void remove(selected.id)}
              aria-label="Usuń kampanię"
            >
              <Trash2 className="size-4" />
            </Button>
          </div>

          <Field label="Cel">
            <Textarea
              value={selected.goal ?? ""}
              onChange={(e) => update(selected.id, { goal: e.target.value }, 600)}
              rows={2}
              className="resize-none text-sm"
              placeholder="Co kampania ma osiągnąć?"
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Segment">
              <RelationPicker
                projectId={projectId}
                entityType="segment"
                cardinality="single"
                value={selected.segmentId}
                onChange={(v) => update(selected.id, { segmentId: typeof v === "string" ? v : null })}
                placeholder="Przypisz segment"
              />
            </Field>
            <Field label="Landing page">
              <RelationPicker
                projectId={projectId}
                entityType="page"
                cardinality="single"
                value={selected.landingPageId}
                onChange={(v) => update(selected.id, { landingPageId: typeof v === "string" ? v : null })}
                placeholder="Strona docelowa"
              />
            </Field>
            <Field label="Etap lejka">
              <select
                value={selected.stage ?? ""}
                onChange={(e) => update(selected.id, { stage: e.target.value || null })}
                className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
              >
                <option value="">—</option>
                {STAGES.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </Field>
            <Field label="Status">
              <select
                value={selected.status ?? "planned"}
                onChange={(e) => update(selected.id, { status: e.target.value })}
                className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
              >
                {STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </Field>
          </div>

          <Field label="Kanały">
            <RelationPicker
              projectId={projectId}
              entityType="channel"
              cardinality="multi"
              value={(selected.channels ?? []).map((c) => c.channelId)}
              onChange={(v) => {
                const ids = Array.isArray(v) ? v : [];
                update(selected.id, { channels: ids.map((id) => ({ channelId: id })) });
              }}
              placeholder="+ Dodaj kanał"
            />
          </Field>

          {/* Budżet */}
          <Field label="Budżet (PLN)">
            <div className="flex items-center gap-3">
              <Input
                type="number"
                value={selected.budgetPlan ?? ""}
                onChange={(e) =>
                  update(selected.id, { budgetPlan: e.target.value ? Number(e.target.value) : null }, 600)
                }
                placeholder="Plan"
                className="w-32 text-sm"
              />
              <span className="text-muted-foreground">/</span>
              <Input
                type="number"
                value={selected.budgetSpent ?? ""}
                onChange={(e) =>
                  update(selected.id, { budgetSpent: e.target.value ? Number(e.target.value) : null }, 600)
                }
                placeholder="Wydano"
                className="w-32 text-sm"
              />
              <div className="flex-1">
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all",
                      budgetPct >= 100 ? "bg-destructive" : "bg-brand"
                    )}
                    style={{ width: `${budgetPct}%` }}
                  />
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground tabular-nums">{budgetPct}% budżetu</p>
              </div>
            </div>
          </Field>

          {/* Okres */}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Start">
              <Input
                type="date"
                value={toDateInput(selected.periodStart)}
                onChange={(e) => update(selected.id, { periodStart: e.target.value || null })}
                className="text-sm"
              />
            </Field>
            <Field label="Koniec">
              <Input
                type="date"
                value={toDateInput(selected.periodEnd)}
                onChange={(e) => update(selected.id, { periodEnd: e.target.value || null })}
                className="text-sm"
              />
            </Field>
          </div>

          {/* UTM */}
          <Field label="UTM">
            <div className="grid gap-2 sm:grid-cols-3">
              {(["source", "medium", "campaign", "term", "content"] as const).map((k) => (
                <Input
                  key={k}
                  value={selected.utm?.[k] ?? ""}
                  onChange={(e) =>
                    update(selected.id, { utm: { ...(selected.utm ?? {}), [k]: e.target.value } }, 600)
                  }
                  placeholder={`utm_${k}`}
                  className="text-sm"
                />
              ))}
            </div>
          </Field>

          {/* Kreacje */}
          <Field label="Kreacje (linki)">
            <CreativesEditor
              creatives={selected.creatives ?? []}
              onChange={(next) => update(selected.id, { creatives: next }, 600)}
            />
          </Field>

          {/* Komentarze / timeline */}
          <div className="border-t border-border pt-4">
            <EntityMetaPanel projectId={projectId} entityType="campaign" entityId={selected.id} />
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-[11px] font-medium text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}

function CreativesEditor({
  creatives,
  onChange,
}: {
  creatives: Creative[];
  onChange: (next: Creative[]) => void;
}) {
  return (
    <div className="space-y-2">
      {creatives.map((c, i) => (
        <div key={i} className="flex items-center gap-2">
          <Link2 className="size-3.5 shrink-0 text-muted-foreground" />
          <Input
            value={c.label ?? ""}
            onChange={(e) => {
              const next = [...creatives];
              next[i] = { ...c, label: e.target.value };
              onChange(next);
            }}
            placeholder="Etykieta"
            className="w-36 text-sm"
          />
          <Input
            value={c.url ?? ""}
            onChange={(e) => {
              const next = [...creatives];
              next[i] = { ...c, url: e.target.value };
              onChange(next);
            }}
            placeholder="https://…"
            className="flex-1 text-sm"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 text-muted-foreground hover:text-destructive"
            onClick={() => onChange(creatives.filter((_, j) => j !== i))}
            aria-label="Usuń kreację"
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => onChange([...creatives, { label: "", url: "" }])}
      >
        <Plus className="size-3.5" />
        Dodaj kreację
      </Button>
    </div>
  );
}
