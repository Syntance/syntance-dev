"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Loader2,
  Minus,
  Plus,
  Trash2,
  TrendingDown,
  TrendingUp,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/strategy-hub/api-fetch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * Baza konkurentów — konfigurator, nie raport. Tabela to lista rekordów
 * z kolumnami-kategoriami; klik w wiersz otwiera pełną kartę do edycji.
 * Werdykt cenowy jest jedynym stałym polem klikalnym wprost w tabeli — reszta
 * wymaga otwarcia karty, bo to długi tekst, nie jedna decyzja.
 *
 * Poza stałymi kategoriami użytkownik może dodać WŁASNE kolumny (konfigurator
 * jak w Notion/Airtable) — patrz `COLUMN_TYPE_LIBRARY`. Definicje kolumn są
 * wspólne dla projektu, wartości siedzą per wiersz w `customFields`.
 */

export type CustomFieldValue = string | number | boolean | null;

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
  customFields: Record<string, CustomFieldValue> | null;
}

export interface ColumnOption {
  value: string;
  label: string;
  color: string;
}

export type ColumnType =
  | "text"
  | "long_text"
  | "number"
  | "currency"
  | "url"
  | "checkbox"
  | "select";

export interface CompetitorColumn {
  id: string;
  key: string;
  label: string;
  type: ColumnType;
  options: ColumnOption[] | null;
  textColor: string | null;
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

/** Gotowa biblioteka typów kolumn — to jest konfigurator, nie jedno pole tekstowe. */
const COLUMN_TYPE_LIBRARY: {
  value: ColumnType;
  label: string;
  hint: string;
}[] = [
  { value: "text", label: "Tekst", hint: "krótka wartość, jedna linia" },
  { value: "long_text", label: "Długi tekst", hint: "opis, edytowany w karcie" },
  { value: "number", label: "Liczba", hint: "wartość liczbowa" },
  { value: "currency", label: "Kwota (PLN)", hint: "liczba z sufiksem „zł”" },
  { value: "url", label: "Link", hint: "adres z ikoną otwarcia" },
  { value: "checkbox", label: "Checkbox", hint: "tak / nie" },
  { value: "select", label: "Wybór jednokrotny", hint: "lista własnych opcji" },
];

/** Paleta kolorów opcji — nazwane klucze, nie dowolny hex, żeby Tailwind JIT je znalazł. */
const OPTION_COLORS: { value: string; label: string; className: string }[] = [
  { value: "gray", label: "Szary", className: "border-border bg-muted text-foreground" },
  {
    value: "red",
    label: "Czerwony",
    className: "border-destructive/40 bg-destructive/10 text-destructive",
  },
  {
    value: "amber",
    label: "Bursztynowy",
    className: "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400",
  },
  {
    value: "emerald",
    label: "Zielony",
    className:
      "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  },
  {
    value: "blue",
    label: "Niebieski",
    className: "border-blue-500/40 bg-blue-500/10 text-blue-600 dark:text-blue-400",
  },
  {
    value: "purple",
    label: "Fioletowy",
    className:
      "border-purple-500/40 bg-purple-500/10 text-purple-600 dark:text-purple-400",
  },
];

function optionClass(color: string): string {
  return (
    OPTION_COLORS.find((c) => c.value === color)?.className ??
    OPTION_COLORS[0].className
  );
}

/**
 * Kolor SAMEGO TEKSTU (bez tła/obramowania) dla kolumny — inny kontekst
 * wizualny niż `optionClass` (badge opcji `select`). Ta sama paleta,
 * `null`/nierozpoznany klucz = domyślny kolor tekstu (bez klasy).
 */
const TEXT_COLOR_CLASS: Record<string, string> = {
  gray: "text-foreground",
  red: "text-destructive",
  amber: "text-amber-600 dark:text-amber-400",
  emerald: "text-emerald-600 dark:text-emerald-400",
  blue: "text-blue-600 dark:text-blue-400",
  purple: "text-purple-600 dark:text-purple-400",
};

function textColorClass(color: string | null): string | undefined {
  return color ? TEXT_COLOR_CLASS[color] : undefined;
}

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
    customFields: null,
  };
}

