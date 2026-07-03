"use client";

import * as React from "react";
import {
  Plus,
  Trash2,
  Loader2,
  ArrowUp,
  ArrowDown,
  LayoutList,
  Send,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useUndoRedo } from "@/components/strategy-hub/undo-redo";

const FIELD_LABELS: Partial<Record<keyof PageSection, string>> = {
  name: "Nazwa sekcji",
  purposeMd: "Cel sekcji",
  schemaMd: "Schemat",
  copyMd: "Copy",
  ctaText: "CTA",
  ctaUrl: "URL CTA",
  designNotesMd: "Notatki designu",
};

export interface PageSection {
  id: string;
  name: string;
  orderIdx: number;
  purposeMd: string | null;
  schemaMd: string | null;
  copyMd: string | null;
  ctaText: string | null;
  ctaUrl: string | null;
  designNotesMd: string | null;
}

interface Props {
  projectId: string;
  pageId: string;
  pageLabel: string;
  mode?: "editor" | "client";
}

/**
 * Page Section Editor — split schema+live preview (Faza 5.6, M1).
 * Lewa kolumna: lista sekcji + formularz (cel/copy/schema/CTA/notatki designu).
 * Prawa kolumna: żywy podgląd wireframe generowany z `schemaMd` (jedna linia =
 * jeden blok), z realnym copy i przyciskiem CTA. „Wyślij do dev" tworzy zadanie
 * projektowe (`project_tasks`) powiązane z sekcją.
 */
