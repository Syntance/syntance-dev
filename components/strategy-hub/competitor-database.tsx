"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ExternalLink, Loader2, Plus, Trash2, TrendingDown, TrendingUp, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/strategy-hub/api-fetch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

/**
 * Baza konkurentów — konfigurator, nie raport. Tabela to lista rekordów
 * z kolumnami-kategoriami; klik w wiersz otwiera pełną kartę do edycji.
 * Werdykt cenowy jest jedynym polem klikalnym wprost w tabeli — reszta
 * wymaga otwarcia karty, bo to długi tekst, nie jedna decyzja.
 */

export interface CompetitorDbRow {
  id: string;
  name: string;
  url: string | null;
  type: string;
  location: string | null;
  specialization: string | null;
  strengthsMd: string | null;
  weaknessesMd: string | null;
  pricingMd: string | null;
  channelsMd: string | null;
  notesMd: string | null;
  ourEdgeMd: string | null;
  priceComparison: string | null;
}

interface CompetitorDatabaseProps {
  projectId: string;
  foundationInherited: boolean;
  foundationSourceName: string | null;
}

type CompetitorType = "direct" | "indirect" | "none";

const TYPE_LABELS: Record<CompetitorType, string> = {
  direct: "Bezpośredni",
  indirect: "Pośredni",
  none: "Substytut",
};

const TYPE_DOT: Record<CompetitorType, string> = {
  direct: "bg-destructive",
  indirect: "bg-amber-500",
  none: "bg-muted-foreground",
};

function asType(t: string): CompetitorType {
  return t === "direct" || t === "indirect" || t === "none" ? t : "direct";
}