export function CompetitorDatabase({
  projectId,
  foundationInherited,
  foundationSourceName,
}: CompetitorDatabaseProps) {
  const [items, setItems] = useState<CompetitorDbRow[]>([]);
  const [columns, setColumns] = useState<CompetitorColumn[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [adding, setAdding] = useState(false);
  // `null` = zamknięty, `"new"` = tworzenie, kolumna = edycja tej kolumny.
  const [columnDialog, setColumnDialog] = useState<CompetitorColumn | "new" | null>(
    null
  );
  const [editingCell, setEditingCell] = useState<{ rowId: string; key: string } | null>(
    null
  );

  const load = useCallback(
    (signal?: AbortSignal) => {
      Promise.all([
        apiFetch<{ items: CompetitorDbRow[] }>(
          `/api/strategy-hub/projects/${projectId}/competitors`,
          { signal, silent: true }
        ),
        apiFetch<{ items: CompetitorColumn[] }>(
          `/api/strategy-hub/projects/${projectId}/competitor-columns`,
          { signal, silent: true }
        ),
      ])
        .then(([competitorsRes, columnsRes]) => {
          setItems(competitorsRes.items ?? []);
          setColumns(columnsRes.items ?? []);
        })
        .catch(() => {
          if (!signal?.aborted) {
            setItems([]);
            setColumns([]);
          }
        })
        .finally(() => {
          if (!signal?.aborted) setLoading(false);
        });
    },
    [projectId]
  );

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
      setItems((prev) => [...prev, { ...res.item, customFields: res.item.customFields ?? null }]);
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
    // Optymistycznie od razu w UI — werdykt cenowy i pola własne mają być
    // błyskawiczne do klikania/edycji.
    setItems((prev) =>
      prev.map((i) =>
        i.id === id
          ? {
              ...i,
              ...patch,
              customFields: patch.customFields
                ? { ...i.customFields, ...patch.customFields }
                : i.customFields,
            }
          : i
      )
    );
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

  function handleColumnSaved(column: CompetitorColumn) {
    setColumns((prev) => {
      const exists = prev.some((c) => c.id === column.id);
      return exists ? prev.map((c) => (c.id === column.id ? column : c)) : [...prev, column];
    });
    setColumnDialog(null);
  }

  async function handleColumnDelete(column: CompetitorColumn) {
    if (
      !window.confirm(
        `Usunąć kolumnę „${column.label}”? Wartości w niej wpisane znikną z widoku dla wszystkich konkurentów.`
      )
    ) {
      return;
    }
    setColumns((prev) => prev.filter((c) => c.id !== column.id));
    try {
      await apiFetch(
        `/api/strategy-hub/projects/${projectId}/competitor-columns/${column.id}`,
        { method: "DELETE" }
      );
    } catch {
      load();
    }
  }

  /** Przesuwanie = zamiana orderIdx z sąsiadem. Działa bez biblioteki DnD. */
  async function handleColumnMove(column: CompetitorColumn, direction: "left" | "right") {
    const idx = columns.findIndex((c) => c.id === column.id);
    const neighborIdx = direction === "left" ? idx - 1 : idx + 1;
    const neighbor = columns[neighborIdx];
    if (!neighbor) return;

    const reordered = [...columns];
    [reordered[idx], reordered[neighborIdx]] = [reordered[neighborIdx], reordered[idx]];
    setColumns(reordered);

    try {
      await Promise.all([
        apiFetch(
          `/api/strategy-hub/projects/${projectId}/competitor-columns/${column.id}`,
          { method: "PATCH", json: { orderIdx: neighborIdx } }
        ),
        apiFetch(
          `/api/strategy-hub/projects/${projectId}/competitor-columns/${neighbor.id}`,
          { method: "PATCH", json: { orderIdx: idx } }
        ),
      ]);
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

  // 6 stałych kolumn + własne + (przy edycji: przycisk "+ kolumna" i kolumna
  // akcji usuwania — dwa dodatkowe nagłówki, patrz <thead> niżej).
  const totalCols = 6 + columns.length + (foundationInherited ? 0 : 2);

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
              {columns.map((col, colIdx) => (
                <th key={col.id} className="group/col p-3 font-medium">
                  <span className="inline-flex items-center gap-1">
                    {!foundationInherited && (
                      <button
                        type="button"
                        disabled={colIdx === 0}
                        onClick={() => handleColumnMove(col, "left")}
                        aria-label={`Przesuń kolumnę ${col.label} w lewo`}
                        title="Przesuń w lewo"
                        className="text-muted-foreground/40 opacity-0 transition-opacity hover:text-foreground group-hover/col:opacity-100 disabled:pointer-events-none disabled:opacity-0"
                      >
                        <ChevronLeft className="size-3" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setColumnDialog(col)}
                      className="max-w-[10rem] truncate hover:text-brand hover:underline"
                      title="Edytuj kolumnę"
                    >
                      {col.label}
                    </button>
                    {!foundationInherited && (
                      <>
                        <button
                          type="button"
                          disabled={colIdx === columns.length - 1}
                          onClick={() => handleColumnMove(col, "right")}
                          aria-label={`Przesuń kolumnę ${col.label} w prawo`}
                          title="Przesuń w prawo"
                          className="text-muted-foreground/40 opacity-0 transition-opacity hover:text-foreground group-hover/col:opacity-100 disabled:pointer-events-none disabled:opacity-0"
                        >
                          <ChevronRight className="size-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleColumnDelete(col)}
                          aria-label={`Usuń kolumnę ${col.label}`}
                          title="Usuń kolumnę"
                          className="text-muted-foreground/40 opacity-0 transition-opacity hover:text-destructive group-hover/col:opacity-100"
                        >
                          <X className="size-3" />
                        </button>
                      </>
                    )}
                  </span>
                </th>
              ))}
              {!foundationInherited && (
                <th className="w-9 p-2">
                  <button
                    type="button"
                    onClick={() => setColumnDialog("new")}
                    aria-label="Dodaj kolumnę"
                    title="Dodaj kolumnę"
                    className="flex size-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    <Plus className="size-3.5" />
                  </button>
                </th>
              )}
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
                  {columns.map((col) => (
                    <td key={col.id} className="p-3">
                      <CustomFieldCell
                        column={col}
                        value={c.customFields?.[col.key] ?? null}
                        editing={
                          editingCell?.rowId === c.id && editingCell.key === col.key
                        }
                        readOnly={foundationInherited}
                        onStartEdit={() => setEditingCell({ rowId: c.id, key: col.key })}
                        onStopEdit={() => setEditingCell(null)}
                        onChange={(value) =>
                          handlePatch(c.id, { customFields: { [col.key]: value } })
                        }
                      />
                    </td>
                  ))}
                  {!foundationInherited && <td className="p-3" />}
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
                <td colSpan={totalCols} className="p-8 text-center text-muted-foreground">
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
        columns={columns}
        readOnly={foundationInherited}
        onClose={() => setOpenId(null)}
        onSave={(patch) => openItem && handlePatch(openItem.id, patch)}
        onDelete={() => openItem && handleDelete(openItem.id)}
      />

      <ColumnFormDialog
        open={columnDialog !== null}
        initial={columnDialog === "new" || columnDialog === null ? null : columnDialog}
        onClose={() => setColumnDialog(null)}
        projectId={projectId}
        onSaved={handleColumnSaved}
      />
    </div>
  );
}

/** Pojedyncza komórka kolumny użytkownika — renderuje się i edytuje wg typu. */
function CustomFieldCell({
  column,
  value,
  editing,
  readOnly,
  onStartEdit,
  onStopEdit,
  onChange,
}: {
  column: CompetitorColumn;
  value: CustomFieldValue;
  editing: boolean;
  readOnly: boolean;
  onStartEdit: () => void;
  onStopEdit: () => void;
  onChange: (value: CustomFieldValue) => void;
}) {
  const [draft, setDraft] = useState(value === null ? "" : String(value));

  const [prevEditing, setPrevEditing] = useState(editing);
  if (editing !== prevEditing) {
    setPrevEditing(editing);
    if (editing) setDraft(value === null ? "" : String(value));
  }

  function commit() {
    if (column.type === "number" || column.type === "currency") {
      const num = draft.trim() === "" ? null : Number(draft.replace(",", "."));
      onChange(Number.isFinite(num) ? num : null);
    } else {
      onChange(draft.trim() === "" ? null : draft);
    }
    onStopEdit();
  }

  if (column.type === "checkbox") {
    const checked = value === true;
    return (
      <button
        type="button"
        disabled={readOnly}
        aria-pressed={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          "flex size-5 items-center justify-center rounded border transition-colors disabled:cursor-not-allowed disabled:opacity-40",
          checked
            ? "border-brand bg-brand text-white"
            : "border-border text-transparent hover:border-brand/40"
        )}
      >
        <Check className="size-3" />
      </button>
    );
  }

  if (column.type === "select") {
    const options = column.options ?? [];
    if (readOnly) {
      const opt = options.find((o) => o.value === value);
      return opt ? (
        <span
          className={cn(
            "inline-flex items-center rounded-md border px-1.5 py-0.5 text-[11px]",
            optionClass(opt.color)
          )}
        >
          {opt.label}
        </span>
      ) : (
        <span className="text-muted-foreground">—</span>
      );
    }
    return (
      <select
        value={typeof value === "string" ? value : ""}
        onChange={(e) => onChange(e.target.value || null)}
        className="h-6 rounded-md border border-border bg-transparent px-1.5 text-[11px] outline-none focus-visible:ring-1 focus-visible:ring-ring"
      >
        <option value="">—</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    );
  }

  if (column.type === "long_text") {
    // Długi tekst edytuje się w karcie — tu tylko podgląd, żeby nie zaśmiecać wiersza.
    return (
      <span
        className={cn(
          "line-clamp-1",
          textColorClass(column.textColor) ?? "text-muted-foreground"
        )}
      >
        {typeof value === "string" && value ? value : "—"}
      </span>
    );
  }

  // text / number / currency / url — klik zamienia w input, blur/Enter zapisuje.
  if (editing && !readOnly) {
    return (
      <input
        // eslint-disable-next-line jsx-a11y/no-autofocus -- input montuje się dopiero po kliknięciu w komórkę; bez fokusu trzeba by kliknąć drugi raz.
        autoFocus
        value={draft}
        // Zawsze "text": <input type="number"> psuje UX dla przecinków/separatorów
        // tysięcy, więc liczby też trzymamy jako text + inputMode="decimal".
        type="text"
        inputMode={column.type === "number" || column.type === "currency" ? "decimal" : undefined}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") onStopEdit();
        }}
        className="h-6 w-full min-w-[6rem] rounded-md border border-brand/40 bg-background px-1.5 text-[11px] outline-none"
      />
    );
  }

  const display =
    value === null || value === undefined || value === ""
      ? "—"
      : column.type === "currency"
        ? `${value} zł`
        : String(value);

  // Kolor kolumny nadpisuje domyślny (szary/link) — użytkownik świadomie go
  // wybrał, więc ma wygrywać nad heurystyką "to jest URL, więc niebieski".
  const colorClass =
    textColorClass(column.textColor) ??
    (column.type === "url" && value
      ? "text-brand underline-offset-2 hover:underline"
      : "text-muted-foreground hover:text-foreground");

  return (
    <button
      type="button"
      disabled={readOnly}
      onClick={onStartEdit}
      className={cn(
        "block max-w-[10rem] truncate text-left disabled:cursor-default",
        colorClass
      )}
    >
      {column.type === "url" && typeof value === "string" && value ? (
        <span className="inline-flex items-center gap-1">
          {value}
          <ExternalLink className="size-2.5 shrink-0" />
        </span>
      ) : (
        display
      )}
    </button>
  );
}

