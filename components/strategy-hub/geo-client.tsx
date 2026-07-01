"use client";

import * as React from "react";
import {
  Plus,
  Trash2,
  Loader2,
  Check,
  FileCode2,
  Bot,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

// ─── Typy ──────────────────────────────────────────────────────────────────

interface ChecklistEntry {
  label: string;
  done: boolean;
}

interface GeoAsset {
  id: string;
  type: string;
  status: string | null;
  notesMd: string | null;
  checklist: ChecklistEntry[] | null;
}

interface GeoQuery {
  id: string;
  query: string;
  intent: string | null;
  stage: string | null;
  status: string | null;
  citationStatus: Record<string, string> | null;
}

const ASSET_TYPES = [
  { value: "llms_txt", label: "llms.txt" },
  { value: "schema_jsonld", label: "Schema JSON-LD" },
  { value: "answer_page", label: "Answer page" },
  { value: "faq", label: "FAQ" },
] as const;

const ASSET_STATUS = [
  { value: "todo", label: "Do zrobienia", tone: "warning" },
  { value: "in_progress", label: "W toku", tone: "info" },
  { value: "done", label: "Gotowe", tone: "success" },
] as const;

/** Domyślne pozycje checklisty AEO per typ assetu. */
const CHECKLIST_TEMPLATES: Record<string, string[]> = {
  llms_txt: [
    "Plik /llms.txt opublikowany",
    "Link w robots.txt",
    "Sekcje produktów / usług",
    "Aktualizowany po zmianach",
  ],
  schema_jsonld: [
    "JSON-LD Organization",
    "JSON-LD Product / Service",
    "JSON-LD FAQ",
    "Walidacja w Rich Results Test",
  ],
  answer_page: [
    "H1 = pytanie użytkownika",
    "Odpowiedź w pierwszym akapicie",
    "Nagłówki H2 z wariantami pytań",
    "Dane / źródła liczbowane",
  ],
  faq: [
    "Min. 5 pytań",
    "Markup FAQPage",
    "Naturalny język pytań",
    "Zwięzłe odpowiedzi",
  ],
};

const ENGINES = [
  { key: "chatgpt", label: "ChatGPT" },
  { key: "perplexity", label: "Perplexity" },
  { key: "ai_overview", label: "AI Overview" },
] as const;

const CITATION_CYCLE = ["not_checked", "cited", "missing"] as const;
const CITATION_META: Record<string, { label: string; cls: string }> = {
  not_checked: { label: "—", cls: "bg-muted text-muted-foreground border-border" },
  cited: { label: "Cytowany", cls: "bg-success/15 text-success border-success/30" },
  missing: { label: "Brak", cls: "bg-destructive/15 text-destructive border-destructive/30" },
};

// ─── Assety GEO ──────────────────────────────────────────────────────────────

export function GeoAssetsClient({ projectId }: { projectId: string }) {
  const base = `/api/strategy-hub/projects/${projectId}/geo-assets`;
  const [items, setItems] = React.useState<GeoAsset[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [creating, setCreating] = React.useState(false);
  const timers = React.useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  React.useEffect(() => {
    let cancelled = false;
    fetch(base, { signal: AbortSignal.timeout(8000) })
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((j: { items?: GeoAsset[] }) => {
        if (!cancelled) setItems(j.items ?? []);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [base]);

  const persist = React.useCallback(
    (id: string, patch: Partial<GeoAsset>, debounce = 0) => {
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
    (id: string, patch: Partial<GeoAsset>, debounce = 0) => {
      setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
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
        body: JSON.stringify({ type: "answer_page", status: "todo" }),
      });
      if (!res.ok) return;
      const { item } = (await res.json()) as { item: GeoAsset };
      setItems((prev) => [...prev, item]);
    } finally {
      setCreating(false);
    }
  }, [base]);

  const remove = React.useCallback(
    async (id: string) => {
      setItems((prev) => prev.filter((it) => it.id !== id));
      await fetch(`${base}/${id}`, { method: "DELETE" });
    },
    [base]
  );

  const toggleChecklist = React.useCallback(
    (asset: GeoAsset, label: string) => {
      const template = CHECKLIST_TEMPLATES[asset.type] ?? [];
      const current = new Map(
        (asset.checklist ?? []).map((c) => [c.label, c.done])
      );
      const merged: ChecklistEntry[] = template.map((l) => ({
        label: l,
        done: l === label ? !(current.get(l) ?? false) : current.get(l) ?? false,
      }));
      update(asset.id, { checklist: merged }, 0);
    },
    [update]
  );

  if (loading) {
    return <Loader2 className="size-4 animate-spin text-muted-foreground" />;
  }

  return (
    <div className="space-y-3">
      <Button type="button" size="sm" onClick={() => void add()} disabled={creating}>
        {creating ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
        Dodaj asset
      </Button>

      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Brak assetów GEO.</p>
      ) : (
        <div className="space-y-3">
          {items.map((asset) => {
            const template = CHECKLIST_TEMPLATES[asset.type] ?? [];
            const doneMap = new Map(
              (asset.checklist ?? []).map((c) => [c.label, c.done])
            );
            const doneCount = template.filter((l) => doneMap.get(l)).length;
            return (
              <div
                key={asset.id}
                className="rounded-xl border border-border bg-card/40 p-4 space-y-3"
              >
                <div className="flex flex-wrap items-center gap-3">
                  <FileCode2 className="size-4 text-brand" />
                  <select
                    value={asset.type}
                    onChange={(e) => {
                      update(asset.id, { type: e.target.value, checklist: [] }, 0);
                    }}
                    className="h-8 rounded-md border border-border bg-background px-2 text-sm"
                  >
                    {ASSET_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                  <select
                    value={asset.status ?? "todo"}
                    onChange={(e) => update(asset.id, { status: e.target.value }, 0)}
                    className="h-8 rounded-md border border-border bg-background px-2 text-sm"
                  >
                    {ASSET_STATUS.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                  <span className="text-xs text-muted-foreground">
                    {doneCount}/{template.length} checklisty
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="ml-auto size-8 text-muted-foreground hover:text-destructive"
                    onClick={() => void remove(asset.id)}
                    aria-label="Usuń asset"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>

                <ul className="grid gap-1.5 sm:grid-cols-2">
                  {template.map((label) => {
                    const done = doneMap.get(label) ?? false;
                    return (
                      <li key={label}>
                        <button
                          type="button"
                          onClick={() => toggleChecklist(asset, label)}
                          className="flex w-full items-center gap-2 rounded-md border border-border/60 px-2.5 py-1.5 text-left text-xs transition-colors hover:border-brand/40"
                        >
                          <span
                            className={cn(
                              "flex size-4 shrink-0 items-center justify-center rounded border",
                              done
                                ? "border-success bg-success/20 text-success"
                                : "border-border text-transparent"
                            )}
                          >
                            <Check className="size-3" />
                          </span>
                          <span className={cn(done && "text-muted-foreground line-through")}>
                            {label}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>

                <Textarea
                  value={asset.notesMd ?? ""}
                  onChange={(e) => update(asset.id, { notesMd: e.target.value }, 600)}
                  placeholder="Notatki…"
                  rows={2}
                  className="resize-none text-sm"
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Zapytania GEO + citation per silnik ─────────────────────────────────────

export function GeoQueriesClient({ projectId }: { projectId: string }) {
  const base = `/api/strategy-hub/projects/${projectId}/geo-queries`;
  const [items, setItems] = React.useState<GeoQuery[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [creating, setCreating] = React.useState(false);
  const timers = React.useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  React.useEffect(() => {
    let cancelled = false;
    fetch(base, { signal: AbortSignal.timeout(8000) })
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((j: { items?: GeoQuery[] }) => {
        if (!cancelled) setItems(j.items ?? []);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [base]);

  const persist = React.useCallback(
    (id: string, patch: Partial<GeoQuery>, debounce = 0) => {
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
    (id: string, patch: Partial<GeoQuery>, debounce = 0) => {
      setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
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
        body: JSON.stringify({ query: "Nowe zapytanie", status: "monitoring" }),
      });
      if (!res.ok) return;
      const { item } = (await res.json()) as { item: GeoQuery };
      setItems((prev) => [...prev, item]);
    } finally {
      setCreating(false);
    }
  }, [base]);

  const remove = React.useCallback(
    async (id: string) => {
      setItems((prev) => prev.filter((it) => it.id !== id));
      await fetch(`${base}/${id}`, { method: "DELETE" });
    },
    [base]
  );

  const cycleCitation = React.useCallback(
    (q: GeoQuery, engine: string) => {
      const current = (q.citationStatus ?? {})[engine] ?? "not_checked";
      const idx = CITATION_CYCLE.indexOf(current as (typeof CITATION_CYCLE)[number]);
      const next = CITATION_CYCLE[(idx + 1) % CITATION_CYCLE.length];
      const merged = { ...(q.citationStatus ?? {}), [engine]: next };
      update(q.id, { citationStatus: merged }, 0);
    },
    [update]
  );

  if (loading) {
    return <Loader2 className="size-4 animate-spin text-muted-foreground" />;
  }

  return (
    <div className="space-y-3">
      <Button type="button" size="sm" onClick={() => void add()} disabled={creating}>
        {creating ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
        Dodaj zapytanie
      </Button>

      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Brak zapytań GEO.</p>
      ) : (
        <div className="space-y-3">
          {items.map((q) => (
            <div
              key={q.id}
              className="rounded-xl border border-border bg-card/40 p-4 space-y-3"
            >
              <div className="flex items-start gap-3">
                <Bot className="mt-2 size-4 shrink-0 text-brand" />
                <div className="min-w-0 flex-1 space-y-2">
                  <Input
                    value={q.query}
                    onChange={(e) => update(q.id, { query: e.target.value }, 600)}
                    placeholder="Pytanie zadawane AI…"
                    className="text-sm"
                  />
                  <div className="flex flex-wrap gap-2">
                    <Input
                      value={q.intent ?? ""}
                      onChange={(e) => update(q.id, { intent: e.target.value }, 600)}
                      placeholder="Intencja"
                      className="h-8 w-40 text-sm"
                    />
                    <select
                      value={q.stage ?? ""}
                      onChange={(e) => update(q.id, { stage: e.target.value || null }, 0)}
                      className="h-8 rounded-md border border-border bg-background px-2 text-sm"
                    >
                      <option value="">faza —</option>
                      <option value="TOFU">TOFU</option>
                      <option value="MOFU">MOFU</option>
                      <option value="BOFU">BOFU</option>
                    </select>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8 text-muted-foreground hover:text-destructive"
                  onClick={() => void remove(q.id)}
                  aria-label="Usuń zapytanie"
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>

              <div className="flex flex-wrap items-center gap-2 pl-7">
                <span className="text-[11px] text-muted-foreground">Cytowanie:</span>
                {ENGINES.map((e) => {
                  const st = (q.citationStatus ?? {})[e.key] ?? "not_checked";
                  const meta = CITATION_META[st] ?? CITATION_META.not_checked;
                  return (
                    <button
                      key={e.key}
                      type="button"
                      onClick={() => cycleCitation(q, e.key)}
                      className={cn(
                        "rounded-full border px-2 py-0.5 text-[11px] transition-colors",
                        meta.cls
                      )}
                      title="Kliknij, aby zmienić status"
                    >
                      {e.label}: {meta.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