const PRICE_OPTIONS: {
  value: "cheaper" | "similar" | "more_expensive";
  label: string;
  icon: typeof TrendingDown;
  activeClass: string;
}[] = [
  {
    value: "cheaper",
    label: "Tańsza",
    icon: TrendingDown,
    activeClass: "border-emerald-500/50 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  },
  {
    value: "similar",
    label: "Neutralna",
    icon: Minus,
    activeClass: "border-border bg-muted text-foreground",
  },
  {
    value: "more_expensive",
    label: "Droższa",
    icon: TrendingUp,
    activeClass: "border-destructive/50 bg-destructive/10 text-destructive",
  },
];

function emptyRow(): CompetitorDbRow {
  return {
    id: "",
    name: "",
    url: null,
    type: "direct",
    location: null,
    specialization: null,
    strengthsMd: null,
    weaknessesMd: null,
    pricingMd: null,
    channelsMd: null,
    notesMd: null,
    ourEdgeMd: null,
    priceComparison: null,
  };
}

export function CompetitorDatabase({
  projectId,
  foundationInherited,
  foundationSourceName,
}: CompetitorDatabaseProps) {
  const [items, setItems] = useState<CompetitorDbRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [adding, setAdding] = useState(false);

  const load = useCallback((signal?: AbortSignal) => {
    apiFetch<{ items: CompetitorDbRow[] }>(
      `/api/strategy-hub/projects/${projectId}/competitors`,
      { signal, silent: true }
    )
      .then((data) => setItems(data.items ?? []))
      .catch(() => {
        if (!signal?.aborted) setItems([]);
      })
      .finally(() => {
        if (!signal?.aborted) setLoading(false);
      });
  }, [projectId]);

  useEffect(() => {
    const ctrl = new AbortController();
    load(ctrl.signal);
    return () => ctrl.abort();
  }, [load]);

  const openItem = useMemo(
    () => items.find((i) => i.id === openId) ?? null,
    [items, openId]
  );

  async function handleAdd() {
    const name = draftName.trim();
    if (!name) return;
    setAdding(true);
    try {
      const res = await apiFetch<{ item: CompetitorDbRow }>(
        `/api/strategy-hub/projects/${projectId}/competitors`,
        { method: "POST", json: { name } }
      );
      setItems((prev) => [...prev, res.item]);
      setDraftName("");
      // Od razu otwieramy kartę — dodanie wiersza to dopiero nazwa,
      // reszta kategorii i tak wymaga karty.
      setOpenId(res.item.id);
    } catch {
      // apiFetch pokazał już toast.
    } finally {
      setAdding(false);
    }
  }

  async function handlePatch(id: string, patch: Partial<CompetitorDbRow>) {
    // Optymistycznie od razu w UI — werdykt cenowy ma być błyskawiczny do klikania.
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));
    try {
      await apiFetch(`/api/strategy-hub/projects/${projectId}/competitors/${id}`, {
        method: "PATCH",
        json: patch,
      });
    } catch {
      // Błąd (np. 409 przy dziedziczeniu) — cofamy optymistyczną zmianę odświeżeniem.
      load();
    }
  }

  async function handleDelete(id: string) {
    setItems((prev) => prev.filter((i) => i.id !== id));
    setOpenId((cur) => (cur === id ? null : cur));
    try {
      await apiFetch(`/api/strategy-hub/projects/${projectId}/competitors/${id}`, {
        method: "DELETE",
      });
    } catch {
      load();
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center rounded-xl border border-border bg-card py-16">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {foundationInherited && (
        <p className="rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
          Baza konkurentów pochodzi z projektu
          {foundationSourceName ? (
            <>
              {" "}
              <strong>{foundationSourceName}</strong>
            </>
          ) : (
            " nadrzędnego"
          )}{" "}
          — edycja wymaga odłączenia fundamentu w Ustawieniach projektu → Ogólne.
        </p>
      )}

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[64rem] border-collapse text-xs">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-left">
              <th className="p-3 font-medium">Konkurent</th>
              <th className="p-3 font-medium">Typ</th>
              <th className="p-3 font-medium">Lokalizacja</th>
              <th className="p-3 font-medium">Specjalizacja</th>
              <th className="p-3 font-medium">Cena vs. nasza</th>
              <th className="p-3 font-medium">Nasz wyróżnik</th>
              {!foundationInherited && <th className="w-9 p-3" />}
            </tr>
          </thead>
          <tbody>
            {items.map((c) => {
              const type = asType(c.type);
              return (
                <tr
                  key={c.id}
                  className="border-b border-border last:border-0 transition-colors hover:bg-muted/30"
                >
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setOpenId(c.id)}
                        className="font-medium underline-offset-2 hover:text-brand hover:underline"
                      >
                        {c.name}
                      </button>
                      {c.url && (
                        <a
                          href={c.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-muted-foreground hover:text-brand"
                          aria-label={`Otwórz stronę ${c.name}`}
                        >
                          <ExternalLink className="size-3" />
                        </a>
                      )}
                    </div>
                  </td>
                  <td className="p-3">
                    <span className="inline-flex items-center gap-1.5">
                      <span
                        aria-hidden
                        className={cn("size-1.5 rounded-full", TYPE_DOT[type])}
                      />
                      {TYPE_LABELS[type]}
                    </span>
                  </td>
                  <td className="p-3 text-muted-foreground">
                    {c.location ?? "—"}
                  </td>
                  <td className="p-3 text-muted-foreground">
                    {c.specialization ?? "—"}
                  </td>
                  <td className="p-3">
                    <div className="flex gap-1">
                      {PRICE_OPTIONS.map((opt) => {
                        const active = c.priceComparison === opt.value;
                        const Icon = opt.icon;
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            disabled={foundationInherited}
                            title={opt.label}
                            aria-pressed={active}
                            onClick={() =>
                              handlePatch(c.id, {
                                priceComparison: active ? null : opt.value,
                              })
                            }
                            className={cn(
                              "flex size-6 items-center justify-center rounded-md border transition-colors disabled:cursor-not-allowed disabled:opacity-40",
                              active
                                ? opt.activeClass
                                : "border-border text-muted-foreground/50 hover:text-foreground"
                            )}
                          >
                            <Icon className="size-3.5" />
                          </button>
                        );
                      })}
                    </div>
                  </td>
                  <td className="max-w-[16rem] p-3 text-muted-foreground">
                    <span className="line-clamp-1">{c.ourEdgeMd ?? "—"}</span>
                  </td>
                  {!foundationInherited && (
                    <td className="p-3">
                      <button
                        type="button"
                        onClick={() => handleDelete(c.id)}
                        aria-label={`Usuń ${c.name}`}
                        className="text-muted-foreground/60 transition-colors hover:text-destructive"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </td>
                  )}
                </tr>
              );
            })}

            {items.length === 0 && (
              <tr>
                <td
                  colSpan={foundationInherited ? 6 : 7}
                  className="p-8 text-center text-muted-foreground"
                >
                  Brak konkurentów. Dodaj pierwszego poniżej.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {!foundationInherited && (
        <div className="flex items-center gap-2">
          <Input
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleAdd();
              }
            }}
            placeholder="Nazwa nowego konkurenta…"
            className="h-8 max-w-xs text-xs"
            disabled={adding}
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={handleAdd}
            disabled={!draftName.trim() || adding}
            className="h-8 gap-1.5 text-xs"
          >
            {adding ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Plus className="size-3.5" />
            )}
            Dodaj konkurenta
          </Button>
        </div>
      )}

      <CompetitorSheet
        item={openItem}
        readOnly={foundationInherited}
        onClose={() => setOpenId(null)}
        onSave={(patch) => openItem && handlePatch(openItem.id, patch)}
        onDelete={() => openItem && handleDelete(openItem.id)}
      />
    </div>
  );
}