/**
 * Jeden dialog dla tworzenia I edycji kolumny — formularz jest identyczny
 * (etykieta/typ/opcje/kolor), różni się tylko czasownikiem submitu i tym,
 * czy leci POST czy PATCH. Osobny "EditColumnDialog" duplikowałby ~150 linii
 * JSX bez żadnej realnej różnicy w zachowaniu.
 */
function ColumnFormDialog({
  open,
  initial,
  onClose,
  projectId,
  onSaved,
}: {
  open: boolean;
  initial: CompetitorColumn | null;
  onClose: () => void;
  projectId: string;
  onSaved: (column: CompetitorColumn) => void;
}) {
  const [label, setLabel] = useState("");
  const [type, setType] = useState<ColumnType>("text");
  const [options, setOptions] = useState<ColumnOption[]>([]);
  const [textColor, setTextColor] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Reset formularza przy KAŻDYM otwarciu (nowe lub edycja) oraz przy zmianie
  // edytowanej kolumny — ten sam wzorzec "poprzedni klucz" co CompetitorSheet.
  const dialogKey = open ? (initial ? initial.id : "new") : "closed";
  const [prevKey, setPrevKey] = useState(dialogKey);
  if (dialogKey !== prevKey) {
    setPrevKey(dialogKey);
    if (open) {
      setLabel(initial?.label ?? "");
      setType(initial?.type ?? "text");
      setOptions(initial?.options ?? []);
      setTextColor(initial?.textColor ?? null);
    }
  }

  function addOption() {
    const n = options.length;
    setOptions((prev) => [
      ...prev,
      {
        value: `opcja_${n + 1}`,
        label: "",
        color: OPTION_COLORS[n % OPTION_COLORS.length].value,
      },
    ]);
  }

  function updateOption(i: number, patch: Partial<ColumnOption>) {
    setOptions((prev) => prev.map((o, idx) => (idx === i ? { ...o, ...patch } : o)));
  }

  function removeOption(i: number) {
    setOptions((prev) => prev.filter((_, idx) => idx !== i));
  }

  const validOptions = options.filter((o) => o.label.trim());
  const canSave =
    label.trim().length > 0 && (type !== "select" || validOptions.length > 0);

  async function handleSave() {
    if (!canSave) return;
    setSaving(true);
    const body = {
      label: label.trim(),
      type,
      options:
        type === "select"
          ? validOptions.map((o, i) => ({
              value: o.value || `opcja_${i + 1}`,
              label: o.label.trim(),
              color: o.color,
            }))
          : undefined,
      textColor,
    };
    try {
      const res = initial
        ? await apiFetch<{ item: CompetitorColumn }>(
            `/api/strategy-hub/projects/${projectId}/competitor-columns/${initial.id}`,
            { method: "PATCH", json: body }
          )
        : await apiFetch<{ item: CompetitorColumn }>(
            `/api/strategy-hub/projects/${projectId}/competitor-columns`,
            { method: "POST", json: body }
          );
      onSaved(res.item);
    } catch {
      // apiFetch pokazał już toast.
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{initial ? "Edytuj kolumnę" : "Nowa kolumna"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <Field label="Nazwa kolumny">
            <Input
              // eslint-disable-next-line jsx-a11y/no-autofocus -- pole otwiera się dopiero po kliknięciu w kolumnę/„Dodaj kolumnę" — bezpośredni skutek akcji użytkownika.
              autoFocus
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="np. Zespół, Rok założenia, Case study…"
              className="h-8 text-sm"
            />
          </Field>

          <Field label="Typ pola">
            <div className="grid grid-cols-2 gap-1.5">
              {COLUMN_TYPE_LIBRARY.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setType(t.value)}
                  className={cn(
                    "rounded-md border p-2 text-left transition-colors",
                    type === t.value
                      ? "border-brand bg-brand/5"
                      : "border-border hover:border-brand/40"
                  )}
                >
                  <span className="block text-xs font-medium">{t.label}</span>
                  <span className="block text-[10px] text-muted-foreground">
                    {t.hint}
                  </span>
                </button>
              ))}
            </div>
          </Field>

          {type === "select" && (
            <Field label="Opcje wyboru">
              <div className="space-y-1.5">
                {options.map((o, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <div className="flex gap-1">
                      {OPTION_COLORS.map((c) => (
                        <button
                          key={c.value}
                          type="button"
                          title={c.label}
                          onClick={() => updateOption(i, { color: c.value })}
                          className={cn(
                            "size-4 shrink-0 rounded-full border",
                            c.className.split(" ")[1],
                            o.color === c.value
                              ? "ring-2 ring-ring ring-offset-1 ring-offset-background"
                              : ""
                          )}
                        />
                      ))}
                    </div>
                    <Input
                      value={o.label}
                      onChange={(e) => updateOption(i, { label: e.target.value })}
                      placeholder={`Opcja ${i + 1}`}
                      className="h-7 flex-1 text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => removeOption(i)}
                      aria-label="Usuń opcję"
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>
                ))}
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={addOption}
                  className="h-7 gap-1.5 text-xs"
                >
                  <Plus className="size-3.5" />
                  Dodaj opcję
                </Button>
              </div>
            </Field>
          )}

          {type !== "select" && type !== "checkbox" && (
            <Field label="Kolor tekstu w tabeli">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  title="Domyślny"
                  onClick={() => setTextColor(null)}
                  className={cn(
                    "flex size-6 shrink-0 items-center justify-center rounded-full border border-dashed border-border text-muted-foreground",
                    textColor === null
                      ? "ring-2 ring-ring ring-offset-1 ring-offset-background"
                      : ""
                  )}
                >
                  <X className="size-3" />
                </button>
                {OPTION_COLORS.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    title={c.label}
                    onClick={() => setTextColor(c.value)}
                    className={cn(
                      "size-6 shrink-0 rounded-full border",
                      c.className.split(" ")[1],
                      textColor === c.value
                        ? "ring-2 ring-ring ring-offset-1 ring-offset-background"
                        : ""
                    )}
                  />
                ))}
              </div>
            </Field>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            Anuluj
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleSave}
            disabled={!canSave || saving}
            className="gap-1.5"
          >
            {saving && <Loader2 className="size-3.5 animate-spin" />}
            {initial ? "Zapisz zmiany" : "Dodaj kolumnę"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CompetitorSheet({
  item,
  columns,
  readOnly,
  onClose,
  onSave,
  onDelete,
}: {
  item: CompetitorDbRow | null;
  columns: CompetitorColumn[];
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

  function setCustomField(key: string, value: CustomFieldValue) {
    patch("customFields", { ...draft.customFields, [key]: value });
    onSave({ customFields: { [key]: value } });
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

          {columns.length > 0 && (
            <div className="space-y-4 border-t border-border pt-4">
              <h4 className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Własne kolumny
              </h4>
              {columns.map((col) => (
                <CustomFieldInput
                  key={col.id}
                  column={col}
                  value={draft.customFields?.[col.key] ?? null}
                  readOnly={readOnly}
                  onChange={(value) => setCustomField(col.key, value)}
                />
              ))}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function CustomFieldInput({
  column,
  value,
  readOnly,
  onChange,
}: {
  column: CompetitorColumn;
  value: CustomFieldValue;
  readOnly: boolean;
  onChange: (value: CustomFieldValue) => void;
}) {
  const [text, setText] = useState(value === null ? "" : String(value));
  const [prevValue, setPrevValue] = useState(value);
  if (value !== prevValue) {
    setPrevValue(value);
    setText(value === null ? "" : String(value));
  }

  if (column.type === "checkbox") {
    return (
      <Field label={column.label}>
        <button
          type="button"
          disabled={readOnly}
          aria-pressed={value === true}
          onClick={() => onChange(!(value === true))}
          className={cn(
            "flex h-8 items-center gap-2 rounded-md border px-2.5 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-40",
            value === true
              ? "border-brand bg-brand/5 text-brand"
              : "border-border text-muted-foreground"
          )}
        >
          <span
            className={cn(
              "flex size-4 items-center justify-center rounded border",
              value === true ? "border-brand bg-brand text-white" : "border-border"
            )}
          >
            {value === true && <Check className="size-3" />}
          </span>
          {value === true ? "Tak" : "Nie"}
        </button>
      </Field>
    );
  }

  if (column.type === "select") {
    return (
      <Field label={column.label}>
        <select
          value={typeof value === "string" ? value : ""}
          disabled={readOnly}
          onChange={(e) => onChange(e.target.value || null)}
          className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
        >
          <option value="">—</option>
          {(column.options ?? []).map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </Field>
    );
  }

  if (column.type === "long_text") {
    return (
      <Field label={column.label}>
        <Textarea
          value={text}
          disabled={readOnly}
          onChange={(e) => {
            setText(e.target.value);
            onChange(e.target.value || null);
          }}
          className="min-h-16 resize-none text-sm"
        />
      </Field>
    );
  }

  return (
    <Field label={column.label}>
      <Input
        value={text}
        disabled={readOnly}
        // Zawsze "text": <input type="number"> psuje UX dla przecinków/separatorów
        // tysięcy, więc liczby też trzymamy jako text + inputMode="decimal".
        type="text"
        inputMode={
          column.type === "number" || column.type === "currency" ? "decimal" : undefined
        }
        onChange={(e) => {
          setText(e.target.value);
          if (column.type === "number" || column.type === "currency") {
            const num = e.target.value.trim() === "" ? null : Number(e.target.value.replace(",", "."));
            onChange(Number.isFinite(num) ? num : null);
          } else {
            onChange(e.target.value || null);
          }
        }}
        placeholder={column.type === "url" ? "https://…" : undefined}
        className="h-8 text-sm"
      />
    </Field>
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