export function PageSectionEditor({
  projectId,
  pageId,
  pageLabel,
  mode = "editor",
}: Props) {
  const isEditor = mode === "editor";
  const base = `/api/strategy-hub/projects/${projectId}/pages/${pageId}/sections`;
  const undoRedo = useUndoRedo();
  const [sections, setSections] = React.useState<PageSection[]>([]);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [creating, setCreating] = React.useState(false);
  const [sentDev, setSentDev] = React.useState<Set<string>>(new Set());
  const [sendingDev, setSendingDev] = React.useState(false);
  const timers = React.useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const load = React.useCallback(async () => {
    try {
      const res = await fetch(base, { signal: AbortSignal.timeout(8000) });
      const j = (await res.json()) as { items: PageSection[] };
      const items = (j.items ?? []).sort((a, b) => a.orderIdx - b.orderIdx);
      setSections(items);
      setSelectedId((cur) => cur ?? items[0]?.id ?? null);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [base]);

  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount, unavoidable
    void load();
  }, [load]);

  const selected = sections.find((s) => s.id === selectedId) ?? null;

  const patchLocal = (id: string, patch: Partial<PageSection>) => {
    setSections((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  };

  const commitField = async (id: string, field: keyof PageSection, value: unknown) => {
    try {
      await fetch(`${base}/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value }),
      });
    } catch {
      /* best-effort */
    }
  };

  /** Inline edit z autosave (300ms debounce) + wpis do sesyjnego undo/redo (⌘Z/⌘⇧Z, Faza 7). */
  const saveField = (id: string, field: keyof PageSection, value: unknown, debounce = 300) => {
    const before = sections.find((s) => s.id === id)?.[field] ?? null;
    patchLocal(id, { [field]: value } as Partial<PageSection>);
    const key = `${id}:${field}`;
    const existing = timers.current.get(key);
    if (existing) clearTimeout(existing);
    const t = setTimeout(async () => {
      await commitField(id, field, value);
      if (before !== value) {
        undoRedo.push({
          label: FIELD_LABELS[field] ?? String(field),
          undo: async () => {
            patchLocal(id, { [field]: before } as Partial<PageSection>);
            await commitField(id, field, before);
          },
          redo: async () => {
            patchLocal(id, { [field]: value } as Partial<PageSection>);
            await commitField(id, field, value);
          },
        });
      }
    }, debounce);
    timers.current.set(key, t);
  };

  const addSection = async () => {
    setCreating(true);
    try {
      const res = await fetch(base, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Nowa sekcja", orderIdx: sections.length }),
      });
      if (!res.ok) return;
      const { item } = (await res.json()) as { item: PageSection };
      setSections((prev) => [...prev, item]);
      setSelectedId(item.id);
    } finally {
      setCreating(false);
    }
  };

  const removeSection = async (id: string) => {
    setSections((prev) => prev.filter((s) => s.id !== id));
    if (selectedId === id) setSelectedId(null);
    try {
      await fetch(`${base}/${id}`, { method: "DELETE" });
    } catch {
      /* best-effort */
    }
  };

  const move = (id: string, dir: -1 | 1) => {
    const sorted = [...sections].sort((a, b) => a.orderIdx - b.orderIdx);
    const idx = sorted.findIndex((s) => s.id === id);
    const swapIdx = idx + dir;
    if (idx < 0 || swapIdx < 0 || swapIdx >= sorted.length) return;
    const a = sorted[idx];
    const b = sorted[swapIdx];
    const aOrder = b.orderIdx;
    const bOrder = a.orderIdx;
    patchLocal(a.id, { orderIdx: aOrder });
    patchLocal(b.id, { orderIdx: bOrder });
    saveField(a.id, "orderIdx", aOrder, 0);
    saveField(b.id, "orderIdx", bOrder, 0);
  };

  const sendToDev = async (section: PageSection) => {
    setSendingDev(true);
    try {
      const desc = [
        `Sekcja „${section.name}" na stronie „${pageLabel}".`,
        section.purposeMd ? `**Cel:** ${section.purposeMd}` : null,
        section.schemaMd ? `**Struktura:**\n${section.schemaMd}` : null,
        section.copyMd ? `**Copy:**\n${section.copyMd}` : null,
        section.ctaText ? `**CTA:** ${section.ctaText} → ${section.ctaUrl ?? "?"}` : null,
        section.designNotesMd ? `**Notatki designu:** ${section.designNotesMd}` : null,
      ]
        .filter(Boolean)
        .join("\n\n");
      await fetch(`/api/strategy-hub/projects/${projectId}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `Wdrożenie sekcji: ${section.name}`,
          descriptionMd: desc,
          status: "todo",
          owner: "dev",
          priority: 2,
        }),
      });
      setSentDev((prev) => new Set(prev).add(section.id));
    } finally {
      setSendingDev(false);
    }
  };

  const blocks = (selected?.schemaMd ?? "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  return (
    <div className="grid gap-4 lg:grid-cols-[220px_1fr_1fr]">
      {/* Lista sekcji */}
      <div className="space-y-2">
        {loading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
          </div>
        ) : sections.length === 0 ? (
          <p className="text-xs text-muted-foreground">Brak sekcji na tej stronie.</p>
        ) : (
          <ul className="space-y-1">
            {[...sections]
              .sort((a, b) => a.orderIdx - b.orderIdx)
              .map((s, i) => (
                <li key={s.id} className="group flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setSelectedId(s.id)}
                    className={cn(
                      "flex-1 truncate rounded-lg border px-2.5 py-1.5 text-left text-xs font-medium transition-colors",
                      selectedId === s.id
                        ? "border-brand/40 bg-brand/5 text-foreground"
                        : "border-transparent text-muted-foreground hover:bg-muted/50"
                    )}
                  >
                    {i + 1}. {s.name}
                  </button>
                </li>
              ))}
          </ul>
        )}
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => void addSection()}
          disabled={creating || !isEditor}
          className={cn("h-8 w-full gap-1.5 text-xs", !isEditor && "hidden")}
        >
          {creating ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
          Dodaj sekcję
        </Button>
      </div>

      {!selected ? (
        <div className="col-span-2 flex items-center justify-center rounded-xl border border-dashed border-border py-12 text-sm text-muted-foreground">
          <LayoutList className="mr-2 size-4" /> Wybierz lub dodaj sekcję.
        </div>
      ) : (
        <>
          {/* Formularz */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              {isEditor ? (
                <Input
                  value={selected.name}
                  onChange={(e) => saveField(selected.id, "name", e.target.value)}
                  className="h-8 flex-1 text-sm font-semibold"
                />
              ) : (
                <h3 className="text-sm font-semibold flex-1">{selected.name}</h3>
              )}
              {isEditor && (
                <div className="flex shrink-0 items-center gap-0.5">
                  <IconBtn icon={ArrowUp} onClick={() => move(selected.id, -1)} label="Wyżej" />
                  <IconBtn icon={ArrowDown} onClick={() => move(selected.id, 1)} label="Niżej" />
                  <IconBtn icon={Trash2} danger onClick={() => void removeSection(selected.id)} label="Usuń" />
                </div>
              )}
            </div>

            {isEditor ? (
              <>
                <Field label="Cel sekcji" value={selected.purposeMd} rows={2}
                  onChange={(v) => saveField(selected.id, "purposeMd", v)} />
                <Field label="Copy" value={selected.copyMd} rows={4}
                  onChange={(v) => saveField(selected.id, "copyMd", v)} />
                <Field
                  label="Struktura / schema (1 blok = 1 linia)"
                  value={selected.schemaMd}
                  rows={4}
                  onChange={(v) => saveField(selected.id, "schemaMd", v)}
                  placeholder={"np.\nNagłówek + subheadline\n3 karty korzyści\nCTA button"}
                />
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label htmlFor="section-cta-text" className="text-[11px] font-medium text-muted-foreground">CTA — tekst</label>
                    <Input
                      id="section-cta-text"
                      value={selected.ctaText ?? ""}
                      onChange={(e) => saveField(selected.id, "ctaText", e.target.value)}
                      placeholder="np. Zamów teraz"
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <label htmlFor="section-cta-url" className="text-[11px] font-medium text-muted-foreground">CTA — URL</label>
                    <Input
                      id="section-cta-url"
                      value={selected.ctaUrl ?? ""}
                      onChange={(e) => saveField(selected.id, "ctaUrl", e.target.value)}
                      placeholder="/koszyk"
                      className="h-8 text-sm"
                    />
                  </div>
                </div>
                <Field label="Notatki designu" value={selected.designNotesMd} rows={2}
                  onChange={(v) => saveField(selected.id, "designNotesMd", v)} />
              </>
            ) : (
              <div className="space-y-3 text-sm">
                <ReadOnlyBlock label="Cel sekcji" value={selected.purposeMd} />
                <ReadOnlyBlock label="Copy" value={selected.copyMd} />
                <ReadOnlyBlock label="Struktura" value={selected.schemaMd} />
                <ReadOnlyBlock label="CTA" value={selected.ctaText ? `${selected.ctaText} → ${selected.ctaUrl ?? ""}` : null} />
                <ReadOnlyBlock label="Notatki designu" value={selected.designNotesMd} />
              </div>
            )}

            {isEditor && (
            <div className="border-t border-border pt-3">
              {sentDev.has(selected.id) ? (
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-success">
                  <Check className="size-3.5" /> Wysłano do dev jako zadanie
                </span>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  onClick={() => void sendToDev(selected)}
                  disabled={sendingDev}
                  className="h-8 gap-1.5 text-xs"
                >
                  {sendingDev ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Send className="size-3.5" />
                  )}
                  Wyślij do dev
                </Button>
              )}
            </div>
            )}
          </div>

          {/* Live preview */}
          <div className="space-y-2">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Podgląd na żywo
            </p>
            <div className="space-y-2 rounded-xl border border-border bg-muted/20 p-3">
              {selected.copyMd && (
                <p className="rounded-lg bg-card px-3 py-2 text-xs leading-relaxed text-foreground/90 border border-border/60">
                  {selected.copyMd}
                </p>
              )}
              {blocks.length === 0 ? (
                <p className="rounded-lg border border-dashed border-border py-6 text-center text-[11px] text-muted-foreground">
                  Opisz strukturę sekcji, żeby zobaczyć wireframe.
                </p>
              ) : (
                blocks.map((b, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-3 text-[11px] text-muted-foreground"
                  >
                    <span className="flex size-5 shrink-0 items-center justify-center rounded bg-muted text-[10px] font-medium text-foreground">
                      {i + 1}
                    </span>
                    {b}
                  </div>
                ))
              )}
              {selected.ctaText && (
                <div className="flex justify-center pt-1">
                  <span className="rounded-lg bg-brand px-4 py-2 text-xs font-medium text-white shadow-sm">
                    {selected.ctaText}
                  </span>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function ReadOnlyBlock({ label, value }: { label: string; value: string | null }) {
  if (!value?.trim()) return null;
  return (
    <div className="space-y-1">
      <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
      <p className="text-sm text-foreground/90 whitespace-pre-wrap">{value}</p>
    </div>
  );
}

function Field({
  label,
  value,
  rows,
  onChange,
  placeholder,
}: {
  label: string;
  value: string | null;
  rows: number;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1">
      <label className="text-[11px] font-medium text-muted-foreground">{label}</label>
      <Textarea
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        placeholder={placeholder}
        className="resize-none text-sm"
      />
    </div>
  );
}

function IconBtn({
  icon: Icon,
  onClick,
  danger,
  label,
}: {
  icon: React.ComponentType<{ className?: string }>;
  onClick: () => void;
  danger?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        "flex size-6 items-center justify-center rounded text-muted-foreground transition-colors",
        danger ? "hover:bg-destructive/10 hover:text-destructive" : "hover:bg-muted hover:text-foreground"
      )}
    >
      <Icon className="size-3.5" />
    </button>
  );
}