function CompetitorSheet({
  item,
  readOnly,
  onClose,
  onSave,
  onDelete,
}: {
  item: CompetitorDbRow | null;
  readOnly: boolean;
  onClose: () => void;
  onSave: (patch: Partial<CompetitorDbRow>) => void;
  onDelete: () => void;
}) {
  const [draft, setDraft] = useState<CompetitorDbRow>(emptyRow());

  // Sync ze źródłem przy zmianie otwartego konkurenta — bez efektu (React 19).
  const [prevId, setPrevId] = useState(item?.id ?? null);
  if ((item?.id ?? null) !== prevId) {
    setPrevId(item?.id ?? null);
    setDraft(item ?? emptyRow());
  }

  function patch<K extends keyof CompetitorDbRow>(key: K, value: CompetitorDbRow[K]) {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }

  // Debounce zapisu tekstowych pól — jedno wywołanie API na przerwę w pisaniu,
  // nie na każdy znak. Ten sam wzorzec co CompetitorsEditor.
  const [timer, setTimer] = useState<ReturnType<typeof setTimeout> | null>(null);
  function debouncedSave(patchObj: Partial<CompetitorDbRow>) {
    if (timer) clearTimeout(timer);
    setTimer(setTimeout(() => onSave(patchObj), 500));
  }

  const type = asType(draft.type);

  return (
    <Sheet open={item !== null} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 overflow-y-auto p-0 sm:max-w-[520px]">
        <SheetHeader className="flex shrink-0 flex-row items-center justify-between border-b px-5 pb-3 pt-5">
          <div className="flex min-w-0 items-center gap-2">
            <span className={cn("size-2 shrink-0 rounded-full", TYPE_DOT[type])} />
            <SheetTitle className="truncate text-base font-semibold">
              {draft.name || "Konkurent"}
            </SheetTitle>
          </div>
          {!readOnly && (
            <button
              type="button"
              onClick={onDelete}
              aria-label="Usuń konkurenta"
              className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2 className="size-4" />
            </button>
          )}
        </SheetHeader>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Nazwa">
              <Input
                value={draft.name}
                disabled={readOnly}
                onChange={(e) => {
                  patch("name", e.target.value);
                  debouncedSave({ name: e.target.value });
                }}
                className="h-8 text-sm"
              />
            </Field>
            <Field label="Typ">
              <select
                value={type}
                disabled={readOnly}
                onChange={(e) => {
                  patch("type", e.target.value);
                  onSave({ type: e.target.value });
                }}
                className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
              >
                <option value="direct">Bezpośredni</option>
                <option value="indirect">Pośredni</option>
                <option value="none">Substytut</option>
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="URL">
              <Input
                value={draft.url ?? ""}
                disabled={readOnly}
                onChange={(e) => {
                  patch("url", e.target.value || null);
                  debouncedSave({ url: e.target.value || null });
                }}
                placeholder="https://…"
                className="h-8 text-sm"
              />
            </Field>
            <Field label="Lokalizacja">
              <Input
                value={draft.location ?? ""}
                disabled={readOnly}
                onChange={(e) => {
                  patch("location", e.target.value || null);
                  debouncedSave({ location: e.target.value || null });
                }}
                placeholder="np. Warszawa, ogólnopolski…"
                className="h-8 text-sm"
              />
            </Field>
          </div>

          <Field label="Specjalizacja">
            <Input
              value={draft.specialization ?? ""}
              disabled={readOnly}
              onChange={(e) => {
                patch("specialization", e.target.value || null);
                debouncedSave({ specialization: e.target.value || null });
              }}
              placeholder="np. SEO dla e-commerce…"
              className="h-8 text-sm"
            />
          </Field>

          <Field label="Cena względem naszej">
            <div className="flex gap-1.5">
              {PRICE_OPTIONS.map((opt) => {
                const active = draft.priceComparison === opt.value;
                const Icon = opt.icon;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    disabled={readOnly}
                    aria-pressed={active}
                    onClick={() => {
                      const next = active ? null : opt.value;
                      patch("priceComparison", next);
                      onSave({ priceComparison: next });
                    }}
                    className={cn(
                      "flex flex-1 items-center justify-center gap-1.5 rounded-md border py-1.5 text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-40",
                      active
                        ? opt.activeClass
                        : "border-border text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <Icon className="size-3.5" />
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </Field>

          <Field label="Nasz wyróżnik względem tego konkurenta">
            <Textarea
              value={draft.ourEdgeMd ?? ""}
              disabled={readOnly}
              onChange={(e) => {
                patch("ourEdgeMd", e.target.value || null);
                debouncedSave({ ourEdgeMd: e.target.value || null });
              }}
              placeholder="Czym górujemy nad tym konkretnym konkurentem…"
              className="min-h-16 resize-none text-sm"
            />
          </Field>

          <Field label="Mocne strony">
            <Textarea
              value={draft.strengthsMd ?? ""}
              disabled={readOnly}
              onChange={(e) => {
                patch("strengthsMd", e.target.value || null);
                debouncedSave({ strengthsMd: e.target.value || null });
              }}
              className="min-h-16 resize-none text-sm"
            />
          </Field>

          <Field label="Słabe strony">
            <Textarea
              value={draft.weaknessesMd ?? ""}
              disabled={readOnly}
              onChange={(e) => {
                patch("weaknessesMd", e.target.value || null);
                debouncedSave({ weaknessesMd: e.target.value || null });
              }}
              className="min-h-16 resize-none text-sm"
            />
          </Field>

          <Field label="Cennik (opis)">
            <Textarea
              value={draft.pricingMd ?? ""}
              disabled={readOnly}
              onChange={(e) => {
                patch("pricingMd", e.target.value || null);
                debouncedSave({ pricingMd: e.target.value || null });
              }}
              className="min-h-16 resize-none text-sm"
            />
          </Field>

          <Field label="Kanały">
            <Textarea
              value={draft.channelsMd ?? ""}
              disabled={readOnly}
              onChange={(e) => {
                patch("channelsMd", e.target.value || null);
                debouncedSave({ channelsMd: e.target.value || null });
              }}
              className="min-h-16 resize-none text-sm"
            />
          </Field>

          <Field label="Notatki">
            <Textarea
              value={draft.notesMd ?? ""}
              disabled={readOnly}
              onChange={(e) => {
                patch("notesMd", e.target.value || null);
                debouncedSave({ notesMd: e.target.value || null });
              }}
              className="min-h-16 resize-none text-sm"
            />
          </Field>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
